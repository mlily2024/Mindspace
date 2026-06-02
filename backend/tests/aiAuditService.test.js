/**
 * Tests for aiAuditService — the hash-chained AI audit log.
 *
 * The crypto / chain logic is unit-tested with no DB mocking required;
 * verifyChain() is tested against a synthetic in-memory chain so we can
 * exercise both happy-path and tampered scenarios without Postgres.
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';

// Mock the db module — verifyChain reads via db.query, append uses db.pool.
const mockQueryRows = { rows: [] };
const mockPoolQueries = [];
const mockPoolClient = {
  query: jest.fn((sql, params) => {
    mockPoolQueries.push({ sql, params });
    if (/SELECT sequence_number, record_hash/.test(sql)) {
      return Promise.resolve({ rows: mockPoolClient.__head ? [mockPoolClient.__head] : [] });
    }
    if (/INSERT INTO ai_audit_log/.test(sql)) {
      const [audit_id, user_id, sequence_number, created_at, conversation_id,
             provider, model_version, input_hash, output_hash, safety_verdict,
             output_classification, latency_ms, prev_hash, record_hash] = params;
      const row = {
        audit_id, user_id, sequence_number, created_at, conversation_id,
        provider, model_version, input_hash, output_hash, safety_verdict,
        output_classification, latency_ms, prev_hash, record_hash
      };
      return Promise.resolve({ rows: [row] });
    }
    return Promise.resolve({ rows: [] });
  }),
  release: jest.fn()
};

jest.mock('../src/config/database', () => ({
  pool: {
    connect: jest.fn(() => Promise.resolve(mockPoolClient))
  },
  query: jest.fn(() => Promise.resolve(mockQueryRows))
}));

const aiAudit = require('../src/services/aiAuditService');
const { stableStringify, sha256Hex, canonicalPayload, computeRecordHash, GENESIS, userLockKey } = aiAudit._internal;

beforeEach(() => {
  mockPoolQueries.length = 0;
  mockPoolClient.__head = null;
  mockPoolClient.query.mockClear();
  mockPoolClient.release.mockClear();
});

describe('stableStringify', () => {
  it('produces the same string regardless of insertion order', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('recurses into nested objects', () => {
    const a = { outer: { y: 1, x: 2 } };
    const b = { outer: { x: 2, y: 1 } };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('preserves array order (arrays are sequenced data, not bags)', () => {
    expect(stableStringify([1, 2, 3])).not.toBe(stableStringify([3, 2, 1]));
  });

  it('handles null and primitives without exploding', () => {
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(42)).toBe('42');
    expect(stableStringify('hi')).toBe('"hi"');
  });
});

describe('sha256Hex', () => {
  it('produces the canonical 64-char hex digest', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic', () => {
    expect(sha256Hex('hello world')).toBe(sha256Hex('hello world'));
  });
});

describe('computeRecordHash', () => {
  const baseRec = {
    audit_id: '00000000-0000-0000-0000-000000000001',
    user_id:  'user-1',
    sequence_number: 1,
    created_at: new Date('2026-06-02T12:00:00Z'),
    conversation_id: null,
    provider: 'rule_based',
    model_version: null,
    input_hash:  'a'.repeat(64),
    output_hash: 'b'.repeat(64),
    safety_verdict: { crisisDetected: false },
    output_classification: 'normal',
    latency_ms: 5
  };

  it('is deterministic given the same record + prev_hash', () => {
    const h1 = computeRecordHash(baseRec, GENESIS);
    const h2 = computeRecordHash(baseRec, GENESIS);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes if ANY field changes', () => {
    const h1 = computeRecordHash(baseRec, GENESIS);
    const h2 = computeRecordHash({ ...baseRec, output_classification: 'crisis_response' }, GENESIS);
    expect(h1).not.toBe(h2);
  });

  it('changes if prev_hash changes (chain linkage)', () => {
    const h1 = computeRecordHash(baseRec, GENESIS);
    const h2 = computeRecordHash(baseRec, 'a'.repeat(64));
    expect(h1).not.toBe(h2);
  });

  it('is insensitive to safety_verdict key order (uses stableStringify)', () => {
    const a = { ...baseRec, safety_verdict: { crisisDetected: false, keywordsMatched: ['x'] } };
    const b = { ...baseRec, safety_verdict: { keywordsMatched: ['x'], crisisDetected: false } };
    expect(computeRecordHash(a, GENESIS)).toBe(computeRecordHash(b, GENESIS));
  });
});

describe('canonicalPayload', () => {
  it('coerces created_at Date to ISO string', () => {
    const p = canonicalPayload({
      audit_id: 'x', user_id: 'u', sequence_number: 1,
      created_at: new Date('2026-06-02T12:00:00Z'),
      provider: 'rule_based', input_hash: 'a', output_hash: 'b',
      output_classification: 'normal'
    });
    expect(p.created_at).toBe('2026-06-02T12:00:00.000Z');
  });

  it('normalises absent optional fields to null', () => {
    const p = canonicalPayload({
      audit_id: 'x', user_id: 'u', sequence_number: 1,
      created_at: new Date(), provider: 'rule_based',
      input_hash: 'a', output_hash: 'b', output_classification: 'normal'
    });
    expect(p.conversation_id).toBeNull();
    expect(p.model_version).toBeNull();
    expect(p.latency_ms).toBeNull();
    expect(p.safety_verdict).toEqual({});
  });
});

describe('userLockKey', () => {
  it('returns a deterministic int32 for the same user', () => {
    const k1 = userLockKey('user-1');
    const k2 = userLockKey('user-1');
    expect(k1).toBe(k2);
    expect(Number.isInteger(k1)).toBe(true);
  });

  it('returns different keys for different users (whp)', () => {
    expect(userLockKey('user-1')).not.toBe(userLockKey('user-2'));
  });
});

describe('append()', () => {
  it('writes a genesis record (prev_hash = GENESIS, sequence_number = 1)', async () => {
    const row = await aiAudit.append({
      userId: 'user-1',
      provider: 'rule_based',
      userMessage: 'hello',
      modelResponse: 'hi there',
      outputClassification: 'normal'
    });
    expect(row.sequence_number).toBe(1);
    expect(row.prev_hash).toBe(GENESIS);
    expect(row.record_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.input_hash).toBe(sha256Hex('hello'));
    expect(row.output_hash).toBe(sha256Hex('hi there'));
  });

  it('links the second record via prev_hash (the chain)', async () => {
    // First record
    const first = await aiAudit.append({
      userId: 'user-1', provider: 'rule_based',
      userMessage: 'a', modelResponse: 'b',
      outputClassification: 'normal'
    });
    // Simulate the DB head row for the next call
    mockPoolClient.__head = {
      sequence_number: first.sequence_number,
      record_hash:     first.record_hash
    };
    const second = await aiAudit.append({
      userId: 'user-1', provider: 'anthropic',
      modelVersion: 'claude-haiku-4-5',
      userMessage: 'c', modelResponse: 'd',
      outputClassification: 'normal',
      latencyMs: 42
    });
    expect(second.sequence_number).toBe(2);
    expect(second.prev_hash).toBe(first.record_hash);
  });

  it('takes a per-user advisory lock inside the transaction', async () => {
    await aiAudit.append({
      userId: 'user-1', provider: 'rule_based',
      userMessage: 'a', modelResponse: 'b', outputClassification: 'normal'
    });
    const sqls = mockPoolQueries.map(q => q.sql);
    expect(sqls).toContain('BEGIN');
    expect(sqls.some(s => /pg_advisory_xact_lock/.test(s))).toBe(true);
    expect(sqls).toContain('COMMIT');
  });

  it('throws on missing required args', async () => {
    await expect(aiAudit.append({}))
      .rejects.toThrow(/userId is required/);
    await expect(aiAudit.append({ userId: 'u' }))
      .rejects.toThrow(/provider is required/);
    await expect(aiAudit.append({ userId: 'u', provider: 'rule_based' }))
      .rejects.toThrow(/outputClassification is required/);
  });

  it('never stores plaintext — only hashes', async () => {
    const secret = 'plaintext-that-must-never-be-stored-XYZ';
    const row = await aiAudit.append({
      userId: 'user-1', provider: 'anthropic',
      userMessage: secret, modelResponse: secret,
      outputClassification: 'normal'
    });
    // Check the INSERT params don't contain the secret anywhere
    const insertCall = mockPoolQueries.find(q => /INSERT INTO ai_audit_log/.test(q.sql));
    const serialised = JSON.stringify(insertCall.params);
    expect(serialised).not.toContain(secret);
    // But the hash IS the SHA-256 of it
    expect(row.input_hash).toBe(sha256Hex(secret));
  });
});

describe('safeAppend()', () => {
  it('swallows errors so the caller is never blocked', async () => {
    // Force the connect path to reject
    const db = require('../src/config/database');
    db.pool.connect.mockImplementationOnce(() => Promise.reject(new Error('db dead')));
    // Should NOT throw — returns void
    expect(() => aiAudit.safeAppend({
      userId: 'user-1', provider: 'rule_based',
      userMessage: 'a', modelResponse: 'b', outputClassification: 'normal'
    })).not.toThrow();
    // Let the async tick settle
    await new Promise(r => setImmediate(r));
  });
});

describe('verifyChain() — tamper detection (synthetic chain)', () => {
  // Build a 3-record chain by computing hashes the same way the service does.
  const buildChain = () => {
    const r1 = {
      audit_id: 'a1', user_id: 'u', sequence_number: 1,
      created_at: new Date('2026-06-02T00:00:01Z'),
      conversation_id: null, provider: 'rule_based', model_version: null,
      input_hash: 'h1in', output_hash: 'h1out', safety_verdict: {},
      output_classification: 'normal', latency_ms: 1
    };
    r1.prev_hash   = GENESIS;
    r1.record_hash = computeRecordHash(r1, r1.prev_hash);

    const r2 = { ...r1, audit_id: 'a2', sequence_number: 2,
                 created_at: new Date('2026-06-02T00:00:02Z'),
                 input_hash: 'h2in', output_hash: 'h2out', latency_ms: 2 };
    r2.prev_hash   = r1.record_hash;
    r2.record_hash = computeRecordHash(r2, r2.prev_hash);

    const r3 = { ...r1, audit_id: 'a3', sequence_number: 3,
                 created_at: new Date('2026-06-02T00:00:03Z'),
                 input_hash: 'h3in', output_hash: 'h3out', latency_ms: 3 };
    r3.prev_hash   = r2.record_hash;
    r3.record_hash = computeRecordHash(r3, r3.prev_hash);

    return [r1, r2, r3];
  };

  const db = require('../src/config/database');

  it('returns ok for a clean chain', async () => {
    const chain = buildChain();
    db.query.mockResolvedValueOnce({ rows: chain });
    expect(await aiAudit.verifyChain('u')).toEqual({ ok: true, count: 3 });
  });

  it('detects field tampering (hash_mismatch)', async () => {
    const chain = buildChain();
    chain[1].output_classification = 'crisis_response'; // <-- silent tamper
    db.query.mockResolvedValueOnce({ rows: chain });
    const result = await aiAudit.verifyChain('u');
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(2);
    expect(result.reason).toBe('hash_mismatch');
  });

  it('detects chain-link tampering (prev_mismatch)', async () => {
    const chain = buildChain();
    chain[2].prev_hash = 'f'.repeat(64); // <-- broken link
    db.query.mockResolvedValueOnce({ rows: chain });
    const result = await aiAudit.verifyChain('u');
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(3);
    expect(result.reason).toBe('prev_mismatch');
  });

  it('detects insertion of a forged record (sequence ok, prev_hash wrong)', async () => {
    const chain = buildChain();
    // Forge an extra record between r2 and r3
    const forged = { ...chain[2], audit_id: 'forged', input_hash: 'h-forged' };
    forged.prev_hash   = chain[1].record_hash;
    forged.record_hash = computeRecordHash(forged, forged.prev_hash);
    chain.splice(2, 0, forged);
    // r3 still points to r2.record_hash, but r3 is now at index 3 — the
    // chain walker will reach r3 expecting prev = forged.record_hash.
    db.query.mockResolvedValueOnce({ rows: chain });
    const result = await aiAudit.verifyChain('u');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('prev_mismatch');
  });

  it('returns ok with count=0 for a user with no records', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    expect(await aiAudit.verifyChain('empty-user')).toEqual({ ok: true, count: 0 });
  });
});

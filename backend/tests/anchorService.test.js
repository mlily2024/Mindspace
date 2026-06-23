/**
 * Tests for anchorService (ADR-0015, F.8) — external anchoring of the audit log.
 * The Merkle core is pure; db + the external sink are mocked. The key test is
 * tamper-detection: a rewritten audit record must make verifyAnchor fail.
 */
jest.mock('../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../src/services/auditAnchorSink', () => ({
  publishAnchor: jest.fn(() => ({ sink: 'file', path: '/tmp/x', published_at: '2026-06-23T00:00:00.000Z' })),
}));

const crypto = require('crypto');
const db = require('../src/config/database');
const sink = require('../src/services/auditAnchorSink');
const svc = require('../src/services/anchorService');

const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

describe('anchorService.merkleRoot', () => {
  it('empty -> SHA-256 of empty string sentinel', () => {
    expect(svc.merkleRoot([])).toBe(sha(''));
    expect(svc.merkleRoot(null)).toBe(sha(''));
  });

  it('single leaf is its own root', () => {
    expect(svc.merkleRoot(['aa'])).toBe('aa');
  });

  it('two leaves hash concatenated, in order', () => {
    expect(svc.merkleRoot(['aa', 'bb'])).toBe(sha('aabb'));
    expect(svc.merkleRoot(['bb', 'aa'])).not.toBe(sha('aabb')); // order matters
  });

  it('odd leaf count duplicates the last node', () => {
    // level1 = [sha(aa+bb), sha(cc+cc)]; root = sha(level1[0] + level1[1])
    const l0 = sha('aa' + 'bb');
    const l1 = sha('cc' + 'cc');
    expect(svc.merkleRoot(['aa', 'bb', 'cc'])).toBe(sha(l0 + l1));
  });
});

describe('anchorService.createAnchor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('commits to chain heads, chains onto GENESIS for the first anchor, publishes', async () => {
    const heads = [
      { user_id: 'u2', head_seq: '3', head_hash: 'h2' },
      { user_id: 'u1', head_seq: '5', head_hash: 'h1' },
    ];
    db.query
      .mockResolvedValueOnce({ rows: heads })             // getChainHeads
      .mockResolvedValueOnce({ rows: [{ c: '8' }] })      // record count
      .mockResolvedValueOnce({ rows: [] })                // no previous anchor
      .mockResolvedValueOnce({ rows: [{ anchor_id: 'a1', sequence_number: '1', merkle_root: 'r', anchor_hash: 'ah' }] }) // insert
      .mockResolvedValueOnce({ rows: [] });               // receipt UPDATE

    const anchor = await svc.createAnchor();
    expect(anchor.anchor_id).toBe('a1');

    // insert call: leaves stored sorted by user_id; prev = GENESIS_ANCHOR; seq 1
    const insert = db.query.mock.calls[3];
    expect(insert[0]).toContain('INSERT INTO audit_anchors');
    const params = insert[1];
    expect(params[0]).toBe(1); // sequence_number
    expect(params[6]).toBe(svc.GENESIS_ANCHOR); // prev_anchor_hash = genesis sentinel
    const leaves = JSON.parse(params[5]);
    expect(leaves.map((l) => l.user_id)).toEqual(['u1', 'u2']); // sorted
    expect(sink.publishAnchor).toHaveBeenCalledTimes(1);
  });

  it('chains onto the previous anchor_hash when one exists', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', head_seq: '1', head_hash: 'h1' }] })
      .mockResolvedValueOnce({ rows: [{ c: '1' }] })
      .mockResolvedValueOnce({ rows: [{ sequence_number: '4', anchor_hash: 'prevhash' }] }) // previous anchor
      .mockResolvedValueOnce({ rows: [{ anchor_id: 'a5', sequence_number: '5' }] })
      .mockResolvedValueOnce({ rows: [] });

    await svc.createAnchor();
    const insert = db.query.mock.calls[3][1];
    expect(insert[0]).toBe(5); // sequence_number = prev + 1
    expect(insert[6]).toBe('prevhash'); // prev_anchor_hash
  });
});

describe('anchorService.verifyAnchor', () => {
  beforeEach(() => jest.clearAllMocks());

  // Build a real, self-consistent anchor row to verify against.
  function buildAnchor() {
    const leaves = [
      { user_id: 'u1', head_seq: 5, head_hash: 'h1' },
      { user_id: 'u2', head_seq: 3, head_hash: 'h2' },
    ];
    const merkle_root = svc.merkleRoot(leaves.map(svc.leafHash));
    const base = { sequence_number: 1, user_count: 2, record_count: 8, merkle_root, prev_anchor_hash: svc.GENESIS_ANCHOR };
    const anchor_hash = svc.computeAnchorHash(base);
    return { anchor_id: 'a1', ...base, sequence_number: '1', user_count: '2', record_count: '8', leaves, anchor_hash };
  }

  it('passes when every committed head is still present and unchanged', async () => {
    const anchor = buildAnchor();
    db.query
      .mockResolvedValueOnce({ rows: [anchor] })                  // fetch anchor
      .mockResolvedValueOnce({ rows: [{ record_hash: 'h1' }] })   // u1 head still h1
      .mockResolvedValueOnce({ rows: [{ record_hash: 'h2' }] });  // u2 head still h2

    const v = await svc.verifyAnchor('a1');
    expect(v.ok).toBe(true);
    expect(v.checks.merkleRootOk).toBe(true);
    expect(v.checks.anchorHashOk).toBe(true);
    expect(v.checks.anchorChainOk).toBe(true);
    expect(v.checks.leafMismatches).toHaveLength(0);
  });

  it('detects a rewritten past record (tamper)', async () => {
    const anchor = buildAnchor();
    db.query
      .mockResolvedValueOnce({ rows: [anchor] })
      .mockResolvedValueOnce({ rows: [{ record_hash: 'TAMPERED' }] }) // u1 head changed
      .mockResolvedValueOnce({ rows: [{ record_hash: 'h2' }] });

    const v = await svc.verifyAnchor('a1');
    expect(v.ok).toBe(false);
    expect(v.checks.leafMismatches).toHaveLength(1);
    expect(v.checks.leafMismatches[0]).toMatchObject({ user_id: 'u1', expected: 'h1', found: 'TAMPERED' });
  });

  it('detects a deleted record (head missing)', async () => {
    const anchor = buildAnchor();
    db.query
      .mockResolvedValueOnce({ rows: [anchor] })
      .mockResolvedValueOnce({ rows: [] }) // u1 head gone
      .mockResolvedValueOnce({ rows: [{ record_hash: 'h2' }] });

    const v = await svc.verifyAnchor('a1');
    expect(v.ok).toBe(false);
    expect(v.checks.leafMismatches[0].found).toBeNull();
  });

  it('returns not-ok for an unknown anchor', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const v = await svc.verifyAnchor('nope');
    expect(v.ok).toBe(false);
    expect(v.checks.exists).toBe(false);
  });
});

describe('anchorService create -> verify round trip (in-memory db)', () => {
  // A tiny fake db that routes by SQL fragment, so createAnchor's real output
  // (merkle_root, anchor_hash, leaves) is what verifyAnchor reads back.
  function fakeDb(auditRows) {
    const anchors = [];
    let nextId = 1;
    const heads = () => {
      const byUser = {};
      for (const r of auditRows) {
        if (!byUser[r.user_id] || r.sequence_number > byUser[r.user_id].sequence_number) byUser[r.user_id] = r;
      }
      return Object.values(byUser).map((r) => ({ user_id: r.user_id, head_seq: r.sequence_number, head_hash: r.record_hash }));
    };
    const query = jest.fn(async (sql, params = []) => {
      if (sql.includes('DISTINCT ON (user_id)')) return { rows: heads() };
      if (sql.includes('COUNT(*)::bigint')) return { rows: [{ c: String(auditRows.length) }] };
      if (sql.includes('SELECT sequence_number, anchor_hash FROM audit_anchors ORDER BY')) {
        const last = anchors[anchors.length - 1];
        return { rows: last ? [{ sequence_number: String(last.sequence_number), anchor_hash: last.anchor_hash }] : [] };
      }
      if (sql.includes('INSERT INTO audit_anchors')) {
        const row = {
          anchor_id: `a${nextId++}`,
          sequence_number: String(params[0]),
          user_count: String(params[1]),
          record_count: String(params[2]),
          merkle_root: params[3],
          algorithm: params[4],
          leaves: JSON.parse(params[5]),
          prev_anchor_hash: params[6],
          anchor_hash: params[7],
        };
        anchors.push(row);
        return { rows: [row] };
      }
      if (sql.includes('UPDATE audit_anchors SET external_receipt')) return { rows: [] };
      if (sql.includes('SELECT * FROM audit_anchors WHERE anchor_id')) {
        return { rows: anchors.filter((a) => a.anchor_id === params[0]) };
      }
      if (sql.includes('SELECT anchor_hash FROM audit_anchors WHERE sequence_number')) {
        return { rows: anchors.filter((a) => Number(a.sequence_number) === params[0]).map((a) => ({ anchor_hash: a.anchor_hash })) };
      }
      if (sql.includes('SELECT record_hash FROM ai_audit_log WHERE user_id')) {
        const hit = auditRows.find((r) => r.user_id === params[0] && r.sequence_number === params[1]);
        return { rows: hit ? [{ record_hash: hit.record_hash }] : [] };
      }
      return { rows: [] };
    });
    return query;
  }

  beforeEach(() => jest.clearAllMocks());

  it('an anchor created over the live log verifies, and a later rewrite fails it', async () => {
    const auditRows = [
      { user_id: 'u1', sequence_number: 1, record_hash: 'a1' },
      { user_id: 'u1', sequence_number: 2, record_hash: 'a2' },
      { user_id: 'u2', sequence_number: 1, record_hash: 'b1' },
    ];
    db.query.mockImplementation(fakeDb(auditRows));

    const anchor = await svc.createAnchor();
    const ok = await svc.verifyAnchor(anchor.anchor_id);
    expect(ok.ok).toBe(true);

    // Now an attacker rewrites u1's head record in place...
    auditRows.find((r) => r.user_id === 'u1' && r.sequence_number === 2).record_hash = 'FORGED';
    const after = await svc.verifyAnchor(anchor.anchor_id);
    expect(after.ok).toBe(false);
    expect(after.checks.leafMismatches.some((m) => m.user_id === 'u1')).toBe(true);
  });
});

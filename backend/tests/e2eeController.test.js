/**
 * Tests for e2eeController — client-side-key E2EE storage endpoints (ADR-0009).
 *
 * Phase 1.3 v1, step 1 of the privacy-enhancements handover (2026-06-16).
 * Mocks the db module so we test controller behaviour (auth scoping,
 * validation, response shape, conflict handling, error handling) in
 * isolation from a real PostgreSQL.
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';

// db.query is the only DB surface the controller touches
jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));
const db = require('../src/config/database');
const e2eeController = require('../src/controllers/e2eeController');

const VALID_BODY = () => ({
  kdf_algo: 'argon2id',
  kdf_salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
  kdf_params: { memory: 65536, time: 3, parallelism: 1 },
  wrapped_master_key:           'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB==',
  wrapped_master_iv:            'CCCCCCCCCCCC',
  wrapped_master_recovery:      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD==',
  wrapped_master_recovery_iv:   'EEEEEEEEEEEE'
});

const makeReq = (overrides = {}) => ({
  user: { userId: 'user-1' },
  body: VALID_BODY(),
  ...overrides
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

// -------------------------------------------------------------- setupE2EE
describe('e2eeController.setupE2EE', () => {
  test('inserts the bundle and returns 201 + user_id + created_at', async () => {
    db.query.mockResolvedValue({ rows: [{ user_id: 'user-1', created_at: '2026-06-16T00:00:00.000Z' }] });
    const req = makeReq(); const res = makeRes(); const next = jest.fn();

    await e2eeController.setupE2EE(req, res, next);

    expect(db.query).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user_id: 'user-1', created_at: '2026-06-16T00:00:00.000Z' }
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 when unauthenticated', async () => {
    const req = makeReq({ user: null }); const res = makeRes(); const next = jest.fn();
    await e2eeController.setupE2EE(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('returns 409 when the user already has metadata (unique violation)', async () => {
    const err = new Error('duplicate key'); err.code = '23505';
    db.query.mockRejectedValue(err);
    const req = makeReq(); const res = makeRes(); const next = jest.fn();

    await e2eeController.setupE2EE(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards other DB errors to next()', async () => {
    db.query.mockRejectedValue(new Error('db down'));
    const req = makeReq(); const res = makeRes(); const next = jest.fn();

    await e2eeController.setupE2EE(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  describe('input validation', () => {
    test('rejects unknown kdf_algo', async () => {
      const req = makeReq({ body: { ...VALID_BODY(), kdf_algo: 'sha1' } });
      const res = makeRes(); const next = jest.fn();
      await e2eeController.setupE2EE(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(db.query).not.toHaveBeenCalled();
    });

    test('rejects empty kdf_salt', async () => {
      const req = makeReq({ body: { ...VALID_BODY(), kdf_salt: '' } });
      const res = makeRes(); const next = jest.fn();
      await e2eeController.setupE2EE(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects kdf_params with out-of-range memory', async () => {
      const req = makeReq({ body: {
        ...VALID_BODY(),
        kdf_params: { memory: 1024, time: 3, parallelism: 1 }  // 1 MiB, below 8 MiB floor
      } });
      const res = makeRes(); const next = jest.fn();
      await e2eeController.setupE2EE(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects kdf_params that does not match the chosen algo', async () => {
      const req = makeReq({ body: {
        ...VALID_BODY(),
        kdf_params: { iterations: 600000 }  // pbkdf2-shaped, but algo is argon2id
      } });
      const res = makeRes(); const next = jest.fn();
      await e2eeController.setupE2EE(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('accepts pbkdf2-sha256 with iterations', async () => {
      db.query.mockResolvedValue({ rows: [{ user_id: 'user-1', created_at: 'now' }] });
      const req = makeReq({ body: {
        ...VALID_BODY(),
        kdf_algo:   'pbkdf2-sha256',
        kdf_params: { iterations: 600000 }
      } });
      const res = makeRes(); const next = jest.fn();
      await e2eeController.setupE2EE(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('rejects non-base64-like wrapped_master_key', async () => {
      const req = makeReq({ body: { ...VALID_BODY(), wrapped_master_key: '<<<not base64>>>' } });
      const res = makeRes(); const next = jest.fn();
      await e2eeController.setupE2EE(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});

// ------------------------------------------------------------- getMetadata
describe('e2eeController.getMetadata', () => {
  test('returns the stored bundle when present', async () => {
    const bundle = {
      kdf_algo: 'argon2id', kdf_salt: 'AAAA', kdf_params: { memory: 65536, time: 3, parallelism: 1 },
      wrapped_master_key: 'BB', wrapped_master_iv: 'CC',
      wrapped_master_recovery: 'DD', wrapped_master_recovery_iv: 'EE',
      created_at: '2026-06-16', updated_at: '2026-06-16'
    };
    db.query.mockResolvedValue({ rows: [bundle] });
    const req = makeReq({ body: {} }); const res = makeRes(); const next = jest.fn();

    await e2eeController.getMetadata(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: bundle });
  });

  test('returns 404 when the user has no metadata yet', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const req = makeReq({ body: {} }); const res = makeRes(); const next = jest.fn();

    await e2eeController.getMetadata(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 401 when unauthenticated', async () => {
    const req = makeReq({ user: undefined, body: {} }); const res = makeRes(); const next = jest.fn();
    await e2eeController.getMetadata(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('forwards DB errors to next()', async () => {
    db.query.mockRejectedValue(new Error('db down'));
    const req = makeReq({ body: {} }); const res = makeRes(); const next = jest.fn();
    await e2eeController.getMetadata(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

// -------------------------------------------------------- rewrapMasterKey
describe('e2eeController.rewrapMasterKey', () => {
  test('updates passphrase wrap, returns updated_at', async () => {
    db.query.mockResolvedValue({ rows: [{ user_id: 'user-1', updated_at: '2026-06-16T01:00:00.000Z' }] });
    const req = makeReq({ body: { wrapped_master_key: 'NEWAAAAAAAA==', wrapped_master_iv: 'NEWIV' } });
    const res = makeRes(); const next = jest.fn();

    await e2eeController.rewrapMasterKey(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user_id: 'user-1', updated_at: '2026-06-16T01:00:00.000Z' }
    });
  });

  test('returns 404 when user has no metadata to rewrap', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const req = makeReq({ body: { wrapped_master_key: 'AAA', wrapped_master_iv: 'BBB' } });
    const res = makeRes(); const next = jest.fn();

    await e2eeController.rewrapMasterKey(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('rejects missing wrapped_master_key', async () => {
    const req = makeReq({ body: { wrapped_master_iv: 'BBB' } });
    const res = makeRes(); const next = jest.fn();
    await e2eeController.rewrapMasterKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('returns 401 when unauthenticated', async () => {
    const req = makeReq({ user: null, body: { wrapped_master_key: 'A', wrapped_master_iv: 'B' } });
    const res = makeRes(); const next = jest.fn();
    await e2eeController.rewrapMasterKey(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ------------------------------------------------------------- _internal
describe('e2eeController._internal helpers', () => {
  const { isNonEmptyBase64Like, isValidKdfParams, KNOWN_KDF_ALGOS } = e2eeController._internal;

  test('isNonEmptyBase64Like accepts standard base64', () => {
    expect(isNonEmptyBase64Like('AAAA')).toBe(true);
    expect(isNonEmptyBase64Like('A/A+A=')).toBe(true);
    expect(isNonEmptyBase64Like('A_A-A')).toBe(true);  // url-safe
  });

  test('isNonEmptyBase64Like rejects empty, too-long, non-base64', () => {
    expect(isNonEmptyBase64Like('')).toBe(false);
    expect(isNonEmptyBase64Like('hello world')).toBe(false);  // space invalid
    expect(isNonEmptyBase64Like('A'.repeat(9000))).toBe(false);
    expect(isNonEmptyBase64Like(null)).toBe(false);
    expect(isNonEmptyBase64Like(42)).toBe(false);
  });

  test('isValidKdfParams enforces argon2id ranges', () => {
    expect(isValidKdfParams('argon2id', { memory: 65536, time: 3, parallelism: 1 })).toBe(true);
    expect(isValidKdfParams('argon2id', { memory: 65536, time: 0, parallelism: 1 })).toBe(false);
    expect(isValidKdfParams('argon2id', { memory: 1, time: 3, parallelism: 1 })).toBe(false);
    expect(isValidKdfParams('argon2id', null)).toBe(false);
  });

  test('isValidKdfParams enforces pbkdf2-sha256 iterations', () => {
    expect(isValidKdfParams('pbkdf2-sha256', { iterations: 600000 })).toBe(true);
    expect(isValidKdfParams('pbkdf2-sha256', { iterations: 99 })).toBe(false);
  });

  test('KNOWN_KDF_ALGOS contains the v1 + future-fallback algos', () => {
    expect(KNOWN_KDF_ALGOS.has('argon2id')).toBe(true);
    expect(KNOWN_KDF_ALGOS.has('pbkdf2-sha256')).toBe(true);
    expect(KNOWN_KDF_ALGOS.has('md5')).toBe(false);
  });
});

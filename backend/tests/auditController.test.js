/**
 * Tests for auditController — user-facing audit-log endpoints.
 *
 * Phase 1.2 of the privacy-enhancements handover (2026-06-15). Mocks
 * the aiAuditService so we test controller behaviour (auth scoping,
 * response shape, error handling) in isolation from the DB.
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';

jest.mock('../src/services/aiAuditService', () => ({
  verifyChain: jest.fn(),
  exportChain: jest.fn()
}));

const aiAuditService = require('../src/services/aiAuditService');
const auditController = require('../src/controllers/auditController');

const makeReq = (overrides = {}) => ({
  user: { userId: 'user-1' },
  ...overrides
});

const makeRes = () => {
  const res = {};
  res.status     = jest.fn().mockReturnValue(res);
  res.json       = jest.fn().mockReturnValue(res);
  res.setHeader  = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auditController.verifyMyChain', () => {
  test('returns ok + count for a clean chain', async () => {
    aiAuditService.verifyChain.mockResolvedValue({ ok: true, count: 42 });
    const req  = makeReq();
    const res  = makeRes();
    const next = jest.fn();

    await auditController.verifyMyChain(req, res, next);

    expect(aiAuditService.verifyChain).toHaveBeenCalledWith('user-1');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        ok:    true,
        count: 42,
        verified_at: expect.any(String)
      })
    }));
  });

  test('returns ok=false + brokenAt on tampered chain', async () => {
    aiAuditService.verifyChain.mockResolvedValue({
      ok: false, brokenAt: 7, reason: 'hash_mismatch'
    });
    const req  = makeReq();
    const res  = makeRes();
    const next = jest.fn();

    await auditController.verifyMyChain(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        ok:       false,
        brokenAt: 7,
        reason:   'hash_mismatch'
      })
    }));
  });

  test('returns 401 when not authenticated', async () => {
    const req  = makeReq({ user: null });
    const res  = makeRes();
    const next = jest.fn();

    await auditController.verifyMyChain(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(aiAuditService.verifyChain).not.toHaveBeenCalled();
  });

  test('forwards service errors to next() so the global error handler responds', async () => {
    aiAuditService.verifyChain.mockRejectedValue(new Error('db is down'));
    const req  = makeReq();
    const res  = makeRes();
    const next = jest.fn();

    await auditController.verifyMyChain(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

describe('auditController.downloadMyChain', () => {
  test('returns the exported chain wrapped in the standard envelope', async () => {
    const chain = {
      user_id:      'user-1',
      exported_at:  '2026-06-15T22:00:00.000Z',
      chain_length: 3,
      genesis:      'GENESIS',
      hash_algo:    'SHA-256 over stable-stringified canonical payload (see aiAuditService.canonicalPayload)',
      records:      [
        { sequence_number: 1, record_hash: 'aaa', prev_hash: 'GENESIS' },
        { sequence_number: 2, record_hash: 'bbb', prev_hash: 'aaa' },
        { sequence_number: 3, record_hash: 'ccc', prev_hash: 'bbb' }
      ]
    };
    aiAuditService.exportChain.mockResolvedValue(chain);
    const req  = makeReq();
    const res  = makeRes();
    const next = jest.fn();

    await auditController.downloadMyChain(req, res, next);

    expect(aiAuditService.exportChain).toHaveBeenCalledWith('user-1');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('mindspace_audit_chain_user-1_')
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: chain });
  });

  test('returns 401 when not authenticated', async () => {
    const req  = makeReq({ user: undefined });
    const res  = makeRes();
    const next = jest.fn();

    await auditController.downloadMyChain(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(aiAuditService.exportChain).not.toHaveBeenCalled();
  });

  test('forwards service errors to next()', async () => {
    aiAuditService.exportChain.mockRejectedValue(new Error('db is down'));
    const req  = makeReq();
    const res  = makeRes();
    const next = jest.fn();

    await auditController.downloadMyChain(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

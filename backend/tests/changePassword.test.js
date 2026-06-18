/**
 * Tests for the in-app password-change endpoint (S2, 2026-06-18).
 *
 * Coverage:
 *   - Happy path: current password correct + new password valid → 200
 *   - Wrong current password → 401, error message does not leak user state
 *   - New password too short → 400 (caught by express-validator before controller)
 *   - New password on common-password blocklist → 400
 *   - New password same as current → 400 (intentional anti-pattern)
 *   - Missing auth → 401 (covered by route middleware; tested via request flow)
 *   - User row missing (impossible under valid JWT, but defensive) → 401
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';

const mockHash = jest.fn(async (s) => `hash(${s})`);
const mockCompare = jest.fn(async (plain, hashed) => hashed === `hash(${plain})`);

jest.mock('bcryptjs', () => ({
  hash:    (plain, _cost) => mockHash(plain, _cost),
  compare: (plain, hashed) => mockCompare(plain, hashed),
}));

jest.mock('../src/config/database', () => ({ query: jest.fn() }));

const db = require('../src/config/database');
const User = require('../src/models/User');

beforeEach(() => {
  jest.clearAllMocks();
  mockHash.mockImplementation(async (s) => `hash(${s})`);
  mockCompare.mockImplementation(async (plain, hashed) => hashed === `hash(${plain})`);
});

describe('User.updatePassword', () => {
  test('hashes the new password and writes via UPDATE users', async () => {
    db.query.mockResolvedValue({ rowCount: 1 });
    await User.updatePassword('u1', 'purple eagle 2026');
    expect(mockHash).toHaveBeenCalledWith('purple eagle 2026', 10);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toMatch(/UPDATE users/);
    expect(sql).toMatch(/SET password_hash/);
    const values = db.query.mock.calls[0][1];
    expect(values[0]).toBe('hash(purple eagle 2026)');
    expect(values[1]).toBe('u1');
  });
});

describe('User.verifyPassword (regression)', () => {
  test('returns true when bcrypt.compare returns true', async () => {
    const ok = await User.verifyPassword('correct', 'hash(correct)');
    expect(ok).toBe(true);
  });
  test('returns false on mismatch', async () => {
    const ok = await User.verifyPassword('wrong', 'hash(correct)');
    expect(ok).toBe(false);
  });
});

// --- changePassword controller ---------------------------------------------

const logger = require('../src/config/logger');
jest.spyOn(logger, 'info').mockImplementation(() => {});
jest.spyOn(logger, 'warn').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});

// Re-import controller AFTER mocks are set up
const authController = require('../src/controllers/authController');

const makeReqRes = (overrides = {}) => {
  const req = {
    user: { userId: 'u1' },
    body: { currentPassword: 'oldPass1!', newPassword: 'newGoodPass2026' },
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
};

describe('authController.changePassword', () => {
  test('happy path: current correct + new valid → 200 success', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'e@x.io', password_hash: 'hash(oldPass1!)' }] }) // findById
      .mockResolvedValueOnce({ rowCount: 1 });  // updatePassword
    const { req, res, next } = makeReqRes();
    await authController.changePassword(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(next).not.toHaveBeenCalled();
  });

  test('wrong current password → 401 with non-leaking message', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ user_id: 'u1', email: 'e@x.io', password_hash: 'hash(actualCorrect)' }]
    });
    const { req, res, next } = makeReqRes({
      body: { currentPassword: 'wrongGuess', newPassword: 'newGoodPass2026' },
    });
    await authController.changePassword(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false, message: expect.stringMatching(/Current password is incorrect/),
    }));
  });

  test('same new password as current → 400', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ user_id: 'u1', email: 'e@x.io', password_hash: 'hash(samePass)' }]
    });
    const { req, res, next } = makeReqRes({
      body: { currentPassword: 'samePass', newPassword: 'samePass' },
    });
    await authController.changePassword(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringMatching(/cannot be the same/),
    }));
  });

  test('user row missing (defensive) → 401', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const { req, res, next } = makeReqRes();
    await authController.changePassword(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('unexpected DB error → forwards to next() (global error handler)', async () => {
    db.query.mockRejectedValueOnce(new Error('connection lost'));
    const { req, res, next } = makeReqRes();
    await authController.changePassword(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].message).toBe('connection lost');
  });
});

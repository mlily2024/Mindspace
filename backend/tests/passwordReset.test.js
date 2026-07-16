/**
 * Tests for the forgot-password / reset-password flow (launch blockers #3 + #4).
 *
 * Coverage:
 *   - forgotPassword: existing email → generic 200, token created, email sent
 *   - forgotPassword: unknown email → IDENTICAL generic 200, no token, no email
 *     (anti-enumeration)
 *   - forgotPassword: stored value is a SHA-256 HASH (64 hex chars), not the raw
 *     token; the raw token only appears in the emailed reset link
 *   - forgotPassword: DB error → still generic 200 (never leaks account state)
 *   - resetPassword: valid token → 200, password updated, token consumed
 *   - resetPassword: invalid/expired token → 400
 *   - resetPassword: DB error → forwarded to next()
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';
process.env.ALLOWED_ORIGINS = 'https://app.example.com';

const mockHash = jest.fn(async (s) => `hash(${s})`);
jest.mock('bcryptjs', () => ({
  hash:    (plain) => mockHash(plain),
  compare: async () => false,
}));

jest.mock('../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../src/services/emailService', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ sent: false }),
  isConfigured: () => false,
}));

const logger = require('../src/config/logger');
jest.spyOn(logger, 'info').mockImplementation(() => {});
jest.spyOn(logger, 'warn').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});

const db = require('../src/config/database');
const emailService = require('../src/services/emailService');
const authController = require('../src/controllers/authController');

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockHash.mockImplementation(async (s) => `hash(${s})`);
});

const GENERIC = 'If an account exists for that email, a password reset link has been sent.';

describe('authController.forgotPassword', () => {
  test('existing email → generic 200, token created, reset email sent', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'e@x.io' }] }) // findByEmail
      .mockResolvedValueOnce({ rowCount: 0 })                                // deleteForUser
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] });                      // create
    const req = { body: { email: 'e@x.io' } };
    const res = makeRes();
    await authController.forgotPassword(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ success: true, message: GENERIC });
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    const [, resetUrl] = emailService.sendPasswordResetEmail.mock.calls[0];
    expect(resetUrl).toMatch(/^https:\/\/app\.example\.com\/reset-password\?token=[a-f0-9]{64}$/);
  });

  test('stores a SHA-256 hash, not the raw token', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1', email: 'e@x.io' }] })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 't1' }] });
    await authController.forgotPassword({ body: { email: 'e@x.io' } }, makeRes(), jest.fn());

    const insert = db.query.mock.calls.find((c) => /INSERT INTO password_reset_tokens/.test(c[0]));
    expect(insert).toBeDefined();
    const storedHash = insert[1][1];
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/); // 64 hex = SHA-256
    const [, resetUrl] = emailService.sendPasswordResetEmail.mock.calls[0];
    const rawToken = resetUrl.split('token=')[1];
    expect(storedHash).not.toBe(rawToken); // hash of the token, not the token
  });

  test('unknown email → identical generic 200, no token, no email (anti-enumeration)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // findByEmail → none
    const res = makeRes();
    await authController.forgotPassword({ body: { email: 'nobody@x.io' } }, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({ success: true, message: GENERIC });
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledTimes(1); // only the lookup, no insert
  });

  test('DB error → still generic 200 (no leak)', async () => {
    db.query.mockRejectedValueOnce(new Error('db down'));
    const res = makeRes();
    const next = jest.fn();
    await authController.forgotPassword({ body: { email: 'e@x.io' } }, res, next);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: GENERIC });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authController.resetPassword', () => {
  test('valid token → 200, password updated + token consumed', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 't1', user_id: 'u1' }] }) // findValidByHash
      .mockResolvedValueOnce({ rowCount: 1 })                          // updatePassword
      .mockResolvedValueOnce({ rowCount: 1 })                          // markUsed
      .mockResolvedValueOnce({ rowCount: 1 });                         // deleteForUser
    const res = makeRes();
    await authController.resetPassword(
      { body: { token: 'abc123def456', newPassword: 'newGoodPass2026' } }, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(mockHash).toHaveBeenCalledWith('newGoodPass2026');
    const markUsed = db.query.mock.calls.find((c) => /SET used_at/.test(c[0]));
    expect(markUsed).toBeDefined();
  });

  test('invalid/expired token → 400', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // findValidByHash → none
    const res = makeRes();
    await authController.resetPassword(
      { body: { token: 'expiredtoken0000', newPassword: 'newGoodPass2026' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('DB error → forwarded to next()', async () => {
    db.query.mockRejectedValueOnce(new Error('connection lost'));
    const next = jest.fn();
    await authController.resetPassword(
      { body: { token: 'sometoken00000000', newPassword: 'newGoodPass2026' } }, makeRes(), next);
    expect(next).toHaveBeenCalled();
    expect(next.mock.calls[0][0].message).toBe('connection lost');
  });
});

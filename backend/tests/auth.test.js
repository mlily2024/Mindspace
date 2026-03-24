/**
 * Tests for auth middleware and token refresh
 * Covers: authenticateToken, optionalAuth, authorize, refreshToken
 */

process.env.JWT_SECRET = 'test_jwt_secret_for_unit_tests';
process.env.JWT_EXPIRE = '1h';
process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';

const jwt = require('jsonwebtoken');
const { authenticateToken, optionalAuth, authorize } = require('../src/middleware/auth');

describe('Auth Middleware', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('authenticateToken', () => {
    it('should return 401 if no token provided', () => {
      const req = { headers: {} };
      const next = jest.fn();
      authenticateToken(req, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 for invalid token', (done) => {
      const req = { headers: { authorization: 'Bearer invalid_token' } };
      const next = jest.fn();
      authenticateToken(req, mockRes, next);
      setTimeout(() => {
        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
        done();
      }, 50);
    });

    it('should call next() and set req.user for valid token', (done) => {
      const token = jwt.sign({ userId: 'user-123', email: 'test@example.com' }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();
      authenticateToken(req, mockRes, next);
      setTimeout(() => {
        expect(next).toHaveBeenCalled();
        expect(req.user).toBeDefined();
        expect(req.user.userId).toBe('user-123');
        done();
      }, 50);
    });

    it('should return 403 for expired token', (done) => {
      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com' },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );
      setTimeout(() => {
        const req = { headers: { authorization: `Bearer ${token}` }, ip: '127.0.0.1' };
        const next = jest.fn();
        authenticateToken(req, mockRes, next);
        setTimeout(() => {
          expect(mockRes.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
          done();
        }, 50);
      }, 100);
    });
  });

  describe('optionalAuth', () => {
    it('should set req.user to null if no token', (done) => {
      const req = { headers: {} };
      const next = jest.fn();
      optionalAuth(req, mockRes, next);
      setTimeout(() => {
        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();
        done();
      }, 50);
    });

    it('should set req.user to null for invalid token', (done) => {
      const req = { headers: { authorization: 'Bearer bad_token' } };
      const next = jest.fn();
      optionalAuth(req, mockRes, next);
      setTimeout(() => {
        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalled();
        done();
      }, 50);
    });

    it('should set req.user for valid token', (done) => {
      const token = jwt.sign({ userId: 'user-456', email: 'a@b.com' }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const next = jest.fn();
      optionalAuth(req, mockRes, next);
      setTimeout(() => {
        expect(req.user).toBeDefined();
        expect(req.user.userId).toBe('user-456');
        done();
      }, 50);
    });
  });

  describe('authorize', () => {
    it('should return 401 if no user on request', () => {
      const middleware = authorize('admin');
      const req = { user: null };
      const next = jest.fn();
      middleware(req, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 if user role not in allowed roles', () => {
      const middleware = authorize('admin');
      const req = { user: { userId: '1', role: 'user' } };
      const next = jest.fn();
      middleware(req, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should call next() if user role matches', () => {
      const middleware = authorize('admin', 'moderator');
      const req = { user: { userId: '1', role: 'admin' } };
      const next = jest.fn();
      middleware(req, mockRes, next);
      expect(next).toHaveBeenCalled();
    });

    it('should call next() if no roles specified', () => {
      const middleware = authorize();
      const req = { user: { userId: '1' } };
      const next = jest.fn();
      middleware(req, mockRes, next);
      expect(next).toHaveBeenCalled();
    });
  });
});

describe('Token Refresh', () => {
  const authController = require('../src/controllers/authController');

  it('should accept a valid token and return a new one', async () => {
    const token = jwt.sign({ userId: 'user-789', email: 'refresh@test.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` }, ip: '127.0.0.1' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await authController.refreshToken(req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ token: expect.any(String) })
      })
    );
  });

  it('should accept an expired token and return a new one', async () => {
    const token = jwt.sign(
      { userId: 'user-789', email: 'refresh@test.com' },
      process.env.JWT_SECRET,
      { expiresIn: '0s' }
    );
    await new Promise(resolve => setTimeout(resolve, 100));

    const req = { headers: { authorization: `Bearer ${token}` }, ip: '127.0.0.1' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await authController.refreshToken(req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('should reject a tampered token', async () => {
    const req = {
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.INVALID_SIG' },
      ip: '127.0.0.1'
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await authController.refreshToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 401 if no token provided', async () => {
    const req = { headers: {}, ip: '127.0.0.1' };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await authController.refreshToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

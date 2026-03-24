/**
 * Tests for error handler middleware
 * Covers: error response format, production vs development mode, requestId inclusion
 */

const { errorHandler, notFound } = require('../src/middleware/errorHandler');

describe('Error Handler Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      id: 'req-123',
      url: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      user: { userId: 'user-1' }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  it('should return 500 by default for generic errors', () => {
    const error = new Error('Something broke');
    errorHandler(error, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it('should use custom statusCode from error', () => {
    const error = new Error('Not found');
    error.statusCode = 404;
    errorHandler(error, mockReq, mockRes, mockNext);
    expect(mockRes.status).toHaveBeenCalledWith(404);
  });

  it('should include requestId in response', () => {
    const error = new Error('Test error');
    errorHandler(error, mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-123' })
    );
  });

  it('should hide error details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Sensitive internal error');
    errorHandler(error, mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'An error occurred'
      })
    );
    // Should NOT contain stack trace
    const callArgs = mockRes.json.mock.calls[0][0];
    expect(callArgs.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  it('should show error details in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Debug error');
    errorHandler(error, mockReq, mockRes, mockNext);

    const callArgs = mockRes.json.mock.calls[0][0];
    expect(callArgs.message).toBe('Debug error');
    expect(callArgs.stack).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });
});

describe('Not Found Handler', () => {
  it('should create a 404 error and pass to next', () => {
    const mockReq = { originalUrl: '/api/nonexistent' };
    const mockRes = {};
    const mockNext = jest.fn();

    notFound(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    const error = mockNext.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(404);
    expect(error.message).toContain('/api/nonexistent');
  });
});

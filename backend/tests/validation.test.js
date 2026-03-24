/**
 * Tests for validation middleware
 * Covers: express-validator integration, error format
 */

const validate = require('../src/middleware/validation');

describe('Validation Middleware', () => {
  let mockRes, mockNext;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  it('should call next() when there are no validation errors', () => {
    // A request with no express-validator contexts means no errors
    const mockReq = {};
    mockReq['express-validator#contexts'] = [];

    validate(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 400 when validation errors exist (integration test)', async () => {
    // Use real express-validator to create a proper validation chain
    const { body, validationResult } = require('express-validator');

    // Create a validator that requires 'email' to be a valid email
    const validators = [
      body('email').isEmail().withMessage('Invalid email')
    ];

    // Mock request with invalid data
    const mockReq = {
      body: { email: 'not-an-email' },
      headers: {},
      query: {},
      params: {}
    };

    // Run validation chain
    for (const validator of validators) {
      await validator.run(mockReq);
    }

    // Now run our validate middleware
    validate(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Validation failed',
        errors: expect.arrayContaining([
          expect.objectContaining({ field: 'email', message: 'Invalid email' })
        ])
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should pass when validation succeeds (integration test)', async () => {
    const { body } = require('express-validator');

    const validators = [
      body('email').isEmail().withMessage('Invalid email')
    ];

    const mockReq = {
      body: { email: 'valid@example.com' },
      headers: {},
      query: {},
      params: {}
    };

    for (const validator of validators) {
      await validator.run(mockReq);
    }

    validate(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});

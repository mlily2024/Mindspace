const { validationResult } = require('express-validator');

/**
 * Validate request using express-validator
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        // Handle both old (err.param) and new (err.path) express-validator versions
        field: err.path || err.param || 'unknown',
        message: err.msg
      }))
    });
  }

  next();
};

module.exports = validate;

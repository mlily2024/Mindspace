const logger = require('../config/logger');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error with request ID for correlation
  logger.error('Error occurred', {
    requestId: req.id,
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.userId
  });

  // Default error status
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  const isProduction = process.env.NODE_ENV === 'production';

  // Send error response — never expose stack traces or internal details in production
  res.status(statusCode).json({
    success: false,
    message: isProduction ? 'An error occurred' : message,
    requestId: req.id,
    ...(!isProduction && { stack: err.stack })
  });
};

/**
 * Handle 404 Not Found
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = {
  errorHandler,
  notFound
};

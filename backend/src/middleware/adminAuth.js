const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

// Admin password MUST be set in environment - no defaults for security
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_JWT_SECRET = process.env.JWT_SECRET + '_admin';

// Validate admin password is configured on startup
if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  logger.warn('SECURITY WARNING: ADMIN_PASSWORD not set or too short (minimum 12 characters). Admin panel will be disabled.');
}

/**
 * Generate admin JWT token
 */
const generateAdminToken = () => {
  return jwt.sign(
    { role: 'admin', isAdmin: true },
    ADMIN_JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Verify admin login credentials
 * Always requires password authentication - no bypass modes
 */
const adminLogin = (req, res) => {
  const { password } = req.body;

  // Check if admin panel is properly configured
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
    logger.warn('Admin: Login attempt but ADMIN_PASSWORD not configured', { ip: req.ip });
    return res.status(503).json({
      success: false,
      message: 'Admin panel is not configured. Set ADMIN_PASSWORD in environment (minimum 12 characters).'
    });
  }

  // Validate password is provided
  if (!password) {
    logger.warn('Admin: Login attempt without password', { ip: req.ip });
    return res.status(400).json({
      success: false,
      message: 'Password is required'
    });
  }

  // Password authentication - use timing-safe comparison to prevent timing attacks
  const crypto = require('crypto');
  const passwordBuffer = Buffer.from(password);
  const adminPasswordBuffer = Buffer.from(ADMIN_PASSWORD);

  // Ensure same length for timing-safe comparison
  const isValidPassword = passwordBuffer.length === adminPasswordBuffer.length &&
    crypto.timingSafeEqual(passwordBuffer, adminPasswordBuffer);

  if (isValidPassword) {
    const token = generateAdminToken();
    logger.info('Admin: Login successful', { ip: req.ip });

    return res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        token,
        expiresIn: '24h'
      }
    });
  }

  logger.warn('Admin: Failed login attempt', { ip: req.ip });
  return res.status(401).json({
    success: false,
    message: 'Invalid admin password'
  });
};

/**
 * Middleware to verify admin token
 * Always requires valid JWT token - no bypass modes
 */
const verifyAdmin = (req, res, next) => {
  // Check for admin token in header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('Admin: Access attempt without token', { ip: req.ip });
    return res.status(401).json({
      success: false,
      message: 'Admin authentication required'
    });
  }

  // Verify JWT token
  jwt.verify(token, ADMIN_JWT_SECRET, (err, decoded) => {
    if (err) {
      logger.warn('Admin: Invalid token attempt', { ip: req.ip, error: err.message });
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired admin token'
      });
    }

    req.admin = decoded;
    return next();
  });
};

/**
 * Check admin status endpoint
 * Reports whether the current request has valid admin authentication
 */
const checkAdminStatus = (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const isConfigured = ADMIN_PASSWORD && ADMIN_PASSWORD.length >= 12;

  let isAuthenticated = false;

  if (token) {
    try {
      jwt.verify(token, ADMIN_JWT_SECRET);
      isAuthenticated = true;
    } catch (err) {
      isAuthenticated = false;
    }
  }

  res.json({
    success: true,
    data: {
      isAuthenticated,
      isConfigured,
      requiresPassword: true
    }
  });
};

module.exports = {
  adminLogin,
  verifyAdmin,
  checkAdminStatus,
  generateAdminToken
};

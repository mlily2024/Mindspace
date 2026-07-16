const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const DataExportService = require('../services/dataExportService');
const emailService = require('../services/emailService');
const logger = require('../config/logger');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const hashResetToken = (raw) => crypto.createHash('sha256').update(String(raw)).digest('hex');
const resetLinkBase = () =>
  (process.env.FRONTEND_URL
    || (process.env.ALLOWED_ORIGINS || '').split(',')[0]
    || 'http://localhost:5173').replace(/\/$/, '');

/**
 * Generate JWT token
 */
const generateToken = (userId, email) => {
  return jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

/**
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    const { email, username, password, isAnonymous, userGroup } = req.body;

    // Check if user already exists
    if (!isAnonymous && email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    // Create user
    const user = await User.create({
      email,
      username,
      password,
      isAnonymous: isAnonymous || false,
      userGroup
    });

    // Generate token
    const token = generateToken(user.user_id, user.email);

    // Log successful registration
    logger.info('User registered', { userId: user.user_id, isAnonymous: user.is_anonymous });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          userId: user.user_id,
          email: user.email,
          username: user.username,
          userGroup: user.user_group,
          isAnonymous: user.is_anonymous
        },
        token
      }
    });
  } catch (error) {
    logger.error('Registration error', { error: error.message });
    next(error);
  }
};

/**
 * Login user
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isValidPassword = await User.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      logger.warn('Failed login attempt', { email, ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await User.updateLastLogin(user.user_id);

    // Generate token
    const token = generateToken(user.user_id, user.email);

    // Log successful login
    logger.info('User logged in', { userId: user.user_id });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          userId: user.user_id,
          email: user.email,
          username: user.username,
          userGroup: user.user_group,
          isAnonymous: user.is_anonymous
        },
        token
      }
    });
  } catch (error) {
    logger.error('Login error', { error: error.message });
    next(error);
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    logger.error('Get profile error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { username, userGroup, timezone } = req.body;

    const updatedUser = await User.updateProfile(req.user.userId, {
      username,
      userGroup,
      timezone
    });

    logger.info('User profile updated', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    logger.error('Update profile error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Update user preferences
 */
const updatePreferences = async (req, res, next) => {
  try {
    const preferences = req.body;

    const updatedPreferences = await User.updatePreferences(req.user.userId, preferences);

    logger.info('User preferences updated', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences: updatedPreferences }
    });
  } catch (error) {
    logger.error('Update preferences error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Delete user account (GDPR compliance)
 */
const deleteAccount = async (req, res, next) => {
  try {
    await User.deleteAccount(req.user.userId);

    logger.info('User account deleted', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    logger.error('Delete account error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Request data export (GDPR compliance)
 */
const requestDataExport = async (req, res, next) => {
  try {
    // Create export request record
    const exportRequest = await User.requestDataExport(req.user.userId);

    // Generate export immediately (for small datasets)
    const exportResult = await DataExportService.generateExport(req.user.userId);

    logger.info('Data export generated', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'Data export generated successfully',
      data: {
        request: exportRequest,
        downloadReady: true,
        export: exportResult.data
      }
    });
  } catch (error) {
    logger.error('Data export error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Download data export as JSON file
 */
const downloadDataExport = async (req, res, next) => {
  try {
    // Generate fresh export
    const exportResult = await DataExportService.generateExport(req.user.userId);

    logger.info('Data export downloaded', { userId: req.user.userId });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);

    res.json(exportResult.data);
  } catch (error) {
    logger.error('Data export download error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Permanently delete account and all data (GDPR right to be forgotten)
 */
const permanentDeleteAccount = async (req, res, next) => {
  try {
    const { confirmDelete } = req.body;

    if (confirmDelete !== 'DELETE_MY_ACCOUNT') {
      return res.status(400).json({
        success: false,
        message: 'Please confirm deletion by sending { confirmDelete: "DELETE_MY_ACCOUNT" }'
      });
    }

    await DataExportService.deleteUserData(req.user.userId);

    logger.info('User account permanently deleted', { userId: req.user.userId });

    res.json({
      success: true,
      message: 'Account and all data permanently deleted'
    });
  } catch (error) {
    logger.error('Permanent delete error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Refresh JWT token (rotation)
 * Accepts an expired (or valid) token and issues a new one,
 * as long as the token signature is authentic and payload is well-formed.
 */
/**
 * PUT /api/auth/password — in-app password change (S2, 2026-06-18).
 *
 * Body: { currentPassword, newPassword }
 *
 * Verifies the current password (bcrypt compare against stored hash),
 * then updates to the new password. Validation of the NEW password's
 * shape (length floor + common-password blocklist) is enforced by the
 * route's express-validator chain in authRoutes.js, matching the
 * registration path shipped in 8f86826.
 *
 * Generic error message on current-password failure to avoid leaking
 * whether a user ID exists or has any particular hash.
 */
/**
 * Forgot password — start a reset. Always returns 200 with a generic message
 * (anti-enumeration): the response is identical whether or not the email is
 * registered. If it is, a single-use, 1-hour token (stored only as a SHA-256
 * hash) is created and a reset link is emailed. Email delivery degrades
 * gracefully (logs the link) if SMTP is not configured.
 */
const forgotPassword = async (req, res, next) => {
  const generic = {
    success: true,
    message: 'If an account exists for that email, a password reset link has been sent.',
  };
  try {
    const { email } = req.body;
    const user = await User.findByEmail(email);
    if (!user || !user.email) {
      return res.json(generic);
    }

    await PasswordResetToken.deleteForUser(user.user_id); // invalidate prior links
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await PasswordResetToken.create(user.user_id, hashResetToken(rawToken), expiresAt);

    const resetUrl = `${resetLinkBase()}/reset-password?token=${rawToken}`;
    await emailService.sendPasswordResetEmail(user.email, resetUrl);

    logger.info('Password reset requested', { userId: user.user_id });
    return res.json(generic);
  } catch (error) {
    logger.error('Forgot-password error', { error: error.message });
    // Still return the generic message so failures don't reveal account state.
    return res.json(generic);
  }
};

/**
 * Reset password — complete a reset with a token from the emailed link.
 * The token is looked up by hash, must be unused and unexpired, and is
 * consumed on success. New-password shape is validated by the route chain.
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const record = await PasswordResetToken.findValidByHash(hashResetToken(token));
    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'This reset link is invalid or has expired. Please request a new one.',
      });
    }

    await User.updatePassword(record.user_id, newPassword);
    await PasswordResetToken.markUsed(record.id);
    await PasswordResetToken.deleteForUser(record.user_id); // clear any remaining links

    logger.info('Password reset completed', { userId: record.user_id });
    return res.json({
      success: true,
      message: 'Your password has been reset. You can now sign in with your new password.',
    });
  } catch (error) {
    logger.error('Reset-password error', { error: error.message });
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Could not verify your account.',
      });
    }

    const ok = await User.verifyPassword(currentPassword, user.password_hash);
    if (!ok) {
      logger.warn('Password change rejected: current password incorrect', { userId });
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Your new password cannot be the same as your current password.',
      });
    }

    await User.updatePassword(userId, newPassword);
    logger.info('Password changed', { userId });

    res.json({ success: true, message: 'Password updated.' });
  } catch (error) {
    logger.error('Error changing password', { error: error.message });
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
    } catch (err) {
      logger.warn('Token refresh failed - invalid token', { ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (!decoded.userId || !decoded.email) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload'
      });
    }

    // Issue a new token
    const newToken = generateToken(decoded.userId, decoded.email);

    logger.info('Token refreshed', { userId: decoded.userId });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: { token: newToken }
    });
  } catch (error) {
    logger.error('Token refresh error', { error: error.message });
    next(error);
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  refreshToken,
  getProfile,
  updateProfile,
  updatePreferences,
  deleteAccount,
  requestDataExport,
  downloadDataExport,
  permanentDeleteAccount
};

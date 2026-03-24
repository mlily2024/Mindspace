const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DataExportService = require('../services/dataExportService');
const logger = require('../config/logger');

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

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  updatePreferences,
  deleteAccount,
  requestDataExport,
  downloadDataExport,
  permanentDeleteAccount
};

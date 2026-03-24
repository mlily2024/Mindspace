/**
 * Wearable Device Controller
 * Handles wearable device connections, syncing, and biometric data endpoints
 */

const WearableService = require('../services/wearableService');
const BiometricCorrelationService = require('../services/biometricCorrelationService');
const logger = require('../config/logger');

/**
 * Get available wearable devices for connection
 * GET /api/wearables/devices
 */
const getAvailableDevices = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const devices = await WearableService.getAvailableDevices(userId);

    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    logger.error('Error getting available devices', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get user's connected wearable devices
 * GET /api/wearables/connections
 */
const getConnections = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const connections = await WearableService.getUserConnections(userId);

    res.json({
      success: true,
      data: connections
    });
  } catch (error) {
    logger.error('Error getting connections', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Initiate connection to a wearable device
 * POST /api/wearables/connect/:deviceType
 */
const initiateConnection = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { deviceType } = req.params;

    // Validate device type
    if (!WearableService.DEVICE_TYPES.includes(deviceType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid device type. Supported: ${WearableService.DEVICE_TYPES.join(', ')}`
      });
    }

    const result = await WearableService.initiateConnection(userId, deviceType);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error initiating connection', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Connect a mock device (for development/testing)
 * POST /api/wearables/connect-mock/:deviceType
 */
const connectMockDevice = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { deviceType } = req.params;

    // Validate device type
    const validTypes = ['apple_health', 'oura', 'fitbit', 'mock'];
    if (!validTypes.includes(deviceType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid device type for mock. Supported: ${validTypes.join(', ')}`
      });
    }

    const connection = await WearableService.connectMockDevice(userId, deviceType);

    res.json({
      success: true,
      data: {
        message: `Mock ${deviceType} device connected successfully`,
        connection
      }
    });
  } catch (error) {
    logger.error('Error connecting mock device', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Handle OAuth callback from wearable provider
 * GET /api/wearables/callback/:deviceType
 */
const handleOAuthCallback = async (req, res, next) => {
  try {
    const { deviceType } = req.params;
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      logger.warn('OAuth error received', { deviceType, error: oauthError });
      return res.redirect(`/settings/wearables?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        error: 'Missing authorization code or state'
      });
    }

    const result = await WearableService.handleOAuthCallback(deviceType, code, state);

    // Redirect to frontend with success
    res.redirect(`/settings/wearables?connected=${deviceType}&success=true`);
  } catch (error) {
    logger.error('Error handling OAuth callback', { error: error.message, deviceType: req.params.deviceType });
    res.redirect(`/settings/wearables?error=${encodeURIComponent(error.message)}`);
  }
};

/**
 * Disconnect a wearable device
 * DELETE /api/wearables/connections/:connectionId
 */
const disconnectDevice = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { connectionId } = req.params;

    const result = await WearableService.disconnectDevice(userId, connectionId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Device disconnected successfully'
      }
    });
  } catch (error) {
    logger.error('Error disconnecting device', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Trigger manual sync for a device
 * POST /api/wearables/sync/:connectionId
 */
const syncDevice = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { connectionId } = req.params;
    const { days = 7 } = req.body;

    const result = await WearableService.syncDeviceData(userId, connectionId, { days });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error syncing device', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Sync all connected devices
 * POST /api/wearables/sync-all
 */
const syncAllDevices = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { days = 7 } = req.body;

    const results = await WearableService.syncAllDevices(userId, { days });

    res.json({
      success: true,
      data: {
        message: 'All devices synced',
        results
      }
    });
  } catch (error) {
    logger.error('Error syncing all devices', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get biometric data
 * GET /api/wearables/biometrics
 */
const getBiometricData = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      startDate,
      endDate,
      dataType,
      limit = 100,
      offset = 0
    } = req.query;

    const data = await WearableService.getBiometricData(userId, {
      startDate,
      endDate,
      dataType,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('Error getting biometric data', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get biometric summary/aggregates
 * GET /api/wearables/biometrics/summary
 */
const getBiometricSummary = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { days = 30 } = req.query;

    const summary = await WearableService.getBiometricSummary(userId, parseInt(days));

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Error getting biometric summary', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get latest biometric readings
 * GET /api/wearables/biometrics/latest
 */
const getLatestBiometrics = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const latest = await WearableService.getLatestBiometrics(userId);

    res.json({
      success: true,
      data: latest
    });
  } catch (error) {
    logger.error('Error getting latest biometrics', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get biometric-mood correlations
 * GET /api/wearables/correlations
 */
const getCorrelations = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const summary = await BiometricCorrelationService.getCorrelationSummary(userId);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Error getting correlations', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Calculate/recalculate correlations
 * POST /api/wearables/correlations/calculate
 */
const calculateCorrelations = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { days = 30, forceRecalculate = false } = req.body;

    const result = await BiometricCorrelationService.calculateUserCorrelations(userId, {
      days: parseInt(days),
      forceRecalculate
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error calculating correlations', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get personalized biometric insights
 * GET /api/wearables/insights
 */
const getInsights = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { unreadOnly = false, limit = 20 } = req.query;

    const insights = await WearableService.getInsights(userId, {
      unreadOnly: unreadOnly === 'true',
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    logger.error('Error getting insights', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Mark insight as read
 * PATCH /api/wearables/insights/:insightId/read
 */
const markInsightRead = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { insightId } = req.params;

    const result = await WearableService.markInsightRead(userId, insightId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Insight not found'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Insight marked as read'
      }
    });
  } catch (error) {
    logger.error('Error marking insight read', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Generate new insights from data
 * POST /api/wearables/insights/generate
 */
const generateInsights = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // First update baselines
    await BiometricCorrelationService.updateBaselines(userId);

    // Check for anomalies
    const anomalyCheck = await BiometricCorrelationService.checkForAnomalies(userId);

    // Generate insights based on correlations
    const insights = await WearableService.generateInsights(userId);

    res.json({
      success: true,
      data: {
        insightsGenerated: insights.length,
        anomaliesDetected: anomalyCheck.anomalies.length,
        insights,
        anomalies: anomalyCheck.anomalies
      }
    });
  } catch (error) {
    logger.error('Error generating insights', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get user's biometric baselines
 * GET /api/wearables/baselines
 */
const getBaselines = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const baselines = await BiometricCorrelationService.updateBaselines(userId);

    res.json({
      success: true,
      data: baselines
    });
  } catch (error) {
    logger.error('Error getting baselines', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get sync history for a connection
 * GET /api/wearables/sync-history/:connectionId
 */
const getSyncHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { connectionId } = req.params;
    const { limit = 10 } = req.query;

    const history = await WearableService.getSyncHistory(connectionId, parseInt(limit));

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Error getting sync history', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get wearable dashboard summary
 * GET /api/wearables/dashboard
 */
const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // Get all relevant data in parallel
    const [connections, latestBiometrics, summary, correlations, insights] = await Promise.all([
      WearableService.getUserConnections(userId),
      WearableService.getLatestBiometrics(userId),
      WearableService.getBiometricSummary(userId, 7),
      BiometricCorrelationService.getCorrelationSummary(userId),
      WearableService.getInsights(userId, { unreadOnly: true, limit: 5 })
    ]);

    res.json({
      success: true,
      data: {
        connections,
        latestBiometrics,
        weekSummary: summary,
        correlations,
        unreadInsights: insights
      }
    });
  } catch (error) {
    logger.error('Error getting dashboard', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

module.exports = {
  getAvailableDevices,
  getConnections,
  initiateConnection,
  connectMockDevice,
  handleOAuthCallback,
  disconnectDevice,
  syncDevice,
  syncAllDevices,
  getBiometricData,
  getBiometricSummary,
  getLatestBiometrics,
  getCorrelations,
  calculateCorrelations,
  getInsights,
  markInsightRead,
  generateInsights,
  getBaselines,
  getSyncHistory,
  getDashboard
};

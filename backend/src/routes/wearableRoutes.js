/**
 * Wearable Device Routes
 * Routes for wearable device connections, biometric data, and insights
 */

const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const wearableController = require('../controllers/wearableController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// Most routes require authentication (OAuth callbacks don't)
const authRoutes = express.Router();
authRoutes.use(authenticateToken);

// Validation rules
const deviceTypeValidation = [
  param('deviceType')
    .isIn(['apple_health', 'oura', 'fitbit', 'garmin', 'mock'])
    .withMessage('Invalid device type')
];

const connectionIdValidation = [
  param('connectionId')
    .isUUID()
    .withMessage('Invalid connection ID')
];

const syncValidation = [
  body('days')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Days must be between 1-90')
];

const correlationValidation = [
  body('days')
    .optional()
    .isInt({ min: 7, max: 365 })
    .withMessage('Days must be between 7-365'),
  body('forceRecalculate')
    .optional()
    .isBoolean()
    .withMessage('forceRecalculate must be boolean')
];

const biometricQueryValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  query('dataType')
    .optional()
    .isString()
    .withMessage('Invalid data type'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1-1000'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative')
];

const insightIdValidation = [
  param('insightId')
    .isUUID()
    .withMessage('Invalid insight ID')
];

// ===========================
// Device Management Routes
// ===========================

/**
 * GET /api/wearables/devices
 * Get available wearable devices for connection
 */
authRoutes.get('/devices', wearableController.getAvailableDevices);

/**
 * GET /api/wearables/connections
 * Get user's connected wearable devices
 */
authRoutes.get('/connections', wearableController.getConnections);

/**
 * POST /api/wearables/connect/:deviceType
 * Initiate OAuth connection to a wearable device
 */
authRoutes.post(
  '/connect/:deviceType',
  deviceTypeValidation,
  validate,
  wearableController.initiateConnection
);

/**
 * POST /api/wearables/connect-mock/:deviceType
 * Connect a mock device (for development/testing)
 */
authRoutes.post(
  '/connect-mock/:deviceType',
  deviceTypeValidation,
  validate,
  wearableController.connectMockDevice
);

/**
 * DELETE /api/wearables/connections/:connectionId
 * Disconnect a wearable device
 */
authRoutes.delete(
  '/connections/:connectionId',
  connectionIdValidation,
  validate,
  wearableController.disconnectDevice
);

// ===========================
// Data Sync Routes
// ===========================

/**
 * POST /api/wearables/sync/:connectionId
 * Trigger manual sync for a specific device
 */
authRoutes.post(
  '/sync/:connectionId',
  connectionIdValidation,
  syncValidation,
  validate,
  wearableController.syncDevice
);

/**
 * POST /api/wearables/sync-all
 * Sync all connected devices
 */
authRoutes.post(
  '/sync-all',
  syncValidation,
  validate,
  wearableController.syncAllDevices
);

/**
 * GET /api/wearables/sync-history/:connectionId
 * Get sync history for a connection
 */
authRoutes.get(
  '/sync-history/:connectionId',
  connectionIdValidation,
  validate,
  wearableController.getSyncHistory
);

// ===========================
// Biometric Data Routes
// ===========================

/**
 * GET /api/wearables/biometrics
 * Get biometric data with optional filtering
 */
authRoutes.get(
  '/biometrics',
  biometricQueryValidation,
  validate,
  wearableController.getBiometricData
);

/**
 * GET /api/wearables/biometrics/summary
 * Get biometric summary/aggregates
 */
authRoutes.get('/biometrics/summary', wearableController.getBiometricSummary);

/**
 * GET /api/wearables/biometrics/latest
 * Get latest biometric readings
 */
authRoutes.get('/biometrics/latest', wearableController.getLatestBiometrics);

/**
 * GET /api/wearables/baselines
 * Get user's biometric baselines
 */
authRoutes.get('/baselines', wearableController.getBaselines);

// ===========================
// Correlation Routes
// ===========================

/**
 * GET /api/wearables/correlations
 * Get biometric-mood correlations
 */
authRoutes.get('/correlations', wearableController.getCorrelations);

/**
 * POST /api/wearables/correlations/calculate
 * Calculate/recalculate correlations
 */
authRoutes.post(
  '/correlations/calculate',
  correlationValidation,
  validate,
  wearableController.calculateCorrelations
);

// ===========================
// Insights Routes
// ===========================

/**
 * GET /api/wearables/insights
 * Get personalized biometric insights
 */
authRoutes.get('/insights', wearableController.getInsights);

/**
 * POST /api/wearables/insights/generate
 * Generate new insights from data
 */
authRoutes.post('/insights/generate', wearableController.generateInsights);

/**
 * PATCH /api/wearables/insights/:insightId/read
 * Mark insight as read
 */
authRoutes.patch(
  '/insights/:insightId/read',
  insightIdValidation,
  validate,
  wearableController.markInsightRead
);

// ===========================
// Dashboard Route
// ===========================

/**
 * GET /api/wearables/dashboard
 * Get comprehensive wearable dashboard data
 */
authRoutes.get('/dashboard', wearableController.getDashboard);

// ===========================
// OAuth Callback Route (No Auth Required)
// ===========================

/**
 * GET /api/wearables/callback/:deviceType
 * Handle OAuth callback from wearable provider
 * This route doesn't require authentication as it's a redirect from provider
 */
router.get('/callback/:deviceType', wearableController.handleOAuthCallback);

// Mount authenticated routes
router.use('/', authRoutes);

module.exports = router;

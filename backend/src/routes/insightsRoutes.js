const express = require('express');
const router = express.Router();
const insightsController = require('../controllers/insightsController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Insights routes
router.post('/generate', insightsController.generateInsights);
router.get('/', insightsController.getInsights);
router.get('/patterns', insightsController.getPatternAnalysis);
router.put('/:insightId/read', insightsController.markInsightRead);

// Safety alerts routes
router.get('/safety-alerts', insightsController.getSafetyAlerts);
router.put('/safety-alerts/:alertId/acknowledge', insightsController.acknowledgeSafetyAlert);

module.exports = router;

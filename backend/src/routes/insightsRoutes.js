const express = require('express');
const router = express.Router();
const { param, query } = require('express-validator');
const insightsController = require('../controllers/insightsController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Insights routes
router.post('/generate', insightsController.generateInsights);
router.get('/',
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  validate,
  insightsController.getInsights
);
router.get('/patterns',
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be 1-365'),
  validate,
  insightsController.getPatternAnalysis
);
router.put('/:insightId/read',
  param('insightId').isUUID().withMessage('Invalid insight ID'),
  validate,
  insightsController.markInsightRead
);

// Safety alerts routes
router.get('/safety-alerts', insightsController.getSafetyAlerts);
router.put('/safety-alerts/:alertId/acknowledge',
  param('alertId').isUUID().withMessage('Invalid alert ID'),
  validate,
  insightsController.acknowledgeSafetyAlert
);

module.exports = router;

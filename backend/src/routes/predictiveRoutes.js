/**
 * Predictive Mood Routes
 * Routes for mood prediction and forecasting
 */

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const predictiveController = require('../controllers/predictiveController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const generateValidation = [
  body('days').optional().isInt({ min: 1, max: 14 }).withMessage('Days must be between 1-14')
];

const dateValidation = [
  // Date format validated in controller
];

/**
 * GET /api/predictions
 * Get mood predictions for the next N days
 * Query params: days (default 7)
 */
router.get('/', predictiveController.getPredictions);

/**
 * POST /api/predictions/generate
 * Force regeneration of predictions
 * Body: { days: number }
 */
router.post('/generate', generateValidation, validate, predictiveController.generatePredictions);

/**
 * GET /api/predictions/accuracy
 * Get prediction accuracy metrics
 */
router.get('/accuracy', predictiveController.getPredictionAccuracy);

/**
 * GET /api/predictions/patterns
 * Get user's analyzed mood patterns
 */
router.get('/patterns', predictiveController.getUserPatterns);

/**
 * GET /api/predictions/:date
 * Get prediction for a specific date (YYYY-MM-DD)
 */
router.get('/:date', predictiveController.getPredictionByDate);

module.exports = router;

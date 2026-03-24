/**
 * Micro-Interventions Routes
 * Routes for intervention delivery and tracking
 */

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const interventionController = require('../controllers/interventionController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const completeValidation = [
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1-5')
];

/**
 * GET /api/interventions/check
 * Check if an intervention should be shown
 * Query params: moodEntry (JSON), trigger, override
 */
router.get('/check', interventionController.checkForIntervention);

/**
 * GET /api/interventions/all
 * Get all available interventions
 */
router.get('/all', interventionController.getAllInterventions);

/**
 * GET /api/interventions/history
 * Get user's intervention history
 * Query params: days (default 30)
 */
router.get('/history', interventionController.getHistory);

/**
 * GET /api/interventions/stats
 * Get user's intervention statistics
 */
router.get('/stats', interventionController.getStats);

/**
 * GET /api/interventions/code/:code
 * Get intervention by code
 */
router.get('/code/:code', interventionController.getInterventionByCode);

/**
 * GET /api/interventions/:id
 * Get a specific intervention by ID
 */
router.get('/:id', interventionController.getIntervention);

/**
 * POST /api/interventions/:id/complete
 * Mark intervention as completed
 * Body: { rating?: number }
 */
router.post('/:id/complete', completeValidation, validate, interventionController.completeIntervention);

/**
 * POST /api/interventions/:id/skip
 * Mark intervention as skipped
 */
router.post('/:id/skip', interventionController.skipIntervention);

module.exports = router;

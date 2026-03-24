/**
 * Voice Analysis Routes
 * Routes for voice emotion analysis
 */

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const voiceController = require('../controllers/voiceController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const analyzeValidation = [
  body('audioFeatures').isObject().withMessage('Audio features object is required'),
  body('transcript').optional().isString()
];

const linkValidation = [
  body('entryId').isUUID().withMessage('Valid entry ID is required')
];

/**
 * POST /api/voice/analyze
 * Analyze voice recording for emotional content
 * Body: { audioFeatures: {...}, transcript?: string }
 */
router.post('/analyze', analyzeValidation, validate, voiceController.analyzeVoice);

/**
 * GET /api/voice/baseline
 * Get user's voice baseline
 */
router.get('/baseline', voiceController.getBaseline);

/**
 * GET /api/voice/history
 * Get user's voice analysis history
 * Query params: limit (default 10)
 */
router.get('/history', voiceController.getAnalysisHistory);

/**
 * POST /api/voice/:analysisId/link
 * Link voice analysis to a mood entry
 * Body: { entryId: uuid }
 */
router.post('/:analysisId/link', linkValidation, validate, voiceController.linkToMoodEntry);

module.exports = router;

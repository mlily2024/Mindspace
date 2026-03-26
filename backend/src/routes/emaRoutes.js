const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const emaController = require('../controllers/emaController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const scheduleUpdateValidation = [
  body('max_prompts_per_day').isInt({ min: 1, max: 5 }).withMessage('Max prompts per day must be between 1-5'),
  body('adaptive_frequency').isBoolean().withMessage('Adaptive frequency must be a boolean')
];

const promptResponseValidation = [
  param('promptId').isUUID().withMessage('Invalid prompt ID'),
  body('mood_score').isInt({ min: 1, max: 5 }).withMessage('Mood score must be between 1-5'),
  body('energy_score').optional().isInt({ min: 1, max: 5 }).withMessage('Energy score must be between 1-5')
];

const variabilityValidation = [
  query('date').optional().isISO8601().withMessage('Date must be a valid date (YYYY-MM-DD)')
];

// EMA routes
router.get('/schedule', emaController.getSchedule);
router.put('/schedule', scheduleUpdateValidation, validate, emaController.updateSchedule);
router.post('/prompts/generate', emaController.generatePrompts);
router.get('/prompts/pending', emaController.getPendingPrompts);
router.post('/prompts/:promptId/respond', promptResponseValidation, validate, emaController.recordResponse);
router.get('/variability', variabilityValidation, validate, emaController.getVariability);

module.exports = router;

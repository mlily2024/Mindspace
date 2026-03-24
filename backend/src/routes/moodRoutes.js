const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const moodController = require('../controllers/moodController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// Validation rules
const moodEntryValidation = [
  body('moodScore').isInt({ min: 1, max: 10 }).withMessage('Mood score must be between 1-10'),
  body('energyLevel').optional().isInt({ min: 1, max: 10 }),
  body('stressLevel').optional().isInt({ min: 1, max: 10 }),
  body('sleepQuality').optional().isInt({ min: 1, max: 10 }),
  body('sleepHours').optional().isFloat({ min: 0, max: 24 }),
  body('anxietyLevel').optional().isInt({ min: 1, max: 10 }),
  body('socialInteractionQuality').optional().isInt({ min: 1, max: 10 })
];

// All routes require authentication
router.use(authenticateToken);

// Query validation for date ranges and pagination
const dateRangeValidation = [
  query('startDate').optional().isISO8601().withMessage('startDate must be a valid date (YYYY-MM-DD)'),
  query('endDate').optional().isISO8601().withMessage('endDate must be a valid date (YYYY-MM-DD)'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be 1-500'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
];

const entryIdValidation = [
  param('entryId').isUUID().withMessage('Invalid entry ID')
];

// Mood entry routes
router.post('/', moodEntryValidation, validate, moodController.createMoodEntry);
router.get('/', dateRangeValidation, validate, moodController.getMoodEntries);
router.get('/statistics', dateRangeValidation, validate, moodController.getMoodStatistics);
router.get('/trends', dateRangeValidation, validate, moodController.getMoodTrends);
router.get('/:entryId', entryIdValidation, validate, moodController.getMoodEntry);
router.put('/:entryId', entryIdValidation, validate, moodController.updateMoodEntry);
router.delete('/:entryId', entryIdValidation, validate, moodController.deleteMoodEntry);

module.exports = router;

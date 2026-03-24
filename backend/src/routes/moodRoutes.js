const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
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

// Mood entry routes
router.post('/', moodEntryValidation, validate, moodController.createMoodEntry);
router.get('/', moodController.getMoodEntries);
router.get('/statistics', moodController.getMoodStatistics);
router.get('/trends', moodController.getMoodTrends);
router.get('/:entryId', moodController.getMoodEntry);
router.put('/:entryId', moodController.updateMoodEntry);
router.delete('/:entryId', moodController.deleteMoodEntry);

module.exports = router;

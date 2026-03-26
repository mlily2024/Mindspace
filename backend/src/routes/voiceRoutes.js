const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const voiceController = require('../controllers/voiceController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const sampleValidation = [
  body('features').isObject().withMessage('Features must be an object'),
  body('moodScore').optional().isInt({ min: 1, max: 10 }).withMessage('Mood score must be between 1-10')
];

const historyValidation = [
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1-365')
];

// Voice routes
router.post('/sample', sampleValidation, validate, voiceController.recordSample);
router.get('/baseline', voiceController.getBaseline);
router.get('/history', historyValidation, validate, voiceController.getHistory);
router.get('/correlation', voiceController.getCorrelation);

module.exports = router;

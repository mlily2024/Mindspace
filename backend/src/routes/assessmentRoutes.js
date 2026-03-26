const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const assessmentController = require('../controllers/assessmentController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Valid instrument types
const validInstruments = ['PHQ9', 'GAD7', 'PSS4', 'WEMWBS', 'ISI'];

// Validation rules
const instrumentValidation = [
  param('instrument')
    .isString()
    .isIn(validInstruments)
    .withMessage(`Instrument must be one of: ${validInstruments.join(', ')}`)
];

const submitValidation = [
  param('instrument')
    .isString()
    .isIn(validInstruments)
    .withMessage(`Instrument must be one of: ${validInstruments.join(', ')}`),
  body('assessmentId').isUUID().withMessage('Invalid assessment ID'),
  body('answers').isArray({ min: 1 }).withMessage('Answers must be a non-empty array')
];

const historyValidation = [
  param('instrument')
    .isString()
    .isIn(validInstruments)
    .withMessage(`Instrument must be one of: ${validInstruments.join(', ')}`),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100')
];

// Assessment routes
router.get('/', assessmentController.getAvailableAssessments);
router.get('/due', assessmentController.checkDue);
router.get('/scores', assessmentController.getLatestScores);
router.get('/:instrument', instrumentValidation, validate, assessmentController.getAssessment);
router.post('/:instrument/submit', submitValidation, validate, assessmentController.submitResponse);
router.get('/:instrument/history', historyValidation, validate, assessmentController.getHistory);

module.exports = router;

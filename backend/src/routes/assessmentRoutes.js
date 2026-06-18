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

// 2026-06-18: dropped body('assessmentId').isUUID() — the frontend never
// sends one (the server generates the UUID inside ValidatedAssessment.create)
// and the old requirement caused every submit to 400 before reaching the
// controller. Optional `note` accepted for free-text annotation; capped at
// 4000 chars to match the schema's TEXT bound expectations.
const submitValidation = [
  param('instrument')
    .isString()
    .isIn(validInstruments)
    .withMessage(`Instrument must be one of: ${validInstruments.join(', ')}`),
  body('answers').isArray({ min: 1 }).withMessage('Answers must be a non-empty array'),
  body('note').optional({ values: 'null' }).isString().isLength({ max: 4000 })
    .withMessage('Note must be a string up to 4000 characters'),
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

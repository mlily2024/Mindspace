const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const protocolController = require('../controllers/protocolController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const protocolIdValidation = [
  param('protocolId').isUUID().withMessage('Invalid protocol ID')
];

const enrollValidation = [
  body('protocolId').isUUID().withMessage('Invalid protocol ID'),
  body('preAssessmentScore').optional().isNumeric().withMessage('Pre-assessment score must be numeric')
];

const completeSessionValidation = [
  param('protocolId').isUUID().withMessage('Invalid protocol ID'),
  body('sessionNumber').isInt({ min: 1 }).withMessage('Session number must be a positive integer'),
  body('moodBefore').isInt({ min: 1, max: 10 }).withMessage('Mood before must be between 1-10'),
  body('moodAfter').isInt({ min: 1, max: 10 }).withMessage('Mood after must be between 1-10'),
  body('difficultyRating').isInt({ min: 1, max: 5 }).withMessage('Difficulty rating must be between 1-5'),
  body('notes').optional().isString(),
  body('exerciseData').optional().isObject()
];

// Protocol routes
router.get('/', protocolController.getProtocols);
router.get('/enrolled', protocolController.getUserProtocols);
router.post('/enroll', enrollValidation, validate, protocolController.enrollInProtocol);
router.get('/:protocolId/session', protocolIdValidation, validate, protocolController.getCurrentSession);
router.post('/:protocolId/complete', completeSessionValidation, validate, protocolController.completeSession);
router.get('/:protocolId/progress', protocolIdValidation, validate, protocolController.getProgress);
router.delete('/:protocolId', protocolIdValidation, validate, protocolController.unenroll);

module.exports = router;

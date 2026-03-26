const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const quickCheckInController = require('../controllers/quickCheckInController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const quickCheckInValidation = [
  body('mood_score').isInt({ min: 1, max: 5 }).withMessage('Mood score must be between 1-5'),
  body('energy_score').optional().isInt({ min: 1, max: 5 }).withMessage('Energy score must be between 1-5')
];

// Quick check-in routes
router.post('/', quickCheckInValidation, validate, quickCheckInController.createQuickEntry);

module.exports = router;

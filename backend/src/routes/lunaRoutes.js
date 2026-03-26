const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const lunaController = require('../controllers/lunaController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const messageValidation = [
  body('message').isString().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters'),
  body('sessionId').optional().isUUID().withMessage('Session ID must be a valid UUID')
];

const journalValidation = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100')
];

const refinementsValidation = [
  query('emotion').isString().notEmpty().withMessage('Emotion query parameter is required')
];

// Luna routes
router.post('/message', messageValidation, validate, lunaController.sendMessage);
router.get('/journal', journalValidation, validate, lunaController.getJournal);
router.get('/profile', lunaController.getProfile);
router.put('/profile', lunaController.updateProfile);
router.get('/techniques', lunaController.getTechniqueEffectiveness);
router.get('/refinements', refinementsValidation, validate, lunaController.suggestRefinements);
router.get('/context', lunaController.getSessionContext);

module.exports = router;

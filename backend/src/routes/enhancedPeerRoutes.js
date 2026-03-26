const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const enhancedPeerController = require('../controllers/enhancedPeerController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const createExerciseValidation = [
  body('groupId').isUUID().withMessage('Invalid group ID'),
  body('exerciseType').isString().notEmpty().withMessage('Exercise type is required'),
  body('title').isString().notEmpty().withMessage('Title is required'),
  body('description').optional().isString(),
  body('scheduledAt').optional().isISO8601().withMessage('Scheduled time must be a valid ISO8601 date')
];

const groupIdValidation = [
  param('groupId').isUUID().withMessage('Invalid group ID')
];

const exerciseResponseValidation = [
  param('exerciseId').isUUID().withMessage('Invalid exercise ID'),
  body('content').isString().notEmpty().withMessage('Content is required')
];

// Enhanced peer routes
router.get('/pattern', enhancedPeerController.getPatternProfile);
router.get('/matches', enhancedPeerController.findMatches);
router.get('/suggest-group', enhancedPeerController.suggestGroup);
router.post('/exercises', createExerciseValidation, validate, enhancedPeerController.createExercise);
router.get('/exercises/:groupId', groupIdValidation, validate, enhancedPeerController.getGroupExercises);
router.post('/exercises/:exerciseId/respond', exerciseResponseValidation, validate, enhancedPeerController.submitExerciseResponse);
router.get('/mentorships', enhancedPeerController.getMentorships);

module.exports = router;

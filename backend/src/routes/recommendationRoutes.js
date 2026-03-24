const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const recommendationController = require('../controllers/recommendationController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validation');

// Validation rules
const feedbackValidation = [
  body('wasHelpful').optional().isBoolean(),
  body('wasCompleted').optional().isBoolean(),
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('feedbackText').optional().isString()
];

// Public route (crisis resources)
router.get('/crisis-resources', optionalAuth, recommendationController.getCrisisResources);

// Protected routes
router.use(authenticateToken);

router.post('/generate', recommendationController.generateRecommendations);
router.get('/', recommendationController.getRecommendations);
router.put('/:recommendationId/complete', recommendationController.completeRecommendation);
router.post('/:recommendationId/feedback', feedbackValidation, validate, recommendationController.submitFeedback);

// ML-enhanced routes
router.post('/ml/generate', recommendationController.generateMLRecommendations);
router.get('/ml/insights', recommendationController.getMLInsights);

module.exports = router;

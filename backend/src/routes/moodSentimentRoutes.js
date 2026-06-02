const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const moodSentimentController = require('../controllers/moodSentimentController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

router.use(authenticateToken);

router.post('/',
  body('sentimentScore').isFloat({ min: -1, max: 1 })
    .withMessage('sentimentScore must be a number in [-1, 1]'),
  body('sentimentLabel').isIn(['positive', 'negative', 'neutral'])
    .withMessage('sentimentLabel must be positive | negative | neutral'),
  body('confidence').isFloat({ min: 0, max: 1 })
    .withMessage('confidence must be in [0, 1]'),
  body('modelId').isString().isLength({ min: 1, max: 200 })
    .withMessage('modelId is required'),
  body('modelVersion').optional().isString().isLength({ max: 100 }),
  body('textLength').optional().isInt({ min: 0, max: 1_000_000 }),
  body('textHash').optional().matches(/^[a-f0-9]{64}$/)
    .withMessage('textHash must be a 64-char SHA-256 hex if provided'),
  body('moodEntryId').optional().isUUID()
    .withMessage('moodEntryId must be a UUID if provided'),
  body('inferenceMs').optional().isInt({ min: 0, max: 600_000 }),
  validate,
  moodSentimentController.createSentiment
);

router.get('/',
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('label').optional().isIn(['positive', 'negative', 'neutral']),
  validate,
  moodSentimentController.getRecent
);

router.get('/summary',
  query('days').optional().isInt({ min: 1, max: 365 }),
  validate,
  moodSentimentController.getSummary
);

module.exports = router;

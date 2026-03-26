const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const predictionController = require('../controllers/predictionController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const predictionsValidation = [
  query('days').optional().isInt({ min: 1, max: 7 }).withMessage('Days must be between 1-7')
];

// Prediction routes
router.get('/', predictionsValidation, validate, predictionController.getPredictions);
router.post('/train', predictionController.trainModel);
router.get('/model', predictionController.getModelInfo);
router.get('/accuracy', predictionController.getAccuracy);

module.exports = router;

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
const forecastValidation = [
  query('days').optional().isInt({ min: 1, max: 30 }).withMessage('Days must be between 1-30')
];

// Prediction routes
router.get('/', predictionsValidation, validate, predictionController.getPredictions);
router.post('/train', predictionController.trainModel);
router.get('/model', predictionController.getModelInfo);
router.get('/accuracy', predictionController.getAccuracy);
// Foundation-model (Chronos) forecast with p10/p50/p90 bands (ADR-0012)
router.get('/forecast', forecastValidation, validate, predictionController.getForecast);

module.exports = router;

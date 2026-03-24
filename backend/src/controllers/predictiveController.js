/**
 * Predictive Mood Controller
 * Handles mood prediction and forecasting endpoints
 */

const PredictiveMoodService = require('../services/predictiveMoodService');
const logger = require('../config/logger');

/**
 * Get mood predictions/forecast for user
 * GET /api/predictions
 */
const getPredictions = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const daysAhead = parseInt(req.query.days) || 7;

    const predictions = await PredictiveMoodService.getPredictions(userId, daysAhead);

    res.json({
      success: true,
      data: predictions
    });
  } catch (error) {
    logger.error('Error getting predictions', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Force regeneration of predictions
 * POST /api/predictions/generate
 */
const generatePredictions = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const daysAhead = parseInt(req.body.days) || 7;

    const result = await PredictiveMoodService.generatePredictions(userId, daysAhead);

    if (result.status === 'insufficient_data') {
      return res.json({
        success: true,
        data: {
          status: 'insufficient_data',
          message: result.message,
          currentEntries: result.currentEntries,
          requiredEntries: result.requiredEntries
        }
      });
    }

    res.json({
      success: true,
      data: {
        status: 'generated',
        predictions: result.predictions,
        patterns: result.patterns
      }
    });
  } catch (error) {
    logger.error('Error generating predictions', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get prediction accuracy metrics
 * GET /api/predictions/accuracy
 */
const getPredictionAccuracy = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const accuracy = await PredictiveMoodService.getPredictionAccuracy(userId);

    res.json({
      success: true,
      data: accuracy
    });
  } catch (error) {
    logger.error('Error getting prediction accuracy', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get user's analyzed patterns
 * GET /api/predictions/patterns
 */
const getUserPatterns = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const patterns = await PredictiveMoodService.getUserPatterns(userId);

    if (!patterns) {
      return res.json({
        success: true,
        data: {
          status: 'no_patterns',
          message: 'Not enough data to analyze patterns yet'
        }
      });
    }

    res.json({
      success: true,
      data: patterns
    });
  } catch (error) {
    logger.error('Error getting user patterns', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get prediction for a specific date
 * GET /api/predictions/:date
 */
const getPredictionByDate = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { date } = req.params;

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const prediction = await PredictiveMoodService.getPredictionByDate(userId, date);

    if (!prediction) {
      return res.json({
        success: true,
        data: {
          status: 'no_prediction',
          message: 'No prediction available for this date'
        }
      });
    }

    res.json({
      success: true,
      data: prediction
    });
  } catch (error) {
    logger.error('Error getting prediction by date', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

module.exports = {
  getPredictions,
  generatePredictions,
  getPredictionAccuracy,
  getUserPatterns,
  getPredictionByDate
};

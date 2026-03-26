const predictionService = require('../services/predictiveEngineService');
const logger = require('../config/logger');

/**
 * Get mood predictions
 */
const getPredictions = async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 3;
    const predictions = await predictionService.getPredictions(req.user.userId, days);

    res.json({
      success: true,
      data: predictions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Train the prediction model for the user
 */
const trainModel = async (req, res, next) => {
  try {
    const result = await predictionService.trainModel(req.user.userId);

    logger.info('Prediction model trained', { userId: req.user.userId });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get prediction model info
 */
const getModelInfo = async (req, res, next) => {
  try {
    const modelInfo = await predictionService.getModelInfo(req.user.userId);

    res.json({
      success: true,
      data: modelInfo
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get prediction accuracy metrics
 */
const getAccuracy = async (req, res, next) => {
  try {
    const accuracy = await predictionService.getAccuracy(req.user.userId);

    res.json({
      success: true,
      data: accuracy
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPredictions,
  trainModel,
  getModelInfo,
  getAccuracy
};

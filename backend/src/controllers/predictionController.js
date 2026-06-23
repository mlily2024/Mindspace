const predictionService = require('../services/predictiveEngineService');
const chronosService = require('../services/chronosService');
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

/**
 * Get a foundation-model (Chronos) mood forecast with p10/p50/p90 bands.
 * Transparently falls back to the regression engine; the `source` field records
 * which engine produced the result (chronos | regression_fallback). (ADR-0012)
 */
const getForecast = async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : 7;
    const forecast = await chronosService.generatePredictions(req.user.userId, days);

    // generatePredictions returns an array of points, or a status object
    // ({status, message}) passed through from the regression engine.
    if (!Array.isArray(forecast)) {
      return res.json({ success: true, data: forecast });
    }
    const source = forecast.length ? forecast[0].source : 'regression_fallback';
    res.json({ success: true, data: { source, forecast } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPredictions,
  trainModel,
  getModelInfo,
  getAccuracy,
  getForecast
};

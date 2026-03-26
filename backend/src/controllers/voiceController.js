const voiceService = require('../services/voiceSignatureService');
const logger = require('../config/logger');

/**
 * Record a voice sample with extracted features
 */
const recordSample = async (req, res, next) => {
  try {
    const { features, moodScore } = req.body;
    const sample = await voiceService.recordSample(req.user.userId, features, moodScore);

    logger.info('Voice sample recorded', { userId: req.user.userId, sampleId: sample.sample_id });

    res.status(201).json({
      success: true,
      data: sample
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's voice baseline
 */
const getBaseline = async (req, res, next) => {
  try {
    const baseline = await voiceService.getBaseline(req.user.userId);

    res.json({
      success: true,
      data: baseline
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get voice sample history
 */
const getHistory = async (req, res, next) => {
  try {
    const days = req.query.days ? parseInt(req.query.days) : undefined;
    const history = await voiceService.getHistory(req.user.userId, days);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get voice-mood correlation data
 */
const getCorrelation = async (req, res, next) => {
  try {
    const correlation = await voiceService.getCorrelation(req.user.userId);

    res.json({
      success: true,
      data: correlation
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  recordSample,
  getBaseline,
  getHistory,
  getCorrelation
};

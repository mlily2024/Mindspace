const lunaService = require('../services/lunaService');
const logger = require('../config/logger');

/**
 * Send a message to Luna
 */
const sendMessage = async (req, res, next) => {
  try {
    const { message, sessionId } = req.body;
    const result = await lunaService.sendMessage(req.user.userId, message, sessionId);

    logger.info('Luna message sent', { userId: req.user.userId, sessionId: result.sessionId });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Luna journal entries
 */
const getJournal = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
    const journal = await lunaService.getJournal(req.user.userId, limit);

    res.json({
      success: true,
      data: journal
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Luna user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const profile = await lunaService.getProfile(req.user.userId);

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Luna user profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const profile = await lunaService.updateProfile(req.user.userId, req.body);

    logger.info('Luna profile updated', { userId: req.user.userId });

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get technique effectiveness data
 */
const getTechniqueEffectiveness = async (req, res, next) => {
  try {
    const effectiveness = await lunaService.getTechniqueEffectiveness(req.user.userId);

    res.json({
      success: true,
      data: effectiveness
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Suggest technique refinements based on emotion
 */
const suggestRefinements = async (req, res, next) => {
  try {
    const refinements = await lunaService.suggestRefinements(req.user.userId, req.query.emotion);

    res.json({
      success: true,
      data: refinements
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current session context
 */
const getSessionContext = async (req, res, next) => {
  try {
    const context = await lunaService.getSessionContext(req.user.userId);

    res.json({
      success: true,
      data: context
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  getJournal,
  getProfile,
  updateProfile,
  getTechniqueEffectiveness,
  suggestRefinements,
  getSessionContext
};

const emaService = require('../services/emaService');
const logger = require('../config/logger');

/**
 * Get EMA schedule settings
 */
const getSchedule = async (req, res, next) => {
  try {
    const schedule = await emaService.getSchedule(req.user.userId);

    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update EMA schedule settings
 */
const updateSchedule = async (req, res, next) => {
  try {
    const schedule = await emaService.updateSchedule(req.user.userId, req.body);

    logger.info('EMA schedule updated', { userId: req.user.userId });

    res.json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate EMA prompts
 */
const generatePrompts = async (req, res, next) => {
  try {
    const prompts = await emaService.generatePrompts(req.user.userId);

    logger.info('EMA prompts generated', { userId: req.user.userId, count: prompts.length });

    res.status(201).json({
      success: true,
      data: prompts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record a response to an EMA prompt
 */
const recordResponse = async (req, res, next) => {
  try {
    const response = await emaService.recordResponse(
      req.user.userId,
      req.params.promptId,
      req.body
    );

    logger.info('EMA response recorded', { userId: req.user.userId, promptId: req.params.promptId });

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending EMA prompts
 */
const getPendingPrompts = async (req, res, next) => {
  try {
    const prompts = await emaService.getPendingPrompts(req.user.userId);

    res.json({
      success: true,
      data: prompts
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get mood variability data
 */
const getVariability = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const variability = await emaService.getVariability(req.user.userId, date);

    res.json({
      success: true,
      data: variability
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSchedule,
  updateSchedule,
  generatePrompts,
  recordResponse,
  getPendingPrompts,
  getVariability
};

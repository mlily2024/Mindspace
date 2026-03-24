const RecommendationService = require('../services/recommendationService');
const logger = require('../config/logger');

/**
 * Generate recommendations for user
 */
const generateRecommendations = async (req, res, next) => {
  try {
    const recommendations = await RecommendationService.generateRecommendations(req.user.userId);

    logger.info('Recommendations generated', { userId: req.user.userId, count: recommendations.length });

    res.json({
      success: true,
      message: `Generated ${recommendations.length} recommendations`,
      data: { recommendations }
    });
  } catch (error) {
    logger.error('Generate recommendations error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get user recommendations
 */
const getRecommendations = async (req, res, next) => {
  try {
    const { activeOnly, limit } = req.query;

    const recommendations = await RecommendationService.getUserRecommendations(req.user.userId, {
      activeOnly: activeOnly !== 'false',
      limit: limit ? parseInt(limit) : 10
    });

    res.json({
      success: true,
      data: {
        recommendations,
        count: recommendations.length
      }
    });
  } catch (error) {
    logger.error('Get recommendations error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Complete recommendation
 */
const completeRecommendation = async (req, res, next) => {
  try {
    const { recommendationId } = req.params;

    const recommendation = await RecommendationService.completeRecommendation(
      recommendationId,
      req.user.userId
    );

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        message: 'Recommendation not found'
      });
    }

    logger.info('Recommendation completed', { userId: req.user.userId, recommendationId });

    res.json({
      success: true,
      message: 'Recommendation marked as completed',
      data: { recommendation }
    });
  } catch (error) {
    logger.error('Complete recommendation error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Submit feedback for recommendation
 */
const submitFeedback = async (req, res, next) => {
  try {
    const { recommendationId } = req.params;
    const feedbackData = req.body;

    const feedback = await RecommendationService.submitFeedback(
      req.user.userId,
      recommendationId,
      feedbackData
    );

    logger.info('Recommendation feedback submitted', { userId: req.user.userId, recommendationId });

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: { feedback }
    });
  } catch (error) {
    logger.error('Submit feedback error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get crisis resources
 */
const getCrisisResources = async (req, res, next) => {
  try {
    const resources = RecommendationService.getCrisisResources();

    res.json({
      success: true,
      data: { resources }
    });
  } catch (error) {
    logger.error('Get crisis resources error', { error: error.message });
    next(error);
  }
};

/**
 * Generate ML-enhanced recommendations
 */
const generateMLRecommendations = async (req, res, next) => {
  try {
    const result = await RecommendationService.generateMLEnhancedRecommendations(req.user.userId);

    logger.info('ML recommendations generated', {
      userId: req.user.userId,
      segment: result.segment?.id,
      count: result.recommendations?.length
    });

    res.json({
      success: true,
      message: 'ML-enhanced recommendations generated',
      data: result
    });
  } catch (error) {
    logger.error('Generate ML recommendations error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get ML insights
 */
const getMLInsights = async (req, res, next) => {
  try {
    const insights = await RecommendationService.getMLInsights(req.user.userId);

    res.json({
      success: true,
      data: insights
    });
  } catch (error) {
    logger.error('Get ML insights error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

module.exports = {
  generateRecommendations,
  getRecommendations,
  completeRecommendation,
  submitFeedback,
  getCrisisResources,
  generateMLRecommendations,
  getMLInsights
};

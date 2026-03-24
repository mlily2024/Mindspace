const InsightsEngine = require('../services/insightsEngine');
const logger = require('../config/logger');

/**
 * Generate insights for user
 */
const generateInsights = async (req, res, next) => {
  try {
    const insights = await InsightsEngine.generateInsights(req.user.userId);

    logger.info('Insights generated', { userId: req.user.userId, count: insights.length });

    res.json({
      success: true,
      message: `Generated ${insights.length} insights`,
      data: { insights }
    });
  } catch (error) {
    logger.error('Generate insights error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get user insights
 */
const getInsights = async (req, res, next) => {
  try {
    const { limit, unreadOnly } = req.query;

    const insights = await InsightsEngine.getUserInsights(req.user.userId, {
      limit: limit ? parseInt(limit) : 10,
      unreadOnly: unreadOnly === 'true'
    });

    res.json({
      success: true,
      data: {
        insights,
        count: insights.length
      }
    });
  } catch (error) {
    logger.error('Get insights error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Mark insight as read
 */
const markInsightRead = async (req, res, next) => {
  try {
    const { insightId } = req.params;

    const insight = await InsightsEngine.markAsRead(insightId, req.user.userId);

    if (!insight) {
      return res.status(404).json({
        success: false,
        message: 'Insight not found'
      });
    }

    res.json({
      success: true,
      message: 'Insight marked as read',
      data: { insight }
    });
  } catch (error) {
    logger.error('Mark insight read error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get safety alerts
 */
const getSafetyAlerts = async (req, res, next) => {
  try {
    const { limit, unacknowledgedOnly } = req.query;

    const alerts = await InsightsEngine.getSafetyAlerts(req.user.userId, {
      limit: limit ? parseInt(limit) : 10,
      unacknowledgedOnly: unacknowledgedOnly === 'true'
    });

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length
      }
    });
  } catch (error) {
    logger.error('Get safety alerts error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Acknowledge safety alert
 */
const acknowledgeSafetyAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { actionTaken } = req.body;

    const alert = await InsightsEngine.acknowledgeSafetyAlert(
      alertId,
      req.user.userId,
      actionTaken
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Safety alert not found'
      });
    }

    logger.info('Safety alert acknowledged', { userId: req.user.userId, alertId });

    res.json({
      success: true,
      message: 'Safety alert acknowledged',
      data: { alert }
    });
  } catch (error) {
    logger.error('Acknowledge safety alert error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get pattern analysis for insights dashboard
 */
const getPatternAnalysis = async (req, res, next) => {
  try {
    const { days } = req.query;

    const analysis = await InsightsEngine.getPatternAnalysis(
      req.user.userId,
      days ? parseInt(days) : 30
    );

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    logger.error('Get pattern analysis error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

module.exports = {
  generateInsights,
  getInsights,
  markInsightRead,
  getSafetyAlerts,
  acknowledgeSafetyAlert,
  getPatternAnalysis
};

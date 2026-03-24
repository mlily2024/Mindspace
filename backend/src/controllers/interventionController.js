/**
 * Micro-Interventions Controller
 * Handles intervention delivery and tracking endpoints
 */

const MicroInterventionService = require('../services/microInterventionService');
const logger = require('../config/logger');

/**
 * Check if an intervention should be shown
 * GET /api/interventions/check
 */
const checkForIntervention = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    let moodEntry = null;
    if (req.query.moodEntry) {
      try {
        moodEntry = JSON.parse(req.query.moodEntry);
        if (typeof moodEntry !== 'object' || moodEntry === null || Array.isArray(moodEntry)) {
          return res.status(400).json({ success: false, message: 'moodEntry must be a JSON object' });
        }
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid moodEntry JSON format' });
      }
    }
    const context = {
      moodEntry,
      trigger: req.query.trigger || 'manual',
      override: req.query.override === 'true'
    };

    const intervention = await MicroInterventionService.getContextualIntervention(userId, context);

    if (!intervention) {
      return res.json({
        success: true,
        data: {
          shouldShow: false,
          reason: 'No intervention needed at this time'
        }
      });
    }

    res.json({
      success: true,
      data: {
        shouldShow: true,
        intervention
      }
    });
  } catch (error) {
    logger.error('Error checking for intervention', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get a specific intervention by ID
 * GET /api/interventions/:id
 */
const getIntervention = async (req, res, next) => {
  try {
    const { id } = req.params;

    const intervention = await MicroInterventionService.getInterventionById(id);

    if (!intervention) {
      return res.status(404).json({
        success: false,
        error: 'Intervention not found'
      });
    }

    res.json({
      success: true,
      data: {
        interventionId: intervention.intervention_id,
        code: intervention.intervention_code,
        title: intervention.title,
        description: intervention.description,
        type: intervention.intervention_type,
        duration: intervention.duration_seconds,
        content: intervention.content,
        icon: intervention.icon,
        color: intervention.color,
        effortLevel: intervention.effort_level
      }
    });
  } catch (error) {
    logger.error('Error getting intervention', { error: error.message });
    next(error);
  }
};

/**
 * Get intervention by code
 * GET /api/interventions/code/:code
 */
const getInterventionByCode = async (req, res, next) => {
  try {
    const { code } = req.params;

    const intervention = await MicroInterventionService.getInterventionByCode(code);

    if (!intervention) {
      return res.status(404).json({
        success: false,
        error: 'Intervention not found'
      });
    }

    res.json({
      success: true,
      data: {
        interventionId: intervention.intervention_id,
        code: intervention.intervention_code,
        title: intervention.title,
        description: intervention.description,
        type: intervention.intervention_type,
        duration: intervention.duration_seconds,
        content: intervention.content,
        icon: intervention.icon,
        color: intervention.color,
        effortLevel: intervention.effort_level
      }
    });
  } catch (error) {
    logger.error('Error getting intervention by code', { error: error.message });
    next(error);
  }
};

/**
 * Mark intervention as completed
 * POST /api/interventions/:id/complete
 */
const completeIntervention = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { rating } = req.body;

    // Validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    const result = await MicroInterventionService.recordInterventionCompleted(userId, id, rating);

    res.json({
      success: true,
      data: {
        message: 'Intervention completed',
        wasCompleted: result.was_completed,
        completedAt: result.completed_at,
        rating: result.user_rating
      }
    });
  } catch (error) {
    logger.error('Error completing intervention', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Mark intervention as skipped
 * POST /api/interventions/:id/skip
 */
const skipIntervention = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const result = await MicroInterventionService.recordInterventionSkipped(userId, id);

    if (!result) {
      return res.json({
        success: true,
        data: {
          message: 'Skip recorded (no active delivery found)'
        }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Intervention skipped',
        skipped: result.skipped,
        skippedAt: result.skipped_at
      }
    });
  } catch (error) {
    logger.error('Error skipping intervention', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get user's intervention history
 * GET /api/interventions/history
 */
const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);

    const history = await MicroInterventionService.getInterventionHistory(userId, days);

    res.json({
      success: true,
      data: history.map(h => ({
        userInterventionId: h.user_intervention_id,
        interventionCode: h.intervention_code,
        title: h.title,
        type: h.intervention_type,
        icon: h.icon,
        triggeredAt: h.triggered_at,
        triggerReason: h.trigger_reason,
        wasShown: h.was_shown,
        wasCompleted: h.was_completed,
        completedAt: h.completed_at,
        rating: h.user_rating,
        skipped: h.skipped
      }))
    });
  } catch (error) {
    logger.error('Error getting intervention history', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get user's intervention statistics
 * GET /api/interventions/stats
 */
const getStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const stats = await MicroInterventionService.getInterventionStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting intervention stats', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get all available interventions
 * GET /api/interventions/all
 */
const getAllInterventions = async (req, res, next) => {
  try {
    const interventions = await MicroInterventionService.getAllInterventions();

    res.json({
      success: true,
      data: interventions.map(i => ({
        interventionId: i.intervention_id,
        code: i.intervention_code,
        title: i.title,
        description: i.description,
        type: i.intervention_type,
        duration: i.duration_seconds,
        icon: i.icon,
        color: i.color,
        effortLevel: i.effort_level
      }))
    });
  } catch (error) {
    logger.error('Error getting all interventions', { error: error.message });
    next(error);
  }
};

module.exports = {
  checkForIntervention,
  getIntervention,
  getInterventionByCode,
  completeIntervention,
  skipIntervention,
  getHistory,
  getStats,
  getAllInterventions
};

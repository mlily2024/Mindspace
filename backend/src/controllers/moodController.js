const MoodEntry = require('../models/MoodEntry');
const GamificationService = require('../services/gamificationService');
const FeedbackService = require('../services/feedbackService');
const MicroInterventionService = require('../services/microInterventionService');
const PredictiveMoodService = require('../services/predictiveMoodService');
const logger = require('../config/logger');
const { subDays, format } = require('date-fns');

/**
 * Create a new mood entry
 */
const createMoodEntry = async (req, res, next) => {
  try {
    const entry = await MoodEntry.create(req.user.userId, req.body);

    logger.info('Mood entry created', { userId: req.user.userId, entryId: entry.entry_id });

    // Update gamification (streak and achievements) in background
    let gamificationData = null;
    try {
      const [streak, newAchievements] = await Promise.all([
        GamificationService.updateStreak(req.user.userId),
        GamificationService.checkAndAwardAchievements(req.user.userId)
      ]);
      gamificationData = { streak, newAchievements };

      if (newAchievements.length > 0) {
        logger.info('New achievements earned', {
          userId: req.user.userId,
          achievements: newAchievements.map(a => a.achievement_code)
        });
      }
    } catch (gamificationError) {
      logger.error('Gamification update error (non-fatal)', { error: gamificationError.message });
    }

    // Phase 1: Update prediction accuracy if prediction exists for today
    try {
      await PredictiveMoodService.updatePredictionAccuracy(
        req.user.userId,
        entry.entry_date,
        entry.mood_score
      );
    } catch (predictionError) {
      logger.error('Prediction accuracy update error (non-fatal)', { error: predictionError.message });
    }

    // Phase 1: Generate enhanced feedback
    let feedbackData = null;
    try {
      feedbackData = await FeedbackService.generatePostCheckInFeedback(req.user.userId, entry);
    } catch (feedbackError) {
      logger.error('Feedback generation error (non-fatal)', { error: feedbackError.message });
    }

    // Phase 1: Check for intervention trigger
    let interventionData = null;
    try {
      interventionData = await MicroInterventionService.getContextualIntervention(
        req.user.userId,
        { moodEntry: entry, trigger: 'post_checkin' }
      );
    } catch (interventionError) {
      logger.error('Intervention check error (non-fatal)', { error: interventionError.message });
    }

    // Phase 1: Generate tomorrow's prediction (async, don't await)
    PredictiveMoodService.generatePredictions(req.user.userId, 3)
      .catch(err => logger.error('Prediction generation failed (non-fatal)', { error: err.message }));

    res.status(201).json({
      success: true,
      message: 'Mood entry created successfully',
      data: {
        entry,
        gamification: gamificationData,
        feedback: feedbackData,
        intervention: interventionData
      }
    });
  } catch (error) {
    logger.error('Create mood entry error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get user mood entries
 */
const getMoodEntries = async (req, res, next) => {
  try {
    const { startDate, endDate, limit, offset } = req.query;

    const entries = await MoodEntry.getUserEntries(req.user.userId, {
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : 30,
      offset: offset ? parseInt(offset) : 0
    });

    res.json({
      success: true,
      data: {
        entries,
        count: entries.length
      }
    });
  } catch (error) {
    logger.error('Get mood entries error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get single mood entry
 */
const getMoodEntry = async (req, res, next) => {
  try {
    const { entryId } = req.params;

    const entry = await MoodEntry.getById(entryId, req.user.userId);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Mood entry not found'
      });
    }

    res.json({
      success: true,
      data: { entry }
    });
  } catch (error) {
    logger.error('Get mood entry error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Update mood entry
 */
const updateMoodEntry = async (req, res, next) => {
  try {
    const { entryId } = req.params;

    const entry = await MoodEntry.update(entryId, req.user.userId, req.body);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Mood entry not found'
      });
    }

    logger.info('Mood entry updated', { userId: req.user.userId, entryId });

    res.json({
      success: true,
      message: 'Mood entry updated successfully',
      data: { entry }
    });
  } catch (error) {
    logger.error('Update mood entry error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Delete mood entry
 */
const deleteMoodEntry = async (req, res, next) => {
  try {
    const { entryId } = req.params;

    const deleted = await MoodEntry.delete(entryId, req.user.userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Mood entry not found'
      });
    }

    logger.info('Mood entry deleted', { userId: req.user.userId, entryId });

    res.json({
      success: true,
      message: 'Mood entry deleted successfully'
    });
  } catch (error) {
    logger.error('Delete mood entry error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get mood statistics
 */
const getMoodStatistics = async (req, res, next) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);

    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

    const statistics = await MoodEntry.getStatistics(req.user.userId, {
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        statistics
      }
    });
  } catch (error) {
    logger.error('Get mood statistics error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get mood trends
 */
const getMoodTrends = async (req, res, next) => {
  try {
    const { period = '30', groupBy = 'week' } = req.query;
    const days = parseInt(period);

    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

    const trends = await MoodEntry.getTrends(req.user.userId, {
      startDate,
      endDate,
      groupBy
    });

    res.json({
      success: true,
      data: {
        period: `${days} days`,
        groupBy,
        trends
      }
    });
  } catch (error) {
    logger.error('Get mood trends error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

module.exports = {
  createMoodEntry,
  getMoodEntries,
  getMoodEntry,
  updateMoodEntry,
  deleteMoodEntry,
  getMoodStatistics,
  getMoodTrends
};

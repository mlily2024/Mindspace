const GamificationService = require('../services/gamificationService');
const logger = require('../config/logger');

/**
 * Get user's streak data
 */
const getStreak = async (req, res, next) => {
  try {
    const streak = await GamificationService.getStreak(req.user.userId);

    res.json({
      success: true,
      data: { streak }
    });
  } catch (error) {
    logger.error('Get streak error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get all achievements with earned status
 */
const getAchievements = async (req, res, next) => {
  try {
    const achievements = await GamificationService.getAchievements(req.user.userId);

    res.json({
      success: true,
      data: { achievements }
    });
  } catch (error) {
    logger.error('Get achievements error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get user's earned achievements only
 */
const getUserAchievements = async (req, res, next) => {
  try {
    const achievements = await GamificationService.getUserAchievements(req.user.userId);

    res.json({
      success: true,
      data: { achievements }
    });
  } catch (error) {
    logger.error('Get user achievements error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Check and award new achievements
 */
const checkAchievements = async (req, res, next) => {
  try {
    const newAchievements = await GamificationService.checkAndAwardAchievements(req.user.userId);

    res.json({
      success: true,
      data: {
        newAchievements,
        count: newAchievements.length
      }
    });
  } catch (error) {
    logger.error('Check achievements error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get full gamification stats (streak + achievements)
 */
const getGamificationStats = async (req, res, next) => {
  try {
    const [streak, achievements, userStats] = await Promise.all([
      GamificationService.getStreak(req.user.userId),
      GamificationService.getAchievements(req.user.userId),
      GamificationService.getUserStats(req.user.userId)
    ]);

    const earnedCount = achievements.filter(a => a.is_earned).length;

    res.json({
      success: true,
      data: {
        streak,
        achievements,
        stats: {
          ...userStats,
          totalAchievements: achievements.length,
          earnedAchievements: earnedCount
        }
      }
    });
  } catch (error) {
    logger.error('Get gamification stats error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Use streak freeze
 */
const useStreakFreeze = async (req, res, next) => {
  try {
    const result = await GamificationService.useStreakFreeze(req.user.userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      message: 'Streak freeze used successfully',
      data: { streak: result.streak }
    });
  } catch (error) {
    logger.error('Use streak freeze error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Mark achievements as notified (after user sees them)
 */
const markAchievementsNotified = async (req, res, next) => {
  try {
    const { achievementIds } = req.body;

    if (!achievementIds || !Array.isArray(achievementIds)) {
      return res.status(400).json({
        success: false,
        message: 'Achievement IDs required'
      });
    }

    await GamificationService.markAchievementsNotified(req.user.userId, achievementIds);

    res.json({
      success: true,
      message: 'Achievements marked as notified'
    });
  } catch (error) {
    logger.error('Mark achievements notified error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

module.exports = {
  getStreak,
  getAchievements,
  getUserAchievements,
  checkAchievements,
  getGamificationStats,
  useStreakFreeze,
  markAchievementsNotified
};

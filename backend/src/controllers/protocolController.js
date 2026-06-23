const logger = require('../config/logger');
const ProtocolService = require('../services/protocolService');

/**
 * List all available protocols.
 */
const getProtocols = async (req, res, next) => {
  try {
    const protocols = await ProtocolService.getAvailableProtocols();
    res.json({ success: true, data: protocols });
  } catch (error) {
    logger.error('Error fetching protocols', { error: error.message });
    next(error);
  }
};

/**
 * Enroll current user in a protocol.
 */
const enrollInProtocol = async (req, res, next) => {
  try {
    const { protocolId, preAssessmentScore } = req.body;
    const userId = req.user.userId;

    logger.info('User enrolling in protocol', { userId, protocolId });

    const enrollment = await ProtocolService.enrollUser(
      userId,
      protocolId,
      preAssessmentScore ?? null
    );
    res.status(201).json({ success: true, data: enrollment });
  } catch (error) {
    // Expected business-rule rejections map to 4xx, not 500.
    if (/not found|inactive|already enrolled/i.test(error.message)) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Error enrolling in protocol', { error: error.message });
    next(error);
  }
};

/**
 * Get the current session for a protocol enrollment.
 */
const getCurrentSession = async (req, res, next) => {
  try {
    const { protocolId } = req.params;
    const userId = req.user.userId;

    const session = await ProtocolService.getCurrentSession(userId, protocolId);
    res.json({ success: true, data: session });
  } catch (error) {
    logger.error('Error fetching current session', { error: error.message });
    next(error);
  }
};

/**
 * Complete a protocol session. The difficulty_rating captured here is what the
 * adaptive layer (C.2) consumes to pace the next session.
 */
const completeSession = async (req, res, next) => {
  try {
    const { protocolId } = req.params;
    const { sessionNumber, moodBefore, moodAfter, difficultyRating, notes, exerciseData } = req.body;
    const userId = req.user.userId;

    logger.info('Session completed', { userId, protocolId, sessionNumber });

    const result = await ProtocolService.completeSession(userId, protocolId, sessionNumber, {
      mood_before: moodBefore,
      mood_after: moodAfter,
      difficulty_rating: difficultyRating,
      notes,
      exercise_data: exerciseData
    });
    res.json({ success: true, data: result });
  } catch (error) {
    if (/no active enrollment|expected session/i.test(error.message)) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Error completing session', { error: error.message });
    next(error);
  }
};

/**
 * Get progress for a protocol enrollment.
 */
const getProgress = async (req, res, next) => {
  try {
    const { protocolId } = req.params;
    const userId = req.user.userId;

    const progress = await ProtocolService.getProgress(userId, protocolId);
    res.json({ success: true, data: progress });
  } catch (error) {
    logger.error('Error fetching progress', { error: error.message });
    next(error);
  }
};

/**
 * Get all protocol enrollments for the current user.
 */
const getUserProtocols = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const enrollments = await ProtocolService.getUserProtocols(userId);
    res.json({ success: true, data: enrollments });
  } catch (error) {
    logger.error('Error fetching user protocols', { error: error.message });
    next(error);
  }
};

/**
 * Unenroll from a protocol.
 */
const unenroll = async (req, res, next) => {
  try {
    const { protocolId } = req.params;
    const userId = req.user.userId;

    logger.info('User unenrolling from protocol', { userId, protocolId });

    await ProtocolService.unenroll(userId, protocolId);
    res.json({ success: true, message: 'Successfully unenrolled' });
  } catch (error) {
    if (/no active enrollment/i.test(error.message)) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Error unenrolling from protocol', { error: error.message });
    next(error);
  }
};

module.exports = {
  getProtocols,
  enrollInProtocol,
  getCurrentSession,
  completeSession,
  getProgress,
  getUserProtocols,
  unenroll
};

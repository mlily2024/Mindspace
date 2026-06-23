const logger = require('../config/logger');
const enhancedPeerService = require('../services/enhancedPeerService');

/**
 * Get (compute) the current user's 30-day mood pattern profile.
 */
const getPatternProfile = async (req, res, next) => {
  try {
    const profile = await enhancedPeerService.computePatternProfile(req.user.userId);
    res.json({ success: true, data: profile });
  } catch (error) {
    logger.error('Error fetching pattern profile', { error: error.message });
    next(error);
  }
};

/**
 * Find pattern-based (same-cluster) peer matches for the current user.
 */
const findMatches = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const matches = await enhancedPeerService.findPatternMatches(req.user.userId, limit);
    res.json({ success: true, data: matches });
  } catch (error) {
    logger.error('Error finding matches', { error: error.message });
    next(error);
  }
};

/**
 * Suggest the peer archetype for the user's current pattern cluster.
 */
const suggestGroup = async (req, res, next) => {
  try {
    const suggestion = await enhancedPeerService.suggestGroup(req.user.userId);
    res.json({ success: true, data: suggestion });
  } catch (error) {
    logger.error('Error suggesting group', { error: error.message });
    next(error);
  }
};

/**
 * Create a group exercise
 */
const createExercise = async (req, res, next) => {
  try {
    const { groupId, exerciseType, title, description, scheduledAt } = req.body;
    const userId = req.user.userId;

    logger.info('Group exercise created', { userId, groupId, exerciseType });

    // TODO: implement with EnhancedPeer model
    res.status(201).json({
      success: true,
      data: { groupId, exerciseType, title, description, scheduledAt }
    });
  } catch (error) {
    logger.error('Error creating exercise', { error: error.message });
    next(error);
  }
};

/**
 * Get exercises for a group
 */
const getGroupExercises = async (req, res, next) => {
  try {
    const { groupId: _groupId } = req.params;
    const _userId = req.user.userId;

    // TODO: implement with EnhancedPeer model
    res.json({ success: true, data: [] });
  } catch (error) {
    logger.error('Error fetching group exercises', { error: error.message });
    next(error);
  }
};

/**
 * Submit a response to a group exercise
 */
const submitExerciseResponse = async (req, res, next) => {
  try {
    const { exerciseId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    logger.info('Exercise response submitted', { userId, exerciseId });

    // TODO: implement with EnhancedPeer model
    res.status(201).json({ success: true, data: { exerciseId, content } });
  } catch (error) {
    logger.error('Error submitting exercise response', { error: error.message });
    next(error);
  }
};

/**
 * Get mentorship connections for current user
 */
const getMentorships = async (req, res, next) => {
  try {
    const _userId = req.user.userId;

    // TODO: implement with EnhancedPeer model
    res.json({ success: true, data: [] });
  } catch (error) {
    logger.error('Error fetching mentorships', { error: error.message });
    next(error);
  }
};

module.exports = {
  getPatternProfile,
  findMatches,
  suggestGroup,
  createExercise,
  getGroupExercises,
  submitExerciseResponse,
  getMentorships
};

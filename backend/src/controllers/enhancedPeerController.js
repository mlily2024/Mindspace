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
    const exercise = await enhancedPeerService.createStructuredExercise(
      req.user.userId, groupId, exerciseType, title, description, scheduledAt
    );
    res.status(201).json({ success: true, data: exercise });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, error: error.message });
    logger.error('Error creating exercise', { error: error.message });
    next(error);
  }
};

/**
 * Get exercises for a group (members only)
 */
const getGroupExercises = async (req, res, next) => {
  try {
    const exercises = await enhancedPeerService.getGroupExercises(req.user.userId, req.params.groupId);
    res.json({ success: true, data: exercises });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, error: error.message });
    logger.error('Error fetching group exercises', { error: error.message });
    next(error);
  }
};

/**
 * Submit a response to a group exercise (members only)
 */
const submitExerciseResponse = async (req, res, next) => {
  try {
    const response = await enhancedPeerService.submitExerciseResponse(
      req.user.userId, req.params.exerciseId, req.body.content
    );
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, error: error.message });
    logger.error('Error submitting exercise response', { error: error.message });
    next(error);
  }
};

/**
 * Get mentorship connections for the current user
 */
const getMentorships = async (req, res, next) => {
  try {
    const mentorships = await enhancedPeerService.getUserMentorships(req.user.userId);
    res.json({ success: true, data: mentorships });
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

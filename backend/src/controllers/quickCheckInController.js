const quickCheckInService = require('../services/quickCheckInService');
const logger = require('../config/logger');

/**
 * Create a quick check-in entry
 */
const createQuickEntry = async (req, res, next) => {
  try {
    const entry = await quickCheckInService.createQuickEntry(req.user.userId, req.body);

    logger.info('Quick check-in created', { userId: req.user.userId, entryId: entry.entry_id });

    res.status(201).json({
      success: true,
      data: entry
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createQuickEntry
};

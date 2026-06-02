const cohortInsightsService = require('../services/cohortInsightsService');
const logger = require('../config/logger');

/**
 * GET /api/cohort-insights/mood-by-day-of-week
 *
 * Returns an ε-DP-protected histogram of average mood scores by day of
 * week, aggregated across all consenting users. Authenticated.
 *
 * Query parameters:
 *   - epsilon   (optional, 0.01–5.0)    Privacy parameter. Smaller = stronger
 *                                       privacy. Default: 1.0.
 *   - minN      (optional, 1–1000)      Suppress cells with fewer than this
 *                                       many contributing entries. Default: 5.
 *
 * Responses:
 *   200  { success, data: { epsilon, budget..., days: [...] } }
 *   429  budget exhausted for this dataset (try again after admin reset)
 *   500  internal error
 */
const getMoodByDayOfWeek = async (req, res, next) => {
  try {
    const opts = {};
    if (req.query.epsilon != null) opts.epsilon = parseFloat(req.query.epsilon);
    if (req.query.minN    != null) opts.minN    = parseInt(req.query.minN, 10);

    const result = await cohortInsightsService.getAverageMoodByDayOfWeek(opts);

    logger.info('Cohort mood-by-dow released', {
      userId: req.user && req.user.userId,
      epsilon: result.epsilon,
      spent: result.budgetSpentForScope
    });

    res.json({ success: true, data: result });
  } catch (err) {
    // Map budget exhaustion to 429 (semantically: rate-limited by privacy).
    if (err && err.message && err.message.includes('PrivacyBudget exhausted')) {
      logger.warn('Cohort query refused — privacy budget exhausted', {
        userId: req.user && req.user.userId,
        error: err.message
      });
      return res.status(429).json({
        success: false,
        message: 'Privacy budget exhausted for this aggregate. Reset by an administrator is required.'
      });
    }
    logger.error('Cohort mood-by-dow error', {
      userId: req.user && req.user.userId,
      error: err && err.message
    });
    next(err);
  }
};

module.exports = { getMoodByDayOfWeek };

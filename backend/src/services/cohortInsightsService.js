const db = require('../config/database');
const logger = require('../config/logger');
const { addLaplaceNoise, sensitivity, PrivacyBudget } = require('./differentialPrivacy');

/**
 * cohortInsightsService — privacy-preserving aggregate statistics
 * computed across all users, released under ε-differential privacy.
 *
 * The first endpoint exposed here: average mood by day-of-week.
 * Each day-of-week is a disjoint partition of the data, so by parallel
 * composition the privacy cost of one query is ε (not 7ε).
 *
 * Small-cell suppression: groups with fewer than `minN` contributing
 * mood entries are returned as `suppressed: true` with null mean.
 * For very small n the Laplace noise scale (9/n / ε) dominates and
 * publishing the result is both unsafe and uninformative.
 */

const MOOD_MIN = 1;
const MOOD_MAX = 10;
const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SCOPE = 'cohort:mood_by_dow';
const DEFAULT_TOTAL_EPSILON = 10;
const DEFAULT_QUERY_EPSILON = 1.0;
const DEFAULT_MIN_N = 5;

// Process-wide singleton — privacy budgets must NOT reset per-request,
// otherwise an attacker can wash out the budget by reconnecting.
// Persisted on process restart; this is a known limitation and is
// documented in ADR-0005.
const _budget = new PrivacyBudget({ totalEpsilon: DEFAULT_TOTAL_EPSILON });

/**
 * Average mood by day-of-week, with ε-Laplace noise per group.
 *
 * @param {Object} [opts]
 * @param {number} [opts.epsilon=1.0]   ε per query. Smaller = stronger privacy.
 * @param {number} [opts.minN=5]        Suppress groups with fewer than this many entries.
 * @returns {Promise<{epsilon, budgetSpentForScope, budgetRemainingForScope,
 *                    budgetTotal, minN, moodRange, method, days}>}
 */
const getAverageMoodByDayOfWeek = async ({
  epsilon = DEFAULT_QUERY_EPSILON,
  minN    = DEFAULT_MIN_N
} = {}) => {
  if (!(epsilon > 0))      throw new Error('cohortInsightsService: epsilon must be > 0');
  if (!(minN >= 1))        throw new Error('cohortInsightsService: minN must be >= 1');

  // Reserve budget BEFORE the query. If consume throws, no data is read
  // (avoids leaking dataset state through timing-of-failure).
  _budget.consume(SCOPE, epsilon);

  const r = await db.query(`
    SELECT EXTRACT(DOW FROM entry_date)::int AS dow,
           COUNT(*)                          AS n,
           AVG(mood_score)::float            AS mean_mood
      FROM mood_entries
     WHERE mood_score IS NOT NULL
     GROUP BY dow
     ORDER BY dow
  `);

  const byDow = new Map();
  for (const row of r.rows) {
    byDow.set(Number(row.dow), { n: Number(row.n), trueMean: Number(row.mean_mood) });
  }

  const days = [];
  for (let dow = 0; dow < 7; dow++) {
    const cell = byDow.get(dow);
    if (!cell || cell.n < minN) {
      days.push({
        dayOfWeek: dow,
        dayLabel:  DOW_LABELS[dow],
        n:         cell ? cell.n : 0,
        noisyAverage: null,
        suppressed: true,
        reason: cell ? `n=${cell.n} below minN=${minN}` : 'no data'
      });
      continue;
    }
    const s = sensitivity.meanOnBounded(MOOD_MIN, MOOD_MAX, cell.n);
    const noisy = addLaplaceNoise(cell.trueMean, s, epsilon);
    // Clamp to the bounded mood domain. Post-processing of a DP release
    // does not weaken the privacy guarantee.
    const clamped = Math.max(MOOD_MIN, Math.min(MOOD_MAX, noisy));
    days.push({
      dayOfWeek: dow,
      dayLabel:  DOW_LABELS[dow],
      n:         cell.n,
      noisyAverage: Number(clamped.toFixed(2)),
      suppressed: false
    });
  }

  logger.info('Cohort mood-by-DOW released', {
    epsilon,
    minN,
    spent: _budget.spent(SCOPE),
    cellsPublished: days.filter(d => !d.suppressed).length
  });

  return {
    epsilon,
    budgetSpentForScope:     Number(_budget.spent(SCOPE).toFixed(6)),
    budgetRemainingForScope: Number(_budget.remaining(SCOPE).toFixed(6)),
    budgetTotal:             _budget.total(),
    minN,
    moodRange: { min: MOOD_MIN, max: MOOD_MAX },
    method:    'Laplace mechanism, per-DOW parallel composition',
    days
  };
};

/** Admin/test-only: reset the cohort budget. NOT exposed via HTTP. */
const _resetBudget = () => _budget.reset(SCOPE);

module.exports = {
  getAverageMoodByDayOfWeek,
  // Exported for testing only.
  _internal: { budget: _budget, SCOPE, resetBudget: _resetBudget, MOOD_MIN, MOOD_MAX }
};

/**
 * forecastMetrics — pure scoring functions for probabilistic mood forecasts
 * (A.4, ADR-0016). Point metrics on the median plus proper probabilistic metrics
 * (pinball loss per quantile, a quantile-based CRPS approximation, and interval
 * calibration), so a Chronos-vs-regression comparison is judged on its bands, not
 * only its point forecast.
 *
 * All functions take plain numeric arrays of equal length and never touch I/O.
 */

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

function assertSameLength(...arrays) {
  const n = arrays[0].length;
  for (const a of arrays) {
    if (!Array.isArray(a) || a.length !== n) {
      throw new Error('forecastMetrics: arrays must be equal-length');
    }
  }
  return n;
}

/** Mean absolute error. */
function mae(actuals, preds) {
  assertSameLength(actuals, preds);
  return mean(actuals.map((a, i) => Math.abs(a - preds[i])));
}

/** Root mean squared error. */
function rmse(actuals, preds) {
  assertSameLength(actuals, preds);
  return Math.sqrt(mean(actuals.map((a, i) => (a - preds[i]) ** 2)));
}

/**
 * Pinball (quantile) loss at level tau in (0,1). Lower is better; it rewards a
 * quantile forecast for being calibrated at that level.
 */
function pinballLoss(actuals, quantilePreds, tau) {
  assertSameLength(actuals, quantilePreds);
  return mean(
    actuals.map((a, i) => {
      const q = quantilePreds[i];
      return a >= q ? tau * (a - q) : (1 - tau) * (q - a);
    })
  );
}

/** Fraction of actuals that fall within [lows, highs] (empirical interval coverage). */
function intervalCoverage(actuals, lows, highs) {
  const n = assertSameLength(actuals, lows, highs);
  if (n === 0) return NaN;
  let inside = 0;
  for (let i = 0; i < n; i += 1) {
    if (actuals[i] >= lows[i] && actuals[i] <= highs[i]) inside += 1;
  }
  return inside / n;
}

/**
 * CRPS approximated from a small set of quantiles as the mean pinball loss across
 * them (the standard quantile-decomposition approximation). With only p10/p50/p90
 * this is coarse; it is documented as an approximation, not exact CRPS.
 */
function crpsFromQuantiles(actuals, { p10, p50, p90 }) {
  const levels = [
    [0.1, p10],
    [0.5, p50],
    [0.9, p90],
  ];
  return mean(levels.map(([tau, preds]) => pinballLoss(actuals, preds, tau)));
}

/**
 * Full scorecard for one forecast against the realised values.
 * Point metrics use p50; coverage uses the p10..p90 interval (nominal 80%).
 * @returns {{n, mae, rmse, pinball10, pinball50, pinball90, crps, coverage80}}
 */
function summarize(actuals, { p10, p50, p90 }) {
  assertSameLength(actuals, p10, p50, p90);
  return {
    n: actuals.length,
    mae: mae(actuals, p50),
    rmse: rmse(actuals, p50),
    pinball10: pinballLoss(actuals, p10, 0.1),
    pinball50: pinballLoss(actuals, p50, 0.5),
    pinball90: pinballLoss(actuals, p90, 0.9),
    crps: crpsFromQuantiles(actuals, { p10, p50, p90 }),
    coverage80: intervalCoverage(actuals, p10, p90),
  };
}

module.exports = { mae, rmse, pinballLoss, intervalCoverage, crpsFromQuantiles, summarize };

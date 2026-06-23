/**
 * forecastEvalService — offline A/B harness comparing the Chronos forecaster
 * against the univariate regression baseline on held-out mood windows (A.4,
 * ADR-0016).
 *
 * For each series it holds out the last `horizon` days, forecasts them with both
 * engines from the same training prefix, and scores both with forecastMetrics
 * (point + probabilistic). Chronos is injected as `chronosFn` so this module is
 * testable without the Python stack; a Chronos failure is RECORDED, never silently
 * replaced by the regression engine (which would invalidate the comparison).
 *
 * Pure orchestration: no DB, no I/O. The script wires in real data + the real
 * Chronos call.
 */

const metrics = require('../utils/forecastMetrics');
const baseline = require('../utils/univariateRegressionForecaster');

/** Split a series into a training prefix and the held-out last `horizon` values. */
function splitSeries(series, horizon) {
  const test = series.slice(series.length - horizon);
  const train = series.slice(0, series.length - horizon);
  return { train, test };
}

const METRIC_KEYS = ['mae', 'rmse', 'pinball10', 'pinball50', 'pinball90', 'crps', 'coverage80'];

function aggregate(scorecards) {
  const valid = scorecards.filter(Boolean);
  if (valid.length === 0) return null;
  const out = { n: valid.length };
  for (const k of METRIC_KEYS) {
    out[k] = valid.reduce((acc, s) => acc + s[k], 0) / valid.length;
  }
  return out;
}

/**
 * Evaluate one series.
 * @param {number[]} series
 * @param {number} horizon
 * @param {(train:number[], horizon:number)=>Promise<{p10,p50,p90}>} chronosFn
 */
async function evalSeries(series, horizon, chronosFn) {
  const { train, test } = splitSeries(series, horizon);

  const baseForecast = baseline.forecast(train, horizon);
  const baselineScore = metrics.summarize(test, baseForecast);

  let chronosScore = null;
  let chronosAvailable = false;
  let chronosError = null;
  try {
    const cf = await chronosFn(train, horizon);
    if (!cf || !Array.isArray(cf.p50) || cf.p50.length !== horizon) {
      throw new Error('chronos returned no usable p50 of the expected length');
    }
    // If a quantile is missing, fall back to the median for that band only.
    const p10 = (cf.p10 && cf.p10.length === horizon) ? cf.p10 : cf.p50;
    const p90 = (cf.p90 && cf.p90.length === horizon) ? cf.p90 : cf.p50;
    chronosScore = metrics.summarize(test, { p10, p50: cf.p50, p90 });
    chronosAvailable = true;
  } catch (err) {
    chronosError = err.message;
  }

  return {
    trainLen: train.length,
    horizon,
    baseline: baselineScore,
    chronos: chronosScore,
    chronosAvailable,
    chronosError,
  };
}

/**
 * Run the harness over many series.
 * @param {object} args
 * @param {number[][]} args.seriesList
 * @param {number} [args.horizon=7]
 * @param {number} [args.minHistory=30]   minimum training length required
 * @param {Function} args.chronosFn
 * @returns {Promise<object>} report
 */
async function runEval({ seriesList, horizon = 7, minHistory = 30, chronosFn }) {
  const usable = [];
  let skipped = 0;
  for (const s of seriesList) {
    if (Array.isArray(s) && s.length >= minHistory + horizon) usable.push(s);
    else skipped += 1;
  }

  const perSeries = [];
  for (const s of usable) {
    /* eslint-disable no-await-in-loop */ // sequential on purpose: Chronos spawn is heavy
    perSeries.push(await evalSeries(s, horizon, chronosFn));
  }

  const chronosEvaluated = perSeries.filter((r) => r.chronosAvailable).length;

  return {
    config: { horizon, minHistory, nProvided: seriesList.length },
    nEvaluated: usable.length,
    nSkipped: skipped,
    chronosEvaluated,
    chronosUnavailable: usable.length - chronosEvaluated,
    aggregate: {
      baseline: aggregate(perSeries.map((r) => r.baseline)),
      chronos: aggregate(perSeries.filter((r) => r.chronosAvailable).map((r) => r.chronos)),
    },
    perSeries,
  };
}

module.exports = { runEval, evalSeries, splitSeries, aggregate, METRIC_KEYS };

/**
 * univariateRegressionForecaster — a faithful UNIVARIATE re-implementation of the
 * production predictive engine's core method (A.4, ADR-0016).
 *
 * The production `predictiveEngineService` fits a weighted linear regression with
 * exponential decay (recent data weighted more, decayRate 0.03) but over a
 * MULTIVARIATE design matrix (mood + sleep + weather + voice + EMA) and is fully
 * DB/userId-bound — it has no series-in entry point, so it cannot be held out on a
 * raw mood window. For an equal-inputs A/B against Chronos (which is univariate),
 * this reproduces the same regression method on the mood signal alone: fit
 * mood ~ a + b·t with the same exponential-decay weighting, forecast the horizon,
 * and derive p10/p50/p90 from the weighted residual spread.
 *
 * Pure: numbers in, {p10,p50,p90} out. No I/O.
 */

const DECAY_RATE = 0.03; // matches predictiveEngineService
const Z80 = 1.2816; // z for the central 80% interval (p10..p90)
const MIN_SIGMA = 0.25; // floor so bands never collapse on a perfect in-sample fit
const clampMood = (v) => Math.min(10, Math.max(1, v));

/**
 * @param {number[]} series  chronological mood values (one per day)
 * @param {number}   horizon number of days to forecast
 * @param {object}   [opts]  { decayRate, z }
 * @returns {{p10:number[], p50:number[], p90:number[]}}
 */
function forecast(series, horizon, opts = {}) {
  const decayRate = opts.decayRate ?? DECAY_RATE;
  const z = opts.z ?? Z80;
  const ys = (series || []).map(Number).filter((n) => Number.isFinite(n));
  const n = ys.length;

  // Degenerate: <2 points -> flat forecast at the last value (or 5.5 if none).
  if (n < 2) {
    const flat = clampMood(n === 1 ? ys[0] : 5.5);
    const sigma = 1.0;
    return bands(Array(horizon).fill(flat), sigma, z);
  }

  // Exponential-decay weights: most recent point (i = n-1) has weight 1.
  const w = ys.map((_, i) => Math.exp(-decayRate * (n - 1 - i)));
  const t = ys.map((_, i) => i);

  const Sw = sum(w);
  const Swx = sum(w.map((wi, i) => wi * t[i]));
  const Swy = sum(w.map((wi, i) => wi * ys[i]));
  const Swxx = sum(w.map((wi, i) => wi * t[i] * t[i]));
  const Swxy = sum(w.map((wi, i) => wi * t[i] * ys[i]));

  const denom = Sw * Swxx - Swx * Swx;
  let b;
  let a;
  if (Math.abs(denom) < 1e-9) {
    // No spread in t (shouldn't happen for n>=2 distinct t) -> intercept-only.
    b = 0;
    a = Swy / Sw;
  } else {
    b = (Sw * Swxy - Swx * Swy) / denom;
    a = (Swy - b * Swx) / Sw;
  }

  // Weighted residual standard deviation -> band half-width.
  const wResidSq = w.map((wi, i) => wi * (ys[i] - (a + b * t[i])) ** 2);
  const sigma = Math.max(MIN_SIGMA, Math.sqrt(sum(wResidSq) / Sw));

  const p50 = [];
  for (let h = 1; h <= horizon; h += 1) {
    p50.push(a + b * (n - 1 + h));
  }
  return bands(p50, sigma, z);
}

function bands(p50raw, sigma, z) {
  const p50 = p50raw.map(clampMood);
  const p10 = p50raw.map((m) => clampMood(m - z * sigma));
  const p90 = p50raw.map((m) => clampMood(m + z * sigma));
  return { p10, p50, p90 };
}

const sum = (xs) => xs.reduce((acc, v) => acc + v, 0);

module.exports = { forecast, DECAY_RATE };

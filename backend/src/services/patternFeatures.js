/**
 * patternFeatures — turn a user's recent daily mood series into a fixed-length,
 * scale-normalised feature vector for the peer-similarity embedding (A.3).
 *
 * Pure and dependency-free. No I/O; unit-testable in isolation.
 *
 * A "pattern" is the SHAPE + summary statistics of ~30 days of mood, not the
 * raw scores: two users at different absolute levels but the same rhythm should
 * land near each other in embedding space. So the vector combines
 *   (a) a resampled, mean-centred mood CURVE (rhythm, level-invariant), and
 *   (b) interpretable summary STATS (level, variability, trend, lag-1
 *       autocorrelation, extrema timing, low-mood streak).
 *
 * Mood scores are on the 1..5 clinical scale; everything here is normalised to
 * roughly [-1, 1] so the downstream encoder sees a well-conditioned input.
 */

const MOOD_MIN = 1;
const MOOD_MAX = 5;
const CURVE_POINTS = 8;
const MIN_KNOWN = 4; // fewer real observations than this cannot characterise a pattern
const LOW_MOOD = 0.375; // normalised threshold (~mood 2.5) for the low-streak feature

const norm = (m) => (m - MOOD_MIN) / (MOOD_MAX - MOOD_MIN); // 1..5 -> 0..1

/**
 * Fill nulls in a series by linear interpolation between known points, with
 * nearest-value fill for leading/trailing gaps. Returns null if too few points.
 */
function fillGaps(series) {
  const idx = [];
  for (let i = 0; i < series.length; i += 1) {
    if (series[i] !== null && series[i] !== undefined && Number.isFinite(series[i])) idx.push(i);
  }
  if (idx.length < MIN_KNOWN) return null;
  const out = series.slice();
  // interior interpolation
  for (let k = 0; k < idx.length - 1; k += 1) {
    const a = idx[k];
    const b = idx[k + 1];
    const va = series[a];
    const vb = series[b];
    for (let i = a + 1; i < b; i += 1) {
      out[i] = va + ((vb - va) * (i - a)) / (b - a);
    }
  }
  // leading / trailing fill
  for (let i = 0; i < idx[0]; i += 1) out[i] = series[idx[0]];
  for (let i = idx[idx.length - 1] + 1; i < series.length; i += 1) out[i] = series[idx[idx.length - 1]];
  return out;
}

/** Linear-interpolate a dense series to exactly n points. */
function resample(series, n) {
  if (series.length === n) return series.slice();
  if (series.length === 1) return new Array(n).fill(series[0]);
  const out = new Array(n);
  for (let j = 0; j < n; j += 1) {
    const t = (j * (series.length - 1)) / (n - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, series.length - 1);
    out[j] = series[lo] + (series[hi] - series[lo]) * (t - lo);
  }
  return out;
}

function mean(a) {
  return a.reduce((s, x) => s + x, 0) / a.length;
}

function std(a, mu) {
  const m = mu === undefined ? mean(a) : mu;
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length);
}

/** Ordinary-least-squares slope of `a` against its index, per-step. */
function slope(a) {
  const n = a.length;
  const xm = (n - 1) / 2;
  const ym = mean(a);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (i - xm) * (a[i] - ym);
    den += (i - xm) * (i - xm);
  }
  return den === 0 ? 0 : num / den;
}

/** Lag-1 autocorrelation of a mean-centred series (0 when flat). */
function autocorr1(centered) {
  let num = 0;
  let den = 0;
  for (let i = 0; i < centered.length; i += 1) den += centered[i] * centered[i];
  for (let i = 0; i < centered.length - 1; i += 1) num += centered[i] * centered[i + 1];
  return den === 0 ? 0 : num / den;
}

/** Longest run (as a fraction of length) with normalised mood below LOW_MOOD. */
function lowStreak(s) {
  let best = 0;
  let cur = 0;
  for (let i = 0; i < s.length; i += 1) {
    if (s[i] < LOW_MOOD) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best / s.length;
}

/**
 * Extract the fixed-length feature vector from a daily mood series.
 *
 * @param {Array<number|null>} dailyMoods oldest→newest, 1..5, null = missing day
 * @param {object} [opts]
 * @param {number} [opts.curvePoints=CURVE_POINTS]
 * @returns {number[]|null} feature vector, or null if the series is too sparse
 */
function extractFeatures(dailyMoods, { curvePoints = CURVE_POINTS } = {}) {
  if (!Array.isArray(dailyMoods)) return null;
  const filled = fillGaps(dailyMoods);
  if (filled === null) return null;

  const s = filled.map(norm); // normalised 0..1 series
  const mu = mean(s);
  const centered = s.map((x) => x - mu);

  let peak = 0;
  let trough = 0;
  for (let i = 1; i < s.length; i += 1) {
    if (s[i] > s[peak]) peak = i;
    if (s[i] < s[trough]) trough = i;
  }
  const denomPos = s.length > 1 ? s.length - 1 : 1;

  const stats = [
    mu * 2 - 1, // level, centred to [-1,1]
    Math.min(1, std(s, mu) * 4) * 2 - 1, // variability (std ~0..0.5 -> [-1,1])
    Math.max(-1, Math.min(1, slope(s) * 20)), // per-step trend, clipped
    autocorr1(centered), // already in [-1,1]
    Math.min(...s) * 2 - 1, // min
    Math.max(...s) * 2 - 1, // max
    (Math.max(...s) - Math.min(...s)) * 2 - 1, // range
    (peak / denomPos) * 2 - 1, // peak position
    (trough / denomPos) * 2 - 1, // trough position
    lowStreak(s) * 2 - 1, // low-mood streak
  ];

  // Rhythm curve: resample the mean-centred series (level-invariant) and scale.
  const curve = resample(centered, curvePoints).map((x) => Math.max(-1, Math.min(1, x * 4)));

  return stats.concat(curve);
}

/** Length of the vector `extractFeatures` returns for the default options. */
const FEATURE_DIM = 10 + CURVE_POINTS;

module.exports = {
  extractFeatures,
  FEATURE_DIM,
  CURVE_POINTS,
  MIN_KNOWN,
  _internal: { fillGaps, resample, mean, std, slope, autocorr1, lowStreak, norm },
};

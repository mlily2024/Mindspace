/**
 * crisisFeatures — engineered features for the crisis-trajectory early-warning
 * model (D.1, ADR-0019). Pure: a recent mood window in, a fixed feature vector out.
 *
 * Features have clinical lineage (deterioration + instability precede crisis;
 * Mohr et al., JITAI literature): recent level, trend (slope), variability, the
 * worst point, the drop from an earlier baseline, and a trailing low-mood streak.
 *
 * This is engineered-feature input for an interpretable logistic regression — NOT
 * a deep model — chosen because it is data-frugal and inspectable, which matters
 * for a safety-adjacent signal. It never reads or affects the SafetyFilter.
 */

const CRISIS_FEATURE_DIM = 8;
const LOW_MOOD = 3; // on the 1..10 scale, a trailing run at/below this is a warning
const MIN_WINDOW = 5;

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function slope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (values[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function std(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/**
 * @param {number[]} window chronological mood values (1..10), most recent last
 * @returns {number[]} length CRISIS_FEATURE_DIM, leading bias term
 */
function extractFeatures(window) {
  const vals = (window || []).map(Number).filter((n) => Number.isFinite(n));
  if (vals.length < MIN_WINDOW) {
    throw new Error(`crisisFeatures: need at least ${MIN_WINDOW} points`);
  }

  const half = Math.floor(vals.length / 2);
  const baseline = mean(vals.slice(0, half)); // earlier
  const recent = mean(vals.slice(half)); // later
  const drop = baseline - recent; // positive = worsening

  let streak = 0;
  for (let i = vals.length - 1; i >= 0; i -= 1) {
    if (vals[i] <= LOW_MOOD) streak += 1;
    else break;
  }

  const last = vals[vals.length - 1];
  const minV = Math.min(...vals);

  // Normalised so logistic-regression weights are comparably scaled.
  return [
    1, // bias
    mean(vals) / 10,
    slope(vals) / 10, // per-day change, can be negative
    std(vals) / 10,
    minV / 10,
    drop / 10, // positive = deteriorating
    streak / vals.length,
    last / 10,
  ];
}

module.exports = { extractFeatures, slope, std, CRISIS_FEATURE_DIM, LOW_MOOD, MIN_WINDOW };

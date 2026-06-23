/**
 * crisisEarlyWarning — adjunct crisis-trajectory early-warning (D.1, ADR-0019).
 *
 * An interpretable logistic-regression risk model over engineered mood-window
 * features (see crisisFeatures), PLUS an AUGMENT-ONLY combiner that is the whole
 * safety contract of this feature.
 *
 * SAFETY INVARIANTS (pinned by tests):
 *   - This module never imports, calls, gates, or modifies the SafetyFilter
 *     (ADR-0003). The caller passes the SafetyFilter's boolean verdict in.
 *   - The combiner can only ever RAISE caution, never lower it: its output is at
 *     least the SafetyFilter floor.
 *   - The model alone can never assert 'crisis' — that level is reserved for the
 *     SafetyFilter. The model can only raise 'none' -> 'watch' / 'elevated'.
 *
 * This is an ADJUNCT screen, offline and NOT wired into any live alerting path in
 * this cut (live use needs clinical sign-off). It augments; it never replaces the
 * keyword crisis floor.
 */

// Ordered severity ladder. The model may reach at most 'elevated'.
const LEVELS = ['none', 'watch', 'elevated', 'crisis'];
const WATCH_THRESHOLD = 0.4;
const ELEVATED_THRESHOLD = 0.7;

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const dot = (a, b) => a.reduce((s, ai, i) => s + ai * b[i], 0);

/**
 * Train logistic regression by full-batch gradient descent (deterministic:
 * weights init to 0, no randomness). x vectors include a leading bias term.
 * @returns {{w:number[]}}
 */
function train(X, y, { epochs = 400, lr = 0.3, l2 = 1e-3 } = {}) {
  if (X.length === 0) throw new Error('crisisEarlyWarning.train: no data');
  const d = X[0].length;
  const w = new Array(d).fill(0);
  const n = X.length;
  for (let e = 0; e < epochs; e += 1) {
    const grad = new Array(d).fill(0);
    for (let i = 0; i < n; i += 1) {
      const err = sigmoid(dot(w, X[i])) - y[i];
      for (let j = 0; j < d; j += 1) grad[j] += err * X[i][j];
    }
    for (let j = 0; j < d; j += 1) {
      // No L2 on the bias term (index 0).
      const reg = j === 0 ? 0 : l2 * w[j];
      w[j] -= lr * (grad[j] / n + reg);
    }
  }
  return { w };
}

/** Risk probability in [0,1]. */
function predictRisk(model, x) {
  return sigmoid(dot(model.w, x));
}

/** Model-only level — capped at 'elevated' (never 'crisis'). */
function riskLevel(risk) {
  if (risk >= ELEVATED_THRESHOLD) return 'elevated';
  if (risk >= WATCH_THRESHOLD) return 'watch';
  return 'none';
}

const rank = (lvl) => LEVELS.indexOf(lvl);

/**
 * AUGMENT-ONLY combination of the SafetyFilter verdict and the model risk.
 * Output is max(SafetyFilter floor, model level); the model can never lower the
 * floor and can never reach 'crisis' on its own.
 *
 * @param {boolean} safetyIsCrisis  the SafetyFilter's verdict (caller-supplied)
 * @param {number}  risk            model risk in [0,1]
 * @returns {{level:string, source:string, modelRisk:number, floor:string}}
 */
function assessAugmented(safetyIsCrisis, risk) {
  const floor = safetyIsCrisis ? 'crisis' : 'none';
  const modelLevel = riskLevel(risk); // <= 'elevated' by construction
  const level = rank(modelLevel) > rank(floor) ? modelLevel : floor;
  return {
    level,
    floor,
    modelRisk: risk,
    // Attribution: did the model raise caution above the SafetyFilter floor?
    source: level === floor ? 'safety_filter' : 'model_adjunct',
  };
}

module.exports = {
  train,
  predictRisk,
  riskLevel,
  assessAugmented,
  sigmoid,
  LEVELS,
  WATCH_THRESHOLD,
  ELEVATED_THRESHOLD,
};

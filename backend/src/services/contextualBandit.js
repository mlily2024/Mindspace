/**
 * contextualBandit — disjoint LinUCB contextual bandit (C.1, ADR-0018).
 *
 * Pure, dependency-free. Per-arm ridge regression with an upper-confidence
 * exploration bonus (Li et al. 2010, "A Contextual-Bandit Approach to
 * Personalized News Article Recommendation"):
 *
 *   theta_a = A_a^{-1} b_a
 *   p_a     = theta_a . x  +  alpha * sqrt( x^T A_a^{-1} x )
 *   pick argmax_a p_a
 *   on reward r: A_a += x x^T ;  b_a += r x
 *
 * State is a plain serialisable object so it can be persisted per user (or
 * pooled) when the feature is wired live; this module is the algorithm only and
 * touches no I/O, so it is unit-testable against a synthetic environment.
 */

function identity(d) {
  const M = [];
  for (let i = 0; i < d; i += 1) {
    M.push(new Array(d).fill(0));
    M[i][i] = 1;
  }
  return M;
}

/** Inverse of a small square matrix via Gauss-Jordan elimination. */
function invert(M) {
  const n = M.length;
  // Augment [M | I].
  const A = M.map((row, i) => row.concat(identity(n)[i]));
  for (let col = 0; col < n; col += 1) {
    // Partial pivot.
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    if (Math.abs(A[pivot][col]) < 1e-12) throw new Error('contextualBandit: singular matrix');
    [A[col], A[pivot]] = [A[pivot], A[col]];

    const div = A[col][col];
    for (let j = 0; j < 2 * n; j += 1) A[col][j] /= div;

    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = A[r][col];
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j += 1) A[r][j] -= factor * A[col][j];
    }
  }
  return A.map((row) => row.slice(n));
}

const matVec = (M, v) => M.map((row) => row.reduce((s, m, j) => s + m * v[j], 0));
const dot = (a, b) => a.reduce((s, ai, i) => s + ai * b[i], 0);

/** @returns {{d:number, alpha:number, arms:Object}} a fresh bandit. */
function createBandit(d, { alpha = 1.0 } = {}) {
  if (!(d > 0)) throw new Error('contextualBandit: dimension must be positive');
  return { d, alpha, arms: {} };
}

function ensureArm(state, armId) {
  if (!state.arms[armId]) {
    state.arms[armId] = { A: identity(state.d), b: new Array(state.d).fill(0) };
  }
  return state.arms[armId];
}

/** UCB score for one arm given context x. */
function scoreArm(state, armId, x) {
  const arm = ensureArm(state, armId);
  const Ainv = invert(arm.A);
  const theta = matVec(Ainv, arm.b);
  const mean = dot(theta, x);
  const variance = dot(x, matVec(Ainv, x));
  return mean + state.alpha * Math.sqrt(Math.max(0, variance));
}

/**
 * Recommend an arm for context x.
 * @returns {{arm:string, scores:Object<string,number>}}
 */
function recommend(state, armIds, x) {
  if (!armIds || armIds.length === 0) throw new Error('contextualBandit: no arms');
  const scores = {};
  let best = null;
  let bestScore = -Infinity;
  for (const id of armIds) {
    const s = scoreArm(state, id, x);
    scores[id] = s;
    if (s > bestScore) {
      bestScore = s;
      best = id;
    }
  }
  return { arm: best, scores };
}

/** Observe reward r for pulling `armId` under context x; updates the arm in place. */
function update(state, armId, x, reward) {
  const arm = ensureArm(state, armId);
  for (let i = 0; i < state.d; i += 1) {
    for (let j = 0; j < state.d; j += 1) arm.A[i][j] += x[i] * x[j];
    arm.b[i] += reward * x[i];
  }
  return state;
}

module.exports = { createBandit, recommend, update, scoreArm, invert, _internal: { matVec, dot, identity } };

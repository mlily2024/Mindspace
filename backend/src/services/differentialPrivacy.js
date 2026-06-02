const crypto = require('crypto');

/**
 * differentialPrivacy — (ε, 0)-DP mechanism + privacy-budget tracker.
 *
 * Implements the Laplace mechanism: to release a query result f(D) on
 * a dataset D with global sensitivity Δf, we publish
 *
 *     f(D) + Lap(0, Δf / ε)
 *
 * which satisfies ε-differential privacy. ε is the privacy parameter
 * (smaller = stronger privacy). A budget tracker accumulates ε across
 * queries within a named scope and refuses further queries when the
 * configured total is exhausted (sequential-composition bound).
 *
 * Randomness: drawn from `crypto.randomBytes` rather than Math.random.
 * Math.random is not suitable for DP — it is seeded predictably and
 * has insufficient entropy. crypto.randomBytes is CSPRNG-backed.
 *
 * Sensitivity:
 *   - count       Δf = 1
 *   - sum     of values in [a, b]    Δf = b - a
 *   - mean    of values in [a, b]    Δf = (b - a) / n
 *   - histogram (disjoint bins)      Δf = 1 per bin (parallel composition)
 *
 * For composition rules and the bigger picture, see the references in
 * ADR-0005.
 */

// 48 bits of randomness is well above what DP needs and stays inside the
// safe-integer range without BigInt or bitwise (which is 32-bit in JS).
const SCALE_48 = 0x1000000000000;           // 2^48

/** Cryptographic uniform draw in [0, 1) with 48-bit precision. */
const uniform01 = () => {
  const buf = crypto.randomBytes(6);
  let n = 0;
  for (const byte of buf) n = n * 256 + byte;
  return n / SCALE_48;
};

/**
 * Inverse-CDF Laplace sampler.
 *
 *   X = -scale * sign(u) * ln(1 - 2|u|),   u ~ Uniform(-0.5, +0.5)
 *
 * @param {number} scale   Laplace scale (b). scale > 0.
 * @returns {number} A single sample from Lap(0, scale).
 */
const laplaceSample = (scale) => {
  if (!(scale > 0)) {
    throw new Error('laplaceSample: scale must be > 0');
  }
  // u in (-0.5, +0.5). Clip very small epsilon to avoid log(0) at u=±0.5.
  const u = uniform01() - 0.5;
  const clipped = Math.max(-0.4999999999, Math.min(0.4999999999, u));
  return -scale * Math.sign(clipped) * Math.log(1 - 2 * Math.abs(clipped));
};

/**
 * Add Laplace noise calibrated for ε-DP to a numeric query result.
 *
 * @param {number} value         Raw query result f(D).
 * @param {number} sensitivity   Global sensitivity Δf. Must be > 0.
 * @param {number} epsilon       Privacy parameter. Must be > 0.
 * @returns {number} value + Lap(0, sensitivity / epsilon).
 */
const addLaplaceNoise = (value, sensitivity, epsilon) => {
  if (!Number.isFinite(value))             throw new Error('addLaplaceNoise: value must be finite');
  if (!(sensitivity > 0))                  throw new Error('addLaplaceNoise: sensitivity must be > 0');
  if (!(epsilon > 0))                      throw new Error('addLaplaceNoise: epsilon must be > 0');
  return value + laplaceSample(sensitivity / epsilon);
};

/** Standard sensitivities for common bounded-domain aggregates. */
const sensitivity = Object.freeze({
  count:                   ()           => 1,
  sumOnBounded:            (lo, hi)     => hi - lo,
  meanOnBounded:           (lo, hi, n)  => (n > 0 ? (hi - lo) / n : Infinity)
});

/**
 * PrivacyBudget — tracks cumulative ε spent within a named scope.
 *
 * Sequential composition: the privacy guarantee of releasing the
 * results of k mechanisms with parameters ε₁, …, εₖ over the same
 * dataset is (Σ εᵢ)-DP. This class enforces Σ εᵢ ≤ totalEpsilon.
 *
 * Scope (namespace) is typically the dataset identifier — e.g.
 * 'cohort:mood_by_dow'. Different scopes have independent budgets
 * because they reference disjoint or independent data.
 */
class PrivacyBudget {

  /**
   * @param {Object} [opts]
   * @param {number} [opts.totalEpsilon=10]  Total ε allowed per scope.
   */
  constructor({ totalEpsilon = 10 } = {}) {
    if (!(totalEpsilon > 0)) {
      throw new Error('PrivacyBudget: totalEpsilon must be > 0');
    }
    this.totalEpsilon = totalEpsilon;
    this._spent = new Map();   // scope → ε spent
  }

  /** Total ε allowed for any scope. */
  total() { return this.totalEpsilon; }

  /** ε already spent on `scope`. */
  spent(scope) { return this._spent.get(scope) || 0; }

  /** Remaining ε for `scope`. */
  remaining(scope) { return Math.max(0, this.totalEpsilon - this.spent(scope)); }

  /**
   * Attempt to consume `epsilon` from `scope`. Throws if it would
   * exceed the total. Returns the new spent total on success.
   */
  consume(scope, epsilon) {
    if (!scope)                throw new Error('PrivacyBudget.consume: scope is required');
    if (!(epsilon > 0))        throw new Error('PrivacyBudget.consume: epsilon must be > 0');
    const next = this.spent(scope) + epsilon;
    if (next > this.totalEpsilon + 1e-12) {
      throw new Error(
        `PrivacyBudget exhausted for scope '${scope}': would spend ${next.toFixed(4)} ` +
        `of ${this.totalEpsilon.toFixed(4)} ε`
      );
    }
    this._spent.set(scope, next);
    return next;
  }

  /** Reset the budget for one scope (admin/testing). */
  reset(scope) { this._spent.delete(scope); }

  /** Reset every scope. */
  resetAll() { this._spent.clear(); }
}

module.exports = {
  laplaceSample,
  addLaplaceNoise,
  sensitivity,
  PrivacyBudget,
  // Exported for testing — the uniform sampler is the foundation.
  _internal: { uniform01 }
};

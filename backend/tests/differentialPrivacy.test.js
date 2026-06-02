/**
 * Tests for differentialPrivacy — Laplace mechanism + budget tracker.
 *
 * The DP mechanism is statistical, so we test its properties (mean,
 * spread, signature behaviour) rather than exact values. Sample sizes
 * are kept moderate so the suite runs in well under a second.
 */

const {
  laplaceSample,
  addLaplaceNoise,
  sensitivity,
  PrivacyBudget,
  _internal: { uniform01 }
} = require('../src/services/differentialPrivacy');

describe('uniform01()', () => {
  it('returns values in [0, 1)', () => {
    for (let i = 0; i < 2000; i++) {
      const u = uniform01();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it('has a sample mean near 0.5 over many draws', () => {
    let sum = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) sum += uniform01();
    const mean = sum / N;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe('laplaceSample(scale)', () => {
  it('throws for non-positive scale', () => {
    expect(() => laplaceSample(0)).toThrow();
    expect(() => laplaceSample(-1)).toThrow();
  });

  it('has empirical mean ≈ 0 over many draws (Laplace is zero-centred)', () => {
    let sum = 0;
    const N = 20_000;
    const scale = 1.0;
    for (let i = 0; i < N; i++) sum += laplaceSample(scale);
    const mean = sum / N;
    // Standard error of the mean ≈ scale * sqrt(2 / N) ≈ 0.01 here.
    // Bound generously so the test is not flaky.
    expect(Math.abs(mean)).toBeLessThan(0.05);
  });

  it('has empirical variance ≈ 2*scale² (the Laplace variance)', () => {
    const N = 20_000;
    const scale = 2.0;
    let sum = 0, sumSq = 0;
    for (let i = 0; i < N; i++) {
      const x = laplaceSample(scale);
      sum += x;
      sumSq += x * x;
    }
    const variance = sumSq / N - (sum / N) ** 2;
    // Expected variance = 2 * scale^2 = 8.
    // Sampling tolerance: ± ~15% at N=20k.
    expect(variance).toBeGreaterThan(8 * 0.85);
    expect(variance).toBeLessThan(8 * 1.15);
  });

  it('produces both positive and negative samples', () => {
    let pos = 0, neg = 0;
    for (let i = 0; i < 500; i++) {
      const x = laplaceSample(1);
      if (x > 0) pos++;
      else if (x < 0) neg++;
    }
    // Both sides should fire many times — Laplace is symmetric.
    expect(pos).toBeGreaterThan(150);
    expect(neg).toBeGreaterThan(150);
  });
});

describe('addLaplaceNoise()', () => {
  it('throws for invalid args', () => {
    expect(() => addLaplaceNoise('x',  1,   1)).toThrow();
    expect(() => addLaplaceNoise(NaN,  1,   1)).toThrow();
    expect(() => addLaplaceNoise(5,    0,   1)).toThrow();
    expect(() => addLaplaceNoise(5,   -1,   1)).toThrow();
    expect(() => addLaplaceNoise(5,    1,   0)).toThrow();
    expect(() => addLaplaceNoise(5,    1,  -1)).toThrow();
  });

  it('returned value is centred on the input over many draws', () => {
    const N = 10_000;
    const trueValue = 7.2;
    let sum = 0;
    for (let i = 0; i < N; i++) sum += addLaplaceNoise(trueValue, 1, 1);
    const mean = sum / N;
    expect(Math.abs(mean - trueValue)).toBeLessThan(0.05);
  });

  it('stronger privacy (smaller ε) ⇒ larger noise variance', () => {
    const N = 5_000;
    const trueValue = 0;
    const sensitivity = 1;

    let varEpsHigh = 0;   // ε = 5 (weak privacy)
    let varEpsLow  = 0;   // ε = 0.1 (strong privacy)
    for (let i = 0; i < N; i++) {
      varEpsHigh += addLaplaceNoise(trueValue, sensitivity, 5)   ** 2;
      varEpsLow  += addLaplaceNoise(trueValue, sensitivity, 0.1) ** 2;
    }
    varEpsHigh /= N; varEpsLow /= N;
    // Smaller ε must give materially larger spread.
    expect(varEpsLow).toBeGreaterThan(varEpsHigh * 50);
  });
});

describe('sensitivity helpers', () => {
  it('count sensitivity is 1', () => {
    expect(sensitivity.count()).toBe(1);
  });

  it('bounded-domain sum sensitivity is (hi - lo)', () => {
    expect(sensitivity.sumOnBounded(1, 10)).toBe(9);
  });

  it('bounded-domain mean sensitivity scales as (hi - lo) / n', () => {
    expect(sensitivity.meanOnBounded(1, 10, 9)).toBeCloseTo(1.0);
    expect(sensitivity.meanOnBounded(1, 10, 90)).toBeCloseTo(0.1);
  });

  it('mean sensitivity is Infinity when n = 0', () => {
    expect(sensitivity.meanOnBounded(1, 10, 0)).toBe(Infinity);
  });
});

describe('PrivacyBudget', () => {
  const SCOPE = 'cohort:mood_by_dow';

  it('rejects invalid totalEpsilon', () => {
    expect(() => new PrivacyBudget({ totalEpsilon: 0 })).toThrow();
    expect(() => new PrivacyBudget({ totalEpsilon: -1 })).toThrow();
  });

  it('initial spent is 0 and remaining is the total', () => {
    const b = new PrivacyBudget({ totalEpsilon: 5 });
    expect(b.spent(SCOPE)).toBe(0);
    expect(b.remaining(SCOPE)).toBe(5);
  });

  it('consume() accumulates ε and reports remaining', () => {
    const b = new PrivacyBudget({ totalEpsilon: 5 });
    b.consume(SCOPE, 1);
    b.consume(SCOPE, 1.5);
    expect(b.spent(SCOPE)).toBeCloseTo(2.5);
    expect(b.remaining(SCOPE)).toBeCloseTo(2.5);
  });

  it('consume() throws when the total would be exceeded', () => {
    const b = new PrivacyBudget({ totalEpsilon: 2 });
    b.consume(SCOPE, 1.5);
    expect(() => b.consume(SCOPE, 1.0)).toThrow(/exhausted/i);
    // The failed consume must NOT advance the spent total.
    expect(b.spent(SCOPE)).toBeCloseTo(1.5);
  });

  it('different scopes have independent budgets', () => {
    const b = new PrivacyBudget({ totalEpsilon: 3 });
    b.consume('a', 2);
    b.consume('b', 2);
    expect(b.spent('a')).toBe(2);
    expect(b.spent('b')).toBe(2);
    expect(b.remaining('a')).toBe(1);
    expect(b.remaining('b')).toBe(1);
  });

  it('consume() rejects bad args', () => {
    const b = new PrivacyBudget({ totalEpsilon: 5 });
    expect(() => b.consume('',     1)).toThrow(/scope/);
    expect(() => b.consume(SCOPE,  0)).toThrow(/epsilon/);
    expect(() => b.consume(SCOPE, -1)).toThrow(/epsilon/);
  });

  it('reset() clears one scope, resetAll() clears all', () => {
    const b = new PrivacyBudget({ totalEpsilon: 5 });
    b.consume('a', 1);
    b.consume('b', 1);
    b.reset('a');
    expect(b.spent('a')).toBe(0);
    expect(b.spent('b')).toBe(1);
    b.resetAll();
    expect(b.spent('b')).toBe(0);
  });

  it('exact-equality consumption is allowed (boundary case)', () => {
    const b = new PrivacyBudget({ totalEpsilon: 1 });
    b.consume('s', 1);
    expect(b.spent('s')).toBe(1);
    expect(b.remaining('s')).toBe(0);
    expect(() => b.consume('s', 0.0001)).toThrow();
  });
});

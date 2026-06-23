/**
 * Tests for crisisFeatures (D.1, ADR-0019) — engineered mood-window features.
 */
const { extractFeatures, slope, CRISIS_FEATURE_DIM, MIN_WINDOW } = require('../src/utils/crisisFeatures');

describe('crisisFeatures', () => {
  it('produces the fixed dimension with a leading bias term', () => {
    const f = extractFeatures([5, 5, 6, 5, 4, 5]);
    expect(f).toHaveLength(CRISIS_FEATURE_DIM);
    expect(f[0]).toBe(1);
  });

  it('a deteriorating window shows negative slope, a positive drop and a low trailing streak', () => {
    const f = extractFeatures([7, 6, 5, 4, 3, 2, 2, 1]);
    // [bias, mean/10, slope/10, std/10, min/10, drop/10, streakFrac, last/10]
    expect(f[2]).toBeLessThan(0); // slope negative
    expect(f[5]).toBeGreaterThan(0); // baseline - recent > 0 (worsening)
    expect(f[6]).toBeGreaterThan(0); // trailing low-mood streak present
  });

  it('a stable window shows ~zero slope and ~zero drop', () => {
    const f = extractFeatures([6, 6, 5, 6, 6, 5, 6, 6]);
    expect(Math.abs(f[2])).toBeLessThan(0.02);
    expect(Math.abs(f[5])).toBeLessThan(0.06);
  });

  it('slope is correct on a clean ramp', () => {
    expect(slope([0, 1, 2, 3, 4])).toBeCloseTo(1, 9);
    expect(slope([4, 3, 2, 1, 0])).toBeCloseTo(-1, 9);
  });

  it('throws on a too-short window', () => {
    expect(() => extractFeatures(new Array(MIN_WINDOW - 1).fill(5))).toThrow(/at least/);
  });
});

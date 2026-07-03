/**
 * Tests for patternFeatures (A.3 embedding scaffold) — pure feature extraction.
 */
const {
  extractFeatures,
  FEATURE_DIM,
  CURVE_POINTS,
  _internal: { fillGaps, resample, slope, lowStreak },
} = require('../src/services/patternFeatures');

describe('fillGaps', () => {
  it('linearly interpolates interior gaps', () => {
    expect(fillGaps([1, null, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
    expect(fillGaps([2, null, null, 5, 6, 7])).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('nearest-fills leading and trailing gaps', () => {
    expect(fillGaps([null, 3, 4, 5, 4, null])).toEqual([3, 3, 4, 5, 4, 4]);
  });

  it('returns null when there are too few real observations', () => {
    expect(fillGaps([null, 3, null])).toBeNull();
    expect(fillGaps([1, 2, 3])).toBeNull(); // MIN_KNOWN is 4
  });
});

describe('resample', () => {
  it('preserves endpoints and length', () => {
    const r = resample([0, 1], 5);
    expect(r).toHaveLength(5);
    expect(r[0]).toBeCloseTo(0, 6);
    expect(r[4]).toBeCloseTo(1, 6);
    expect(r[2]).toBeCloseTo(0.5, 6);
  });
});

describe('slope', () => {
  it('is positive for a rising series and ~0 for a flat one', () => {
    expect(slope([1, 2, 3, 4])).toBeGreaterThan(0);
    expect(slope([3, 3, 3, 3])).toBeCloseTo(0, 6);
    expect(slope([4, 3, 2, 1])).toBeLessThan(0);
  });
});

describe('lowStreak', () => {
  it('measures the longest sub-threshold run as a fraction', () => {
    // LOW_MOOD threshold is 0.375; 0.2 is below, 0.9 is above
    expect(lowStreak([0.2, 0.2, 0.9, 0.2])).toBeCloseTo(2 / 4, 6);
    expect(lowStreak([0.9, 0.9, 0.9])).toBeCloseTo(0, 6);
  });
});

describe('extractFeatures', () => {
  const rising = [1, 2, 2, 3, 3, 4, 4, 5];

  it('returns a vector of the documented dimension', () => {
    const v = extractFeatures(rising);
    expect(v).toHaveLength(FEATURE_DIM);
    expect(FEATURE_DIM).toBe(10 + CURVE_POINTS);
    v.forEach((x) => {
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(-1);
      expect(x).toBeLessThanOrEqual(1);
    });
  });

  it('is deterministic', () => {
    expect(extractFeatures(rising)).toEqual(extractFeatures(rising));
  });

  it('returns null for a too-sparse series', () => {
    expect(extractFeatures([3, null, null])).toBeNull();
    expect(extractFeatures('not an array')).toBeNull();
  });

  it('encodes a rising trend with a positive slope feature (index 2)', () => {
    expect(extractFeatures(rising)[2]).toBeGreaterThan(0);
    expect(extractFeatures([5, 4, 4, 3, 3, 2, 2, 1])[2]).toBeLessThan(0);
  });

  it('is level-invariant in the rhythm curve: same shape at different levels embeds the curve alike', () => {
    // Same up-down rhythm, shifted up by 1 mood point (clipped at 5).
    const low = [2, 3, 4, 3, 2, 3, 4, 3];
    const high = [3, 4, 5, 4, 3, 4, 5, 4];
    const vLow = extractFeatures(low).slice(10); // curve portion
    const vHigh = extractFeatures(high).slice(10);
    for (let i = 0; i < vLow.length; i += 1) {
      expect(vHigh[i]).toBeCloseTo(vLow[i], 6);
    }
    // but the level stat (index 0) differs
    expect(extractFeatures(high)[0]).toBeGreaterThan(extractFeatures(low)[0]);
  });
});

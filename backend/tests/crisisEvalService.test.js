/**
 * Tests for crisisEvalService (D.1, ADR-0019) — the offline synthetic evaluation.
 * Seeded RNG for determinism.
 */
const { runSyntheticEval, auc } = require('../src/services/crisisEvalService');

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('auc', () => {
  it('is 1 for perfect separation and 0 for fully reversed', () => {
    expect(auc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1])).toBeCloseTo(1, 9);
    expect(auc([0.9, 0.8, 0.2, 0.1], [0, 0, 1, 1])).toBeCloseTo(0, 9);
  });

  it('returns null without both classes present', () => {
    expect(auc([0.1, 0.2], [0, 0])).toBeNull();
  });
});

describe('runSyntheticEval', () => {
  it('separates deteriorating from stable trajectories well above chance', () => {
    const r = runSyntheticEval({ n: 600, windowLen: 14, rng: mulberry32(42) });
    expect(r.auc).toBeGreaterThan(0.8);
    expect(r.recall).toBeGreaterThan(0.6);
    expect(r.confusion.tp + r.confusion.fn).toBeGreaterThan(0);
  });

  it('foregrounds the false-negative rate and the augment-only caveat', () => {
    const r = runSyntheticEval({ n: 300, windowLen: 14, rng: mulberry32(7) });
    expect(r).toHaveProperty('falseNegativeRate');
    expect(r.note).toMatch(/augments|SafetyFilter|adjunct/i);
  });

  it('is reproducible under the same seed', () => {
    const a = runSyntheticEval({ n: 200, rng: mulberry32(99) });
    const b = runSyntheticEval({ n: 200, rng: mulberry32(99) });
    expect(a.auc).toBeCloseTo(b.auc, 12);
  });
});

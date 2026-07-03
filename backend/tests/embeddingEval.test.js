/**
 * Tests for embeddingEvalService (A.3, ADR-0024) — the offline eval harness.
 */
const { runEval, makeCohort, auc } = require('../src/services/embeddingEvalService');

/** Dominant rule cluster among a latent group's users. */
function dominantCluster(cohort, group) {
  const counts = {};
  cohort.filter((u) => u.group === group).forEach((u) => {
    counts[u.cluster] = (counts[u.cluster] || 0) + 1;
  });
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
}

describe('auc', () => {
  it('is 1 for perfect ranking, 0 for reversed, 0.5 for all-ties', () => {
    expect(auc([0, 0, 1, 1], [0.1, 0.2, 0.3, 0.4])).toBe(1);
    expect(auc([1, 1, 0, 0], [0.1, 0.2, 0.3, 0.4])).toBe(0);
    expect(auc([0, 1, 0, 1], [0.5, 0.5, 0.5, 0.5])).toBe(0.5);
  });

  it('averages ranks across ties between classes', () => {
    expect(auc([1, 0], [1, 1])).toBe(0.5);
  });
});

describe('makeCohort', () => {
  const cohort = makeCohort({ perGroup: 40, seed: 1 });

  it('produces the expected number of users with features', () => {
    expect(cohort.length).toBeGreaterThanOrEqual(190);
    cohort.forEach((u) => expect(Array.isArray(u.features)).toBe(true));
  });

  it('collapses the three flat groups (0,1,4) into one rule cluster', () => {
    // The rule-based scheme cannot tell the flat groups apart...
    expect(dominantCluster(cohort, 0)).toBe(dominantCluster(cohort, 1));
    expect(dominantCluster(cohort, 4)).toBe(dominantCluster(cohort, 0));
    // ...but does separate the two clear-trend groups.
    expect(dominantCluster(cohort, 2)).not.toBe(dominantCluster(cohort, 0));
    expect(dominantCluster(cohort, 3)).not.toBe(dominantCluster(cohort, 0));
    expect(dominantCluster(cohort, 2)).not.toBe(dominantCluster(cohort, 3));
  });
});

describe('runEval', () => {
  it('the embedding separates latent groups better than the rule-based clusters', () => {
    const r = runEval({ seed: 1 });
    expect(r.ruleAUC).toBeGreaterThan(0.6); // baseline carries real signal (not degenerate)
    expect(r.embAUC).toBeGreaterThan(0.9); // embedding strongly separates
    expect(r.embAUC).toBeGreaterThan(r.ruleAUC + 0.03); // and beats the baseline
    expect(r.finalLoss).toBeLessThan(0.05); // training converged
  });

  it('holds across several seeds', () => {
    for (const seed of [2, 3, 4]) {
      const r = runEval({ seed });
      expect(r.embAUC).toBeGreaterThan(r.ruleAUC);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(runEval({ seed: 5 }).embAUC).toBe(runEval({ seed: 5 }).embAUC);
  });
});

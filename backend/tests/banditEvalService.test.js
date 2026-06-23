/**
 * Tests for banditEvalService (C.1, ADR-0018).
 * Uses a seeded RNG so the synthetic evaluation is deterministic. The key claims:
 * the contextual bandit beats random AND beats a one-size static rule, and its
 * regret against the oracle is small after learning.
 */
const { runSyntheticEval, replayLoggedData } = require('../src/services/banditEvalService');

// Deterministic PRNG (mulberry32).
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

// Environment: the best arm depends on the context feature x[1] in [0,1].
const ARMS = ['A0', 'A1', 'A2'];
const CENTER = { A0: 0.16, A1: 0.5, A2: 0.84 };
const rewardFn = (x, arm) => Math.max(0, 1 - 2 * Math.abs(x[1] - CENTER[arm]));
const contextGen = (rng) => [1, rng(), rng()];
// A one-size-fits-all rule: always offer the globally most "central" arm.
const staticRule = () => 'A1';

describe('runSyntheticEval', () => {
  it('the bandit beats random and a static rule, with small regret vs the oracle', () => {
    const r = runSyntheticEval({
      arms: ARMS,
      dim: 3,
      rounds: 3000,
      alpha: 0.4,
      rewardFn,
      rulesPolicy: staticRule,
      contextGen,
      rng: mulberry32(12345),
      noise: 0.1,
    });

    expect(r.avgReward.bandit).toBeGreaterThan(r.avgReward.random);
    expect(r.avgReward.bandit).toBeGreaterThan(r.avgReward.rules); // contextual > static
    expect(r.avgReward.bandit).toBeLessThanOrEqual(r.avgReward.oracle + 1e-9);
    expect(r.avgRegret.bandit).toBeLessThan(r.avgRegret.random);
    expect(r.avgRegret.bandit).toBeLessThan(0.15); // approaches the oracle
  });

  it('is reproducible under the same seed', () => {
    const cfg = {
      arms: ARMS, dim: 3, rounds: 500, alpha: 0.4, rewardFn, rulesPolicy: staticRule, contextGen,
    };
    const a = runSyntheticEval({ ...cfg, rng: mulberry32(7) });
    const b = runSyntheticEval({ ...cfg, rng: mulberry32(7) });
    expect(a.avgReward.bandit).toBeCloseTo(b.avgReward.bandit, 12);
  });
});

describe('replayLoggedData', () => {
  it('accounts matches and reward, with the bias caveat', () => {
    const tuples = [
      { x: [1, 0.1, 0], arm: 'A0', reward: 1 },
      { x: [1, 0.5, 0], arm: 'A1', reward: 1 },
      { x: [1, 0.9, 0], arm: 'A2', reward: 0 },
    ];
    const r = replayLoggedData(tuples, { arms: ARMS, dim: 3, alpha: 1 });
    expect(r.total).toBe(3);
    expect(r.matched).toBeGreaterThanOrEqual(0);
    expect(r.matched).toBeLessThanOrEqual(3);
    expect(r.loggedAvgReward).toBeCloseTo(2 / 3, 9);
    expect(r.note).toMatch(/approximate|uniform/i);
  });

  it('returns nulls for an empty log', () => {
    const r = replayLoggedData([], { arms: ARMS, dim: 3 });
    expect(r.total).toBe(0);
    expect(r.estimatedAvgReward).toBeNull();
    expect(r.loggedAvgReward).toBeNull();
  });
});

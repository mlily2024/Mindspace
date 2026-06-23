/**
 * Tests for crisisEarlyWarning (D.1, ADR-0019).
 * The augment-only invariants are the safety contract of this feature and are
 * tested exhaustively across the risk range: the model can only ever RAISE caution
 * above the SafetyFilter floor, never lower it, and never asserts 'crisis' alone.
 */
const {
  train,
  predictRisk,
  riskLevel,
  assessAugmented,
  sigmoid,
  LEVELS,
} = require('../src/services/crisisEarlyWarning');

const rankOf = (lvl) => LEVELS.indexOf(lvl);

describe('logistic core', () => {
  it('sigmoid is monotone and centred at 0.5', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 9);
    expect(sigmoid(10)).toBeGreaterThan(0.99);
    expect(sigmoid(-10)).toBeLessThan(0.01);
  });

  it('train separates a trivially separable set', () => {
    const X = [[1, 0], [1, 0], [1, 1], [1, 1]];
    const y = [0, 0, 1, 1];
    const model = train(X, y, { epochs: 500, lr: 0.5 });
    expect(predictRisk(model, [1, 1])).toBeGreaterThan(0.5);
    expect(predictRisk(model, [1, 0])).toBeLessThan(0.5);
  });

  it('riskLevel maps thresholds and never returns crisis', () => {
    expect(riskLevel(0.1)).toBe('none');
    expect(riskLevel(0.5)).toBe('watch');
    expect(riskLevel(0.8)).toBe('elevated');
    expect(riskLevel(1)).not.toBe('crisis');
  });
});

describe('assessAugmented — AUGMENT-ONLY safety invariants', () => {
  it('never lowers a SafetyFilter crisis, regardless of model risk', () => {
    for (let r = 0; r <= 1.0001; r += 0.05) {
      const out = assessAugmented(true, r);
      expect(out.level).toBe('crisis');
    }
  });

  it('the model alone NEVER asserts crisis (no SafetyFilter crisis)', () => {
    for (let r = 0; r <= 1.0001; r += 0.02) {
      const out = assessAugmented(false, r);
      expect(out.level).not.toBe('crisis');
      expect(['none', 'watch', 'elevated']).toContain(out.level);
    }
  });

  it('output is always at least the SafetyFilter floor (monotone, never below)', () => {
    for (const safety of [true, false]) {
      for (let r = 0; r <= 1.0001; r += 0.1) {
        const out = assessAugmented(safety, r);
        const floor = safety ? 'crisis' : 'none';
        expect(rankOf(out.level)).toBeGreaterThanOrEqual(rankOf(floor));
      }
    }
  });

  it('raises caution additively when the model is confident and SafetyFilter is silent', () => {
    expect(assessAugmented(false, 0.9)).toMatchObject({ level: 'elevated', source: 'model_adjunct' });
    expect(assessAugmented(false, 0.5)).toMatchObject({ level: 'watch', source: 'model_adjunct' });
    expect(assessAugmented(false, 0.1)).toMatchObject({ level: 'none', source: 'safety_filter' });
  });

  it('attributes a held crisis to the SafetyFilter, not the model', () => {
    expect(assessAugmented(true, 0.0).source).toBe('safety_filter');
  });
});

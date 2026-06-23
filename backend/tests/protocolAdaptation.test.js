/**
 * Tests for protocolAdaptation (C.2) — the pure pacing engine.
 * Pins the difficulty thresholds, smoothing, mood softener, and the
 * "no banner when pacing comfortably / no history" behaviour. Also a
 * guardrail test: adaptation never pushes a struggling user forward.
 */
const { computeAdaptation } = require('../src/services/protocolAdaptation');

const c = (difficulty_rating, mood_before, mood_after, session_number) => ({
  difficulty_rating, mood_before, mood_after, session_number,
});

describe('computeAdaptation', () => {
  it('returns null with no history (first session as authored)', () => {
    expect(computeAdaptation([])).toBeNull();
    expect(computeAdaptation(null)).toBeNull();
  });

  it('returns null when pacing comfortably (moderate difficulty)', () => {
    expect(computeAdaptation([c(3, 5, 6, 2)])).toBeNull();
  });

  it('eases off when the last session was hard', () => {
    const a = computeAdaptation([c(5, 6, 5, 2)]);
    expect(a).not.toBeNull();
    expect(a.level).toBe('ease');
    expect(a.basis.lastDifficultyLabel).toBe('Very Hard');
  });

  it('offers a stretch when recent sessions were easy', () => {
    const a = computeAdaptation([c(1, 5, 7, 2), c(2, 5, 6, 1)]);
    expect(a.level).toBe('stretch');
  });

  it('adds a supportive note when a hard session also lowered mood', () => {
    const a = computeAdaptation([c(5, 7, 4, 2)]); // mood delta -3
    expect(a.level).toBe('ease');
    expect(a.message).toMatch(/talking it through|pausing/i);
  });

  it('does not add the mood note when a hard session did not lower mood', () => {
    const a = computeAdaptation([c(4, 5, 6, 2)]);
    expect(a.level).toBe('ease');
    expect(a.message).not.toMatch(/pausing/i);
  });

  it('smooths a single spike against the prior session (no whipsaw)', () => {
    // one very-hard (5) after an easy (2): mean 3.5 -> still eases (>=4? no, 3.5<4) => null
    expect(computeAdaptation([c(5, 5, 5, 2), c(2, 5, 5, 1)])).toBeNull();
    // two hard in a row -> eases
    expect(computeAdaptation([c(4, 5, 5, 2), c(5, 5, 5, 1)]).level).toBe('ease');
  });

  it('guardrail: never produces a "push forward" level — only ease or stretch', () => {
    const levels = [
      computeAdaptation([c(5, 5, 3, 2)]),
      computeAdaptation([c(1, 5, 8, 2)]),
      computeAdaptation([c(3, 5, 5, 2)]),
    ].filter(Boolean).map((a) => a.level);
    levels.forEach((l) => expect(['ease', 'stretch']).toContain(l));
  });

  it('ignores malformed ratings', () => {
    expect(computeAdaptation([c(null, 5, 5, 2)])).toBeNull();
    expect(computeAdaptation([c('x', 5, 5, 2)])).toBeNull();
  });
});

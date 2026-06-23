/**
 * Tests for forecastMetrics (A.4, ADR-0016) — pin the scoring math with known
 * vectors so a Chronos-vs-regression comparison rests on correct metrics.
 */
const m = require('../src/utils/forecastMetrics');

describe('forecastMetrics', () => {
  it('mae and rmse on a known vector', () => {
    expect(m.mae([1, 2, 3], [1, 2, 3])).toBe(0);
    expect(m.mae([1, 2, 3], [2, 2, 2])).toBeCloseTo((1 + 0 + 1) / 3, 10);
    expect(m.rmse([0, 0], [3, 4])).toBeCloseTo(Math.sqrt((9 + 16) / 2), 10);
  });

  it('pinball loss is asymmetric by tau', () => {
    // actual above the quantile: under-prediction penalised by tau
    expect(m.pinballLoss([10], [8], 0.9)).toBeCloseTo(0.9 * 2, 10);
    // actual below the quantile: over-prediction penalised by (1-tau)
    expect(m.pinballLoss([6], [8], 0.9)).toBeCloseTo(0.1 * 2, 10);
    // at the median, both sides weigh 0.5
    expect(m.pinballLoss([6], [8], 0.5)).toBeCloseTo(0.5 * 2, 10);
  });

  it('interval coverage counts actuals inside [low, high]', () => {
    expect(m.intervalCoverage([5, 5, 5], [4, 6, 4], [6, 7, 6])).toBeCloseTo(2 / 3, 10);
    expect(m.intervalCoverage([5], [5], [5])).toBe(1); // inclusive bounds
  });

  it('crps approximation equals the mean of the three pinball losses', () => {
    const actuals = [5, 6, 7];
    const q = { p10: [4, 5, 6], p50: [5, 6, 7], p90: [6, 7, 8] };
    const expected =
      (m.pinballLoss(actuals, q.p10, 0.1) +
        m.pinballLoss(actuals, q.p50, 0.5) +
        m.pinballLoss(actuals, q.p90, 0.9)) /
      3;
    expect(m.crpsFromQuantiles(actuals, q)).toBeCloseTo(expected, 10);
  });

  it('summarize returns a full scorecard; a perfect median forecast scores 0 error', () => {
    const actuals = [5, 6, 7];
    const s = m.summarize(actuals, { p10: [4, 5, 6], p50: [5, 6, 7], p90: [6, 7, 8] });
    expect(s.n).toBe(3);
    expect(s.mae).toBe(0);
    expect(s.rmse).toBe(0);
    expect(s.coverage80).toBe(1);
  });

  it('throws on mismatched lengths', () => {
    expect(() => m.mae([1, 2], [1])).toThrow(/equal-length/);
  });
});

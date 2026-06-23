/**
 * Tests for univariateRegressionForecaster (A.4, ADR-0016).
 */
const { forecast } = require('../src/utils/univariateRegressionForecaster');

describe('univariateRegressionForecaster', () => {
  it('extrapolates a clean linear trend', () => {
    // y = 1 + 0.5 t for t=0..9  ->  next values continue the line
    const series = Array.from({ length: 10 }, (_, t) => 1 + 0.5 * t);
    const { p50 } = forecast(series, 3);
    // t=10 -> 6, t=11 -> 6.5, t=12 -> 7 (clamped 1..10, all in range)
    expect(p50[0]).toBeCloseTo(6, 1);
    expect(p50[1]).toBeCloseTo(6.5, 1);
    expect(p50[2]).toBeCloseTo(7, 1);
  });

  it('forecasts a flat series flat, with non-degenerate bands', () => {
    const series = Array(20).fill(5);
    const { p10, p50, p90 } = forecast(series, 4);
    p50.forEach((v) => expect(v).toBeCloseTo(5, 6));
    // residuals are ~0, so the band sits at the sigma floor (not collapsed)
    expect(p90[0]).toBeGreaterThan(p50[0]);
    expect(p10[0]).toBeLessThan(p50[0]);
  });

  it('orders the bands p10 <= p50 <= p90 and clamps to [1,10]', () => {
    const series = Array.from({ length: 15 }, (_, t) => 3 + Math.sin(t));
    const { p10, p50, p90 } = forecast(series, 5);
    for (let i = 0; i < 5; i += 1) {
      expect(p10[i]).toBeLessThanOrEqual(p50[i]);
      expect(p50[i]).toBeLessThanOrEqual(p90[i]);
      expect(p10[i]).toBeGreaterThanOrEqual(1);
      expect(p90[i]).toBeLessThanOrEqual(10);
    }
  });

  it('degrades gracefully on <2 points', () => {
    expect(forecast([7], 2).p50).toEqual([7, 7]);
    expect(forecast([], 2).p50.every((v) => v >= 1 && v <= 10)).toBe(true);
  });

  it('weights recent points more (decay): a late level shift pulls the forecast', () => {
    const flat = Array(20).fill(5);
    const shifted = flat.slice();
    for (let i = 15; i < 20; i += 1) shifted[i] = 8; // recent jump up
    const flatF = forecast(flat, 1).p50[0];
    const shiftedF = forecast(shifted, 1).p50[0];
    expect(shiftedF).toBeGreaterThan(flatF);
  });
});

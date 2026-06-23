/**
 * Tests for forecastEvalService (A.4, ADR-0016) — the offline A/B orchestrator.
 * Chronos is stubbed (no Python needed). Pins the held-out split, the
 * never-silently-fall-back rule, and the aggregation/skip accounting.
 */
const svc = require('../src/services/forecastEvalService');

const linear = (len) => Array.from({ length: len }, (_, t) => Math.min(10, 1 + 0.1 * t));

describe('forecastEvalService.splitSeries', () => {
  it('holds out the last `horizon` values', () => {
    const { train, test } = svc.splitSeries([1, 2, 3, 4, 5], 2);
    expect(train).toEqual([1, 2, 3]);
    expect(test).toEqual([4, 5]);
  });
});

describe('forecastEvalService.evalSeries', () => {
  it('scores both engines when Chronos succeeds', async () => {
    const series = linear(40);
    const chronosFn = async (_train, horizon) => ({
      p10: Array(horizon).fill(3),
      p50: Array(horizon).fill(4),
      p90: Array(horizon).fill(5),
    });
    const r = await svc.evalSeries(series, 7, chronosFn);
    expect(r.chronosAvailable).toBe(true);
    expect(r.baseline).toHaveProperty('crps');
    expect(r.chronos).toHaveProperty('crps');
  });

  it('flags Chronos as unavailable on failure and does NOT fall back to regression', async () => {
    const series = linear(40);
    const chronosFn = async () => {
      throw new Error('python missing');
    };
    const r = await svc.evalSeries(series, 7, chronosFn);
    expect(r.chronosAvailable).toBe(false);
    expect(r.chronos).toBeNull();
    expect(r.chronosError).toMatch(/python missing/);
    // baseline still scored
    expect(r.baseline).toHaveProperty('mae');
  });

  it('rejects a Chronos forecast of the wrong length (no partial comparison)', async () => {
    const series = linear(40);
    const chronosFn = async () => ({ p50: [1, 2] }); // too short for horizon 7
    const r = await svc.evalSeries(series, 7, chronosFn);
    expect(r.chronosAvailable).toBe(false);
    expect(r.chronosError).toMatch(/p50/);
  });
});

describe('forecastEvalService.runEval', () => {
  it('skips series shorter than minHistory + horizon and aggregates the rest', async () => {
    const seriesList = [linear(40), linear(40), linear(10)]; // last too short
    const chronosFn = async (_t, h) => ({
      p10: Array(h).fill(3),
      p50: Array(h).fill(4),
      p90: Array(h).fill(5),
    });
    const report = await svc.runEval({ seriesList, horizon: 7, minHistory: 30, chronosFn });
    expect(report.nEvaluated).toBe(2);
    expect(report.nSkipped).toBe(1);
    expect(report.chronosEvaluated).toBe(2);
    expect(report.aggregate.baseline).toHaveProperty('mae');
    expect(report.aggregate.chronos).toHaveProperty('mae');
  });

  it('reports a null Chronos aggregate when every series fails Chronos', async () => {
    const seriesList = [linear(40)];
    const chronosFn = async () => {
      throw new Error('unavailable');
    };
    const report = await svc.runEval({ seriesList, horizon: 7, minHistory: 30, chronosFn });
    expect(report.chronosEvaluated).toBe(0);
    expect(report.chronosUnavailable).toBe(1);
    expect(report.aggregate.chronos).toBeNull();
    expect(report.aggregate.baseline).not.toBeNull();
  });
});

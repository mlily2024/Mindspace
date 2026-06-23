/**
 * Tests for the Chronos mood forecaster wrapper (ADR-0012).
 *
 * The model itself is non-deterministic and heavy, so these tests pin down the
 * INTEGRATION CONTRACT, not model numbers: the success path shape (p10/p50/p90
 * bands, clamping, `source: 'chronos'`) and — the load-bearing part — that ANY
 * failure or the disabled flag falls back to the regression engine without
 * ever throwing. The Python subprocess, db, and regression engine are mocked.
 */
const { EventEmitter } = require('events');

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../src/services/predictiveEngineService', () => ({ generatePredictions: jest.fn() }));

const { spawn } = require('child_process');
const db = require('../src/config/database');
const PredictiveEngineService = require('../src/services/predictiveEngineService');
const ChronosService = require('../src/services/chronosService');

// Build a fake ChildProcess that emits stdout/stderr/close (or an error) on the
// next tick, after generatePredictions has attached its listeners.
function fakeChild({ stdout = '', stderr = '', code = 0, errorEvent = null } = {}) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { write: jest.fn(), end: jest.fn() };
  child.kill = jest.fn();
  process.nextTick(() => {
    if (errorEvent) { child.emit('error', errorEvent); return; }
    if (stdout) child.stdout.emit('data', Buffer.from(stdout));
    if (stderr) child.stderr.emit('data', Buffer.from(stderr));
    child.emit('close', code);
  });
  return child;
}

const REG_PREDS = [
  { date: '2026-06-24', predictedMood: 6.0, confidenceInterval: { low: 5, high: 7 } },
  { date: '2026-06-25', predictedMood: 6.2, confidenceInterval: { low: 5, high: 7.4 } },
];

describe('chronosService', () => {
  const OLD_ENV = process.env.CHRONOS_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CHRONOS_URL; // spawn/disabled tests must not see an HTTP url
    PredictiveEngineService.generatePredictions.mockResolvedValue(REG_PREDS);
    db.query.mockResolvedValue({
      rows: [
        { day: '2026-06-10', mood: 6 }, { day: '2026-06-11', mood: 5 },
        { day: '2026-06-12', mood: 7 }, { day: '2026-06-13', mood: 6 },
      ],
    });
  });
  afterAll(() => { process.env.CHRONOS_ENABLED = OLD_ENV; });

  describe('disabled (the default everywhere except an enabled host)', () => {
    it('falls back to the regression engine WITHOUT spawning python', async () => {
      process.env.CHRONOS_ENABLED = 'false';
      const out = await ChronosService.generatePredictions('u1', 2);
      expect(spawn).not.toHaveBeenCalled();
      expect(PredictiveEngineService.generatePredictions).toHaveBeenCalledWith('u1', 2);
      expect(out).toHaveLength(2);
      expect(out.every((p) => p.source === 'regression_fallback')).toBe(true);
    });
  });

  describe('enabled', () => {
    beforeEach(() => { process.env.CHRONOS_ENABLED = 'true'; });

    it('returns chronos forecasts with p10/p50/p90 bands on success', async () => {
      spawn.mockImplementation(() => fakeChild({
        stdout: JSON.stringify({ p10: [4.0, 4.2], p50: [6.0, 6.5], p90: [8.0, 8.3] }),
        code: 0,
      }));
      const out = await ChronosService.generatePredictions('u1', 2);
      expect(spawn).toHaveBeenCalledTimes(1);
      expect(out).toHaveLength(2);
      expect(out[0].source).toBe('chronos');
      expect(out[0].predictedMood).toBe(6);
      expect(out[0].confidenceInterval).toEqual({ low: 4, high: 8 });
      expect(out[1].predictedMood).toBe(6.5);
      expect(PredictiveEngineService.generatePredictions).not.toHaveBeenCalled();
    });

    it('clamps forecasts into the 1-10 mood range', async () => {
      spawn.mockImplementation(() => fakeChild({
        stdout: JSON.stringify({ p10: [-3], p50: [12], p90: [99] }),
        code: 0,
      }));
      const out = await ChronosService.generatePredictions('u1', 1);
      expect(out[0].predictedMood).toBe(10);
      expect(out[0].confidenceInterval).toEqual({ low: 1, high: 10 });
    });

    it('falls back when python exits non-zero', async () => {
      spawn.mockImplementation(() => fakeChild({ stderr: '{"error":"No module named chronos"}', code: 1 }));
      const out = await ChronosService.generatePredictions('u1', 2);
      expect(out.every((p) => p.source === 'regression_fallback')).toBe(true);
      expect(PredictiveEngineService.generatePredictions).toHaveBeenCalledWith('u1', 2);
    });

    it('falls back when python is not found (spawn error event)', async () => {
      spawn.mockImplementation(() => fakeChild({ errorEvent: new Error('spawn python3 ENOENT') }));
      const out = await ChronosService.generatePredictions('u1', 2);
      expect(out.every((p) => p.source === 'regression_fallback')).toBe(true);
    });

    it('falls back on malformed python output', async () => {
      spawn.mockImplementation(() => fakeChild({ stdout: 'not json at all', code: 0 }));
      const out = await ChronosService.generatePredictions('u1', 2);
      expect(out.every((p) => p.source === 'regression_fallback')).toBe(true);
    });

    it('falls back (no spawn) when mood history is too short', async () => {
      db.query.mockResolvedValue({ rows: [{ day: '2026-06-10', mood: 6 }] });
      const out = await ChronosService.generatePredictions('u1', 2);
      expect(spawn).not.toHaveBeenCalled();
      expect(out.every((p) => p.source === 'regression_fallback')).toBe(true);
    });

    it('passes regression status objects through unchanged (e.g. no_model)', async () => {
      spawn.mockImplementation(() => fakeChild({ errorEvent: new Error('boom') }));
      PredictiveEngineService.generatePredictions.mockResolvedValue({ status: 'no_model', message: 'none' });
      const out = await ChronosService.generatePredictions('u1', 2);
      expect(out).toEqual({ status: 'no_model', message: 'none' });
    });
  });

  describe('http mode (persistent sidecar)', () => {
    let originalFetch;
    beforeEach(() => {
      process.env.CHRONOS_URL = 'http://chronos:8001';
      originalFetch = global.fetch;
      global.fetch = jest.fn();
    });
    afterEach(() => { global.fetch = originalFetch; });

    it('uses the sidecar over HTTP (no spawn) and returns chronos forecasts', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ p10: [4, 4.2], p50: [6, 6.5], p90: [8, 8.3] }),
      });
      const out = await ChronosService.generatePredictions('u1', 2);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toBe('http://chronos:8001/forecast');
      expect(spawn).not.toHaveBeenCalled();
      expect(out[0].source).toBe('chronos');
      expect(out[0].predictedMood).toBe(6);
      expect(out[0].confidenceInterval).toEqual({ low: 4, high: 8 });
    });

    it('falls back when the sidecar returns a non-200', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
      const out = await ChronosService.generatePredictions('u1', 2);
      expect(out.every((p) => p.source === 'regression_fallback')).toBe(true);
    });

    it('falls back when the sidecar is unreachable', async () => {
      global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));
      const out = await ChronosService.generatePredictions('u1', 2);
      expect(out.every((p) => p.source === 'regression_fallback')).toBe(true);
    });

    it('falls back on malformed sidecar output', async () => {
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ nope: true }) });
      const out = await ChronosService.generatePredictions('u1', 2);
      expect(out.every((p) => p.source === 'regression_fallback')).toBe(true);
    });

    it('prefers HTTP even when CHRONOS_ENABLED is also set (no spawn)', async () => {
      process.env.CHRONOS_ENABLED = 'true';
      global.fetch.mockResolvedValue({ ok: true, json: async () => ({ p10: [5], p50: [6], p90: [7] }) });
      await ChronosService.generatePredictions('u1', 1);
      expect(global.fetch).toHaveBeenCalled();
      expect(spawn).not.toHaveBeenCalled();
    });
  });
});

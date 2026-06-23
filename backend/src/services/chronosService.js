/**
 * Chronos-Bolt mood forecaster (ADR-0012) — additive, fallback-guarded.
 *
 * Produces zero-shot multi-day mood forecasts with p10/p50/p90 bands via a
 * Python subprocess (backend/python/predict_chronos.py). On ANY failure
 * (Python/model absent, subprocess error, timeout, malformed output, or
 * CHRONOS_ENABLED !== 'true') it returns PredictiveEngineService.generate-
 * Predictions(...) instead, so callers never break. Output shape mirrors the
 * regression engine, plus a confidence band and a `source` tag.
 */
const path = require('path');
const { spawn } = require('child_process');
const db = require('../config/database');
const logger = require('../config/logger');
const PredictiveEngineService = require('./predictiveEngineService');

const PYTHON_BIN = process.env.CHRONOS_PYTHON || 'python3';
const SCRIPT_PATH = path.join(__dirname, '..', '..', 'python', 'predict_chronos.py');
// Each spawn reloads the model (~14s warm, more on a cold first call — measured
// 2026-06-23). 60s default covers a cold start; Phase 2's persistent sidecar
// removes the per-call model-load cost. Override with CHRONOS_TIMEOUT_MS.
const TIMEOUT_MS = Number(process.env.CHRONOS_TIMEOUT_MS || 60000);
const MIN_SERIES = 3; // need a few points before Chronos is worthwhile
const MAX_CONTEXT = 180; // cap the context window fed to the model

// Chronos is opt-in (it needs torch + the model, which most hosts — incl. the
// free-tier demo — do not have). Two ways to enable it:
//   CHRONOS_URL=http://chronos:8001  -> call the persistent sidecar over HTTP
//                                       (model loaded once; ~35ms warm). PREFERRED.
//   CHRONOS_ENABLED=true             -> spawn predict_chronos.py per request
//                                       (reloads the model each call; batch-only).
// Read at call time so tests/config can flip it without re-requiring the module.
function chronosUrl() {
  return (process.env.CHRONOS_URL || '').replace(/\/+$/, '');
}
function chronosMode() {
  if (chronosUrl()) return 'http';
  if (String(process.env.CHRONOS_ENABLED).toLowerCase() === 'true') return 'spawn';
  return null;
}

const clampMood = (v) => Math.min(10, Math.max(1, Math.round(v * 100) / 100));

class ChronosService {
  /** Load the user's daily-averaged mood series (ascending by day). */
  static async _loadDailyMood(userId) {
    const result = await db.query(
      `SELECT DATE(created_at) AS day, AVG(mood_score)::float AS mood
         FROM mood_entries
        WHERE user_id = $1
        GROUP BY DATE(created_at)
        ORDER BY day ASC`,
      [userId]
    );
    const rows = (result.rows || []).slice(-MAX_CONTEXT);
    return rows.map((r) => Number(r.mood)).filter((n) => Number.isFinite(n));
  }

  /** Run the Python Chronos forecaster. Resolves {p10,p50,p90} or rejects. */
  static _runChronos(series, horizon) {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (fn, arg) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(arg);
      };

      const child = spawn(PYTHON_BIN, [SCRIPT_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });
      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch (_) { /* already gone */ }
        finish(reject, new Error('chronos timeout'));
      }, TIMEOUT_MS);

      child.on('error', (err) => finish(reject, err)); // e.g. python not found
      child.stdout.on('data', (d) => { stdout += d; });
      child.stderr.on('data', (d) => { stderr += d; });
      child.on('close', (code) => {
        if (code !== 0) {
          return finish(reject, new Error(`chronos exit ${code}: ${stderr.slice(0, 300)}`));
        }
        try {
          const parsed = JSON.parse(stdout);
          if (!parsed || !Array.isArray(parsed.p50)) {
            return finish(reject, new Error('chronos malformed output'));
          }
          return finish(resolve, parsed);
        } catch (e) {
          return finish(reject, new Error(`chronos parse error: ${e.message}`));
        }
      });

      child.stdin.write(JSON.stringify({ series, horizon }));
      child.stdin.end();
    });
  }

  /** Call the persistent sidecar over HTTP. Resolves {p10,p50,p90} or rejects. */
  static async _httpForecast(series, horizon) {
    const url = `${chronosUrl()}/forecast`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series, horizon }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`chronos sidecar HTTP ${res.status}`);
      const parsed = await res.json();
      if (!parsed || !Array.isArray(parsed.p50)) {
        throw new Error('chronos sidecar malformed output');
      }
      return parsed;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Fall back to the regression engine, tagging the source. */
  static async _fallback(userId, daysAhead, reason) {
    if (reason) logger.info('chronosService falling back to regression engine', { userId, reason });
    const preds = await PredictiveEngineService.generatePredictions(userId, daysAhead);
    if (Array.isArray(preds)) {
      return preds.map((p) => ({ ...p, source: 'regression_fallback' }));
    }
    return preds; // pass through status objects ({status, message}) unchanged
  }

  /**
   * Generate next-N-day mood forecasts. Same shape as the regression engine,
   * plus a confidence band and a `source` tag. Never throws for forecasting
   * failures — always falls back to the regression engine.
   *
   * @param {string} userId
   * @param {number} daysAhead
   * @returns {Promise<Array<{date, predictedMood, confidenceInterval:{low,high}, source}>>}
   */
  static async generatePredictions(userId, daysAhead = 7) {
    const mode = chronosMode();
    if (!mode) {
      return this._fallback(userId, daysAhead, 'disabled');
    }
    try {
      const series = await this._loadDailyMood(userId);
      if (series.length < MIN_SERIES) {
        return this._fallback(userId, daysAhead, 'insufficient_history');
      }
      const { p10, p50, p90 } = mode === 'http'
        ? await this._httpForecast(series, daysAhead)
        : await this._runChronos(series, daysAhead);
      const today = new Date();
      return p50.map((mid, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() + i + 1);
        return {
          date: date.toISOString().slice(0, 10),
          predictedMood: clampMood(mid),
          confidenceInterval: {
            low: clampMood(p10[i] != null ? p10[i] : mid),
            high: clampMood(p90[i] != null ? p90[i] : mid),
          },
          source: 'chronos',
        };
      });
    } catch (err) {
      return this._fallback(userId, daysAhead, err.message);
    }
  }
}

module.exports = ChronosService;

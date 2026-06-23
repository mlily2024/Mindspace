#!/usr/bin/env node
/**
 * Offline A/B harness: Chronos vs the univariate regression baseline on held-out
 * mood windows (A.4, ADR-0016).
 *
 * Holds out the last `horizon` days of each series, forecasts them with both
 * engines from the same training prefix, and scores both (MAE/RMSE + pinball/CRPS
 * + 80% interval coverage). Chronos failures are reported, never silently swapped
 * for the regression engine.
 *
 * IMPORTANT (honesty): with ~0 real users the real signal comes from `--source db`
 * once users exist. `--source synthetic` exercises the harness end-to-end and
 * produces illustrative numbers on generated series, NOT a claim about real users.
 * If Chronos (Python sidecar / spawn) is unavailable, the run still completes and
 * clearly reports the regression baseline only.
 *
 * Usage:
 *   node backend/scripts/ab-forecast-eval.js [--source synthetic|db] [--series N]
 *       [--horizon H] [--min-history M] [--out path]
 *
 * Env (Chronos): CHRONOS_URL set -> call the HTTP sidecar; else spawn the Python
 * forecaster (heavy ~14 s cold). AUDIT-style: no production path touched.
 */
/* eslint-disable no-console */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { pool } = require('../src/config/database');
const ChronosService = require('../src/services/chronosService');
const { runEval } = require('../src/services/forecastEvalService');

function parseArgs(argv) {
  const a = { source: 'synthetic', series: 12, horizon: 7, minHistory: 30, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const [k, v] = argv[i].split('=');
    const next = () => v ?? argv[(i += 1)];
    if (k === '--source') a.source = next();
    else if (k === '--series') a.series = parseInt(next(), 10);
    else if (k === '--horizon') a.horizon = parseInt(next(), 10);
    else if (k === '--min-history') a.minHistory = parseInt(next(), 10);
    else if (k === '--out') a.out = next();
  }
  return a;
}

/** Synthetic mood series: slow trend + weekly seasonality + noise, clamped 1..10. */
function makeSyntheticSeries(count, length) {
  const out = [];
  for (let s = 0; s < count; s += 1) {
    const base = 4 + Math.random() * 3; // 4..7
    const slope = (Math.random() - 0.5) * 0.04; // gentle drift
    const amp = 0.5 + Math.random() * 1.5; // weekly amplitude
    const phase = Math.random() * 7;
    const series = [];
    for (let t = 0; t < length; t += 1) {
      const seasonal = amp * Math.sin((2 * Math.PI * (t + phase)) / 7);
      const noise = (Math.random() - 0.5) * 1.2;
      series.push(Math.min(10, Math.max(1, base + slope * t + seasonal + noise)));
    }
    out.push(series);
  }
  return out;
}

/** Real per-user daily-mean mood series (mirrors chronosService._loadDailyMood). */
async function loadDbSeries() {
  const r = await pool.query(
    `SELECT user_id, DATE(created_at) AS day, AVG(mood_score)::float AS mood
       FROM mood_entries
      GROUP BY user_id, DATE(created_at)
      ORDER BY user_id, day ASC`
  );
  const byUser = new Map();
  for (const row of r.rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    const m = Number(row.mood);
    if (Number.isFinite(m)) byUser.get(row.user_id).push(m);
  }
  return [...byUser.values()];
}

function makeChronosFn() {
  const httpMode = !!(process.env.CHRONOS_URL || '').trim();
  return async (train, horizon) =>
    httpMode
      ? ChronosService._httpForecast(train, horizon)
      : ChronosService._runChronos(train, horizon);
}

function fmt(v) {
  return Number.isFinite(v) ? v.toFixed(3) : '  n/a';
}

function printReport(report) {
  const { baseline, chronos } = report.aggregate;
  console.log(`\nSeries: ${report.nEvaluated} evaluated, ${report.nSkipped} skipped (too short).`);
  console.log(`Chronos: ${report.chronosEvaluated} evaluated, ${report.chronosUnavailable} unavailable.`);
  if (!baseline) {
    console.log('No series had enough history to evaluate.');
    return;
  }
  const keys = ['mae', 'rmse', 'pinball50', 'crps', 'coverage80'];
  console.log('\n  metric        regression     chronos');
  console.log('  ------------  -----------    -----------');
  for (const k of keys) {
    const b = fmt(baseline[k]);
    const c = chronos ? fmt(chronos[k]) : '  n/a';
    console.log(`  ${k.padEnd(12)}  ${b.padStart(9)}    ${c.padStart(9)}`);
  }
  console.log('\n(lower is better except coverage80, whose target is ~0.80)');
  if (!chronos) {
    console.log(
      '\nChronos was unavailable for every series (Python sidecar / forecaster not\n' +
        'installed). Showing the regression baseline only — install Chronos to A/B.'
    );
  }
}

const main = async () => {
  const args = parseArgs(process.argv);
  try {
    let seriesList;
    if (args.source === 'db') {
      seriesList = await loadDbSeries();
      console.log(`Loaded ${seriesList.length} user series from the database.`);
    } else {
      seriesList = makeSyntheticSeries(args.series, args.minHistory + args.horizon + 14);
      console.log(`Generated ${seriesList.length} synthetic series (illustrative only).`);
    }

    const report = await runEval({
      seriesList,
      horizon: args.horizon,
      minHistory: args.minHistory,
      chronosFn: makeChronosFn(),
    });
    report.source = args.source;

    printReport(report);

    const outPath = args.out || path.resolve(__dirname, '..', 'data', 'forecast_eval_report.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nReport written to ${outPath}`);
  } catch (err) {
    console.error('A/B eval failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();

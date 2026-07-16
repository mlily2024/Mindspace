#!/usr/bin/env node
/**
 * Reset the Render demo to a clean seeded state.
 *
 * Designed for nightly cron on Render:
 *   1. Wipes any user-created accounts other than the demo user.
 *   2. Wipes the demo user's mood entries + sentiment rows.
 *   3. Re-seeds via the existing seed-demo-data.js script (calls the
 *      backend API to recreate the 7-day mood dataset).
 *
 * The demo credentials are hard-coded in seed-demo-data.js:
 *   email    = demo@mindspace.local
 *   password = DemoMindspace!2026
 *
 * Environment variables required:
 *   DATABASE_URL     — Render-managed Postgres connection string
 *   API_BASE_URL     — e.g. https://mindspace-demo-api.onrender.com/api
 *                      (the seed step POSTs to /auth/login + /mood)
 *
 * Usage (Render Cron Job, runs nightly):
 *   node backend/scripts/reset-demo.js
 */
/* eslint-disable no-console */

const path  = require('path');
const { spawn } = require('child_process');
const { Pool } = require('pg');

const DEMO_EMAIL = 'demo@mindspace.local';

async function wipeNonDemoUsers(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Identify the demo user id (may not exist yet on first run — that's fine)
    const demoRes = await client.query(
      'SELECT user_id FROM users WHERE email = $1 LIMIT 1',
      [DEMO_EMAIL]
    );
    const demoId = demoRes.rows[0]?.user_id ?? null;

    // Delete every user account other than the demo user. The schema's
    // ON DELETE CASCADE rules clean up child rows (mood_entries, sentiments,
    // assessments, etc.) automatically.
    const wipeRes = demoId
      ? await client.query('DELETE FROM users WHERE user_id <> $1', [demoId])
      : await client.query('DELETE FROM users');

    console.log(`  [ok] wiped ${wipeRes.rowCount} non-demo user account(s)`);

    // Clear the demo user's own time-series data so the re-seed produces a
    // fresh 7-day window every night.
    if (demoId) {
      await client.query('DELETE FROM mood_entries WHERE user_id = $1', [demoId]);
      await client.query('DELETE FROM mood_sentiments WHERE user_id = $1', [demoId])
        .catch(() => { /* table may not exist on very old schemas */ });
      console.log(`  [ok] cleared demo user's mood_entries + sentiments`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function runSeedScript() {
  return new Promise((resolve, reject) => {
    const seedPath = path.resolve(__dirname, 'seed-demo-data.js');
    // seed-demo-data.js reads SEED_API_BASE (default http://localhost:5000/api).
    // We accept API_BASE_URL on the cron-job side as the friendlier name and
    // map it through, so the Render-blueprint env value is what gets used.
    const seedApiBase = process.env.API_BASE_URL || process.env.SEED_API_BASE || '';
    const child = spawn(process.execPath, [seedPath], {
      stdio: 'inherit',
      env: { ...process.env, SEED_API_BASE: seedApiBase },
    });
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`seed-demo-data exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoffMs = (n) => Math.min(15000, 2000 * n); // 2s, 4s, ... capped at 15s
const ATTEMPT_TIMEOUT_MS = Number(process.env.DEMO_POLL_TIMEOUT_MS || 15000);

// Bounded health poll. A cold Render connection can hang in the connect phase
// far longer than undici honours AbortSignal for (run #19: a single hung poll
// ate the whole budget despite AbortSignal.timeout), so we also race the fetch
// against a wall-clock timer that is guaranteed to fire. That lets the warm-up
// loop keep retrying through the ~60-90s cold start instead of stalling on one
// request. Any abandoned socket is torn down when the process exits.
async function fetchHealth(url) {
  return Promise.race([
    fetch(url, { method: 'GET', signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) }),
    sleep(ATTEMPT_TIMEOUT_MS + 2000).then(() => {
      throw new Error(`no response within ${Math.round(ATTEMPT_TIMEOUT_MS / 1000)}s`);
    }),
  ]);
}

// The free-tier Render API (mindspace-demo-api) sleeps after ~15 min idle, so the
// 03:00 UTC cron always hits it cold and gets a 503 on the first request. Poll
// /health until it wakes BEFORE any destructive wipe, honouring the Retry-After
// header Render sends while spinning up. /health lives at the origin root, not
// under /api, so strip a trailing /api from the base.
function apiOrigin() {
  const base = process.env.API_BASE_URL || process.env.API_BASE || '';
  return base.replace(/\/api\/?$/, '');
}

async function waitForApi(budgetMs) {
  const healthUrl = `${apiOrigin()}/health`;
  const start = Date.now();
  console.log(`Waking demo API: ${healthUrl} (up to ${Math.round(budgetMs / 1000)}s)`);
  let attempt = 0;
  while (Date.now() - start < budgetMs) {
    attempt += 1;
    try {
      const res = await fetchHealth(healthUrl);
      if (res.status >= 200 && res.status < 300) {
        console.log(`  [ok] API is up (attempt ${attempt}, ${Math.round((Date.now() - start) / 1000)}s)`);
        return true;
      }
      const ra = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : backoffMs(attempt);
      console.log(`  attempt ${attempt}: HTTP ${res.status}; retrying in ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
    } catch (err) {
      const waitMs = backoffMs(attempt);
      console.log(`  attempt ${attempt}: ${err.message || err.code || err.name}; retrying in ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
    }
  }
  return false;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Refusing to run.');
    process.exit(1);
  }
  if (!process.env.API_BASE_URL && !process.env.API_BASE) {
    console.error('API_BASE_URL is not set. Refusing to run (seed needs the API).');
    process.exit(1);
  }

  // Wake the free-tier API before wiping anything. If it never comes up within
  // the budget, exit WITHOUT wiping so a bad night leaves the demo stale rather
  // than emptied-but-not-reseeded.
  const warmupMs = Number(process.env.DEMO_WARMUP_TIMEOUT_MS || 240000);
  if (!(await waitForApi(warmupMs))) {
    console.error(
      `Demo API did not become reachable within ${Math.round(warmupMs / 1000)}s. ` +
      'Skipping wipe to preserve existing demo data.'
    );
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log(`Resetting Render demo (${process.env.API_BASE_URL || process.env.API_BASE}) ...`);
    await wipeNonDemoUsers(pool);
    await runSeedScript();
    console.log('Demo reset complete.');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Reset failed:', err.stack || err.message);
  process.exit(1);
});

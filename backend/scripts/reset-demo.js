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
    const child = spawn(process.execPath, [seedPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        // seed-demo-data reads API_BASE_URL (or defaults to http://localhost:5000)
        API_BASE_URL: process.env.API_BASE_URL || process.env.API_BASE || '',
      },
    });
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`seed-demo-data exited with code ${code}`));
    });
    child.on('error', reject);
  });
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

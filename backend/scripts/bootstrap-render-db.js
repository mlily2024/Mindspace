#!/usr/bin/env node
/**
 * Bootstrap a fresh PostgreSQL database for the Render demo deployment.
 *
 * Applies database/schema.sql and every database/migrations/*.sql file in
 * order, idempotently (each migration uses CREATE TABLE IF NOT EXISTS /
 * ALTER TABLE IF NOT EXISTS so re-running is safe).
 *
 * Designed to run as Render's preDeployCommand on the backend Web Service.
 * It uses the DATABASE_URL env var that Render injects automatically when
 * the service is linked to a managed Postgres instance.
 *
 * Usage:
 *   node backend/scripts/bootstrap-render-db.js
 *
 * Exit codes:
 *   0  schema + all migrations applied (or already present)
 *   1  failure (logged with stack trace)
 */
/* eslint-disable no-console */

const fs    = require('fs');
const path  = require('path');
const { Pool } = require('pg');

const SCHEMA_PATH     = path.resolve(__dirname, '..', 'database', 'schema.sql');
const MIGRATIONS_DIR  = path.resolve(__dirname, '..', 'database', 'migrations');

async function applyFile(pool, file, label) {
  const sql = fs.readFileSync(file, 'utf8');
  if (!sql.trim()) {
    console.log(`  [skip] ${label}: empty`);
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`  [ok]   ${label}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`  [fail] ${label}: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Refusing to run.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },   // Render Postgres requires SSL
  });

  try {
    console.log('Bootstrapping Render demo database...');

    if (fs.existsSync(SCHEMA_PATH)) {
      await applyFile(pool, SCHEMA_PATH, 'schema.sql');
    } else {
      console.warn('  [warn] schema.sql not found; expecting migrations to be self-contained');
    }

    const migrations = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const m of migrations) {
      await applyFile(pool, path.join(MIGRATIONS_DIR, m), `migrations/${m}`);
    }

    console.log(`Bootstrap complete: ${migrations.length} migrations applied.`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Bootstrap failed:', err.stack || err.message);
  process.exit(1);
});

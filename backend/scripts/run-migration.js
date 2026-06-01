#!/usr/bin/env node
/**
 * Cross-platform SQL migration runner.
 *
 * Reads a SQL file and applies it inside a single transaction using the
 * existing pg pool. Designed for Windows/macOS/Linux without needing the
 * psql CLI installed.
 *
 * Usage:
 *   node backend/scripts/run-migration.js <path/to/migration.sql>
 *
 * Examples (run from project root):
 *   node backend/scripts/run-migration.js backend/database/migrations/007_add_push_subscriptions.sql
 *
 * Exit codes:
 *   0   migration applied (or already applied — migrations should be idempotent)
 *   1   usage error / file missing / SQL error
 */
/* eslint-disable no-console */

const fs   = require('fs');
const path = require('path');

// Load env from backend/.env regardless of where the script is invoked.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { pool } = require('../src/config/database');

const main = async () => {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node backend/scripts/run-migration.js <path/to/migration.sql>');
    process.exit(1);
  }

  const sqlPath = path.resolve(process.cwd(), arg);
  if (!fs.existsSync(sqlPath)) {
    console.error(`Migration file not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`Applying ${path.basename(sqlPath)} (${sql.length} chars)`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied successfully.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    console.error('Migration failed — rolled back.');
    console.error('  ' + (err.message || err));
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((err) => {
  console.error('Unexpected error:', err.message || err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Seed the 6 predefined digital therapeutic protocols into the database.
 *
 * Reference (not demo) data: every environment needs these rows for the
 * /api/protocols surface to function. Idempotent — re-running skips protocols
 * that already exist (matched by name), so it is safe to run on every deploy.
 *
 * Requirements:
 *   - backend/.env configured (DB connection).
 *   - Migration 006 already applied (creates the protocol tables).
 *
 * Usage:
 *   node backend/scripts/seed-protocols.js
 */
/* eslint-disable no-console */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { pool } = require('../src/config/database');
const ProtocolService = require('../src/services/protocolService');

const main = async () => {
  try {
    const result = await ProtocolService.seedProtocols();
    console.log(`Protocol seed: ${result.status} (count=${result.count}).`);
  } catch (err) {
    console.error('Protocol seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();

#!/usr/bin/env node
/**
 * Create (and self-verify) an external anchor of the AI audit log (ADR-0015, F.8).
 *
 * Computes a Merkle root over every user's current audit chain head, chains it
 * onto the previous anchor, persists it to `audit_anchors`, and publishes the
 * commitment to the configured append-only sink (see auditAnchorSink).
 *
 * Intended to run on a schedule (e.g. a daily cron). Idempotent in the sense that
 * each run simply appends the next anchor; running it more often just produces
 * more frequent commitments.
 *
 * Requirements:
 *   - backend/.env configured (DB connection).
 *   - Migration 015 applied (creates audit_anchors).
 *
 * Env (optional, see auditAnchorSink):
 *   AUDIT_ANCHOR_SINK = file | stdout | none   (default file)
 *   AUDIT_ANCHOR_FILE = path to the append-only log
 *
 * Usage:
 *   node backend/scripts/anchor-audit-log.js
 */
/* eslint-disable no-console */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { pool } = require('../src/config/database');
const anchorService = require('../src/services/anchorService');

const main = async () => {
  try {
    const anchor = await anchorService.createAnchor();
    console.log(
      `Anchor #${anchor.sequence_number} created: ${anchor.anchor_hash} ` +
        `(users=${anchor.user_count}, records=${anchor.record_count}, ` +
        `published=${anchor.external_receipt ? anchor.external_receipt.sink : 'no'})`
    );

    const v = await anchorService.verifyAnchor(anchor.anchor_id);
    console.log(`Self-verify: ${v.ok ? 'OK' : 'FAILED'}`);
    if (!v.ok) {
      console.error('Verification checks:', JSON.stringify(v.checks, null, 2));
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Anchor run failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();

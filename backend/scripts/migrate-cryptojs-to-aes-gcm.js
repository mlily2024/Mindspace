#!/usr/bin/env node
/**
 * One-shot migration: re-encrypt legacy CryptoJS-encoded mood_entries.notes
 * rows using the active AES-256-GCM scheme.
 *
 * Legacy format:  base64 blob (no colons)             — CryptoJS.AES.encrypt
 * New format:     iv:authTag:ciphertext (two colons)  — AES-256-GCM
 *
 * Usage:
 *   node backend/scripts/migrate-cryptojs-to-aes-gcm.js --dry-run   (default safe mode)
 *   node backend/scripts/migrate-cryptojs-to-aes-gcm.js             (live: writes UPDATE)
 *
 * Idempotent: re-running on an already-migrated DB finds 0 legacy rows.
 * Safe: only touches rows where `notes NOT LIKE '%:%:%'`. Any row that
 * fails to decrypt is left untouched and reported.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { decrypt, encrypt } = require('../src/utils/encryption');

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionTimeoutMillis: 5000
});

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE — will UPDATE rows'}`);

  const r = await pool.query(`
    SELECT entry_id, notes
      FROM mood_entries
     WHERE notes IS NOT NULL AND notes NOT LIKE '%:%:%'
  `);
  console.log(`Found ${r.rows.length} legacy-encrypted rows.`);

  let migrated = 0;
  let failed   = 0;

  for (const row of r.rows) {
    try {
      const plain = decrypt(row.notes);   // fallback handles legacy CryptoJS
      const fresh = encrypt(plain);        // writes new AES-GCM format
      if (!dryRun) {
        await pool.query(
          'UPDATE mood_entries SET notes = $1, is_encrypted = TRUE WHERE entry_id = $2',
          [fresh, row.entry_id]
        );
      }
      migrated++;
      console.log(`  OK   ${row.entry_id}  (legacy ${row.notes.length} → new ${fresh.length})`);
    } catch (err) {
      failed++;
      console.error(`  FAIL ${row.entry_id} — ${err.message}`);
    }
  }

  console.log('');
  console.log(`Summary:  migrated=${migrated}  failed=${failed}  mode=${dryRun ? 'DRY' : 'LIVE'}`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
})().catch(async (err) => {
  console.error('Fatal:', err.message);
  try { await pool.end(); } catch (_) {}
  process.exit(2);
});

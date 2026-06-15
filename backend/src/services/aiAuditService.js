const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../config/logger');

/**
 * aiAuditService — append-only, hash-chained audit log for AI interactions.
 *
 * Each user has their own integrity chain in `ai_audit_log`. A record's
 * `record_hash` is computed over a canonical (sorted-keys) JSON encoding
 * of the record fields together with the previous record's hash, so any
 * mutation of either content or order breaks the chain from that point on.
 *
 *   record_hash = SHA-256( canonical_payload  ||  '|'  ||  prev_hash )
 *
 * `prev_hash` is the literal string 'GENESIS' for a user's first record.
 *
 * Privacy
 *   Plaintext is never stored. The user message and the model response
 *   are reduced to SHA-256 hashes; structured outcome fields (safety
 *   verdict, classification, timing) are retained so the chain remains
 *   useful for compliance review.
 *
 * Concurrency
 *   append() runs inside a transaction with a per-user advisory lock,
 *   so concurrent calls for the same user serialise on the chain head
 *   without serialising the rest of the database.
 *
 * Non-blocking
 *   Callers SHOULD invoke append() fire-and-forget (with .catch). An
 *   audit failure must never block a user-facing AI response.
 */

const GENESIS = 'GENESIS';

/** Stable, sorted-keys JSON encoding — required for deterministic hashing. */
const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
};

/** SHA-256 hex of a UTF-8 string. */
const sha256Hex = (input) =>
  crypto.createHash('sha256').update(String(input), 'utf8').digest('hex');

/**
 * Canonical fields hashed into the chain. Order is fixed by the keys of
 * this object (alphabetised in stableStringify); never reorder existing
 * keys — that would break verification of historic records.
 */
const canonicalPayload = (rec) => ({
  audit_id:              rec.audit_id,
  conversation_id:       rec.conversation_id || null,
  created_at:            rec.created_at instanceof Date
                            ? rec.created_at.toISOString()
                            : rec.created_at,
  input_hash:            rec.input_hash,
  latency_ms:            rec.latency_ms == null ? null : Number(rec.latency_ms),
  model_version:         rec.model_version || null,
  output_classification: rec.output_classification,
  output_hash:           rec.output_hash,
  provider:              rec.provider,
  safety_verdict:        rec.safety_verdict || {},
  sequence_number:       Number(rec.sequence_number),
  user_id:               rec.user_id
});

const computeRecordHash = (rec, prevHash) =>
  sha256Hex(stableStringify(canonicalPayload(rec)) + '|' + prevHash);

/** Stable 32-bit signed integer for use with pg_advisory_xact_lock. */
const userLockKey = (userId) => {
  const hash = crypto.createHash('sha256').update(String(userId)).digest();
  // Read 4 bytes as signed int32 — pg advisory locks take a bigint, but
  // a 32-bit lock key has a wide enough namespace for per-user lock and
  // matches the smaller-form lock function.
  return hash.readInt32BE(0);
};

/**
 * Append a new audit record for `userId`. Returns the persisted row.
 *
 * @param {Object} args
 * @param {string} args.userId               required
 * @param {string|null} [args.conversationId]
 * @param {'anthropic'|'rule_based'|'crisis_filter'} args.provider
 * @param {string|null} [args.modelVersion]
 * @param {string} args.userMessage          plaintext — hashed before storage
 * @param {string} args.modelResponse        plaintext — hashed before storage
 * @param {Object} [args.safetyVerdict]      { crisisDetected, keywordsMatched, ... }
 * @param {string} args.outputClassification 'normal' | 'crisis_response' | 'fallback' | 'rule_based'
 * @param {number} [args.latencyMs]
 */
const append = async (args) => {
  const {
    userId,
    conversationId = null,
    provider,
    modelVersion = null,
    userMessage,
    modelResponse,
    safetyVerdict = {},
    outputClassification,
    latencyMs = null
  } = args;

  if (!userId)               throw new Error('aiAuditService.append: userId is required');
  if (!provider)             throw new Error('aiAuditService.append: provider is required');
  if (!outputClassification) throw new Error('aiAuditService.append: outputClassification is required');

  const inputHash  = sha256Hex(userMessage  || '');
  const outputHash = sha256Hex(modelResponse || '');

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [userLockKey(userId)]);

    const headQ = await client.query(
      `SELECT sequence_number, record_hash
         FROM ai_audit_log
        WHERE user_id = $1
        ORDER BY sequence_number DESC
        LIMIT 1`,
      [userId]
    );

    const seq      = headQ.rows.length ? Number(headQ.rows[0].sequence_number) + 1 : 1;
    const prevHash = headQ.rows.length ? headQ.rows[0].record_hash                : GENESIS;
    const auditId  = crypto.randomUUID();
    const createdAt = new Date();

    const recForHash = {
      audit_id:              auditId,
      user_id:               userId,
      sequence_number:       seq,
      created_at:            createdAt,
      conversation_id:       conversationId,
      provider,
      model_version:         modelVersion,
      input_hash:            inputHash,
      output_hash:           outputHash,
      safety_verdict:        safetyVerdict,
      output_classification: outputClassification,
      latency_ms:            latencyMs
    };

    const recordHash = computeRecordHash(recForHash, prevHash);

    const ins = await client.query(
      `INSERT INTO ai_audit_log
         (audit_id, user_id, sequence_number, created_at, conversation_id,
          provider, model_version, input_hash, output_hash, safety_verdict,
          output_classification, latency_ms, prev_hash, record_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        auditId, userId, seq, createdAt, conversationId,
        provider, modelVersion, inputHash, outputHash, safetyVerdict,
        outputClassification, latencyMs, prevHash, recordHash
      ]
    );

    await client.query('COMMIT');
    return ins.rows[0];
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Walk the audit chain for `userId` from the genesis forward, recomputing
 * each record_hash. Returns:
 *   { ok: true,  count }
 *   { ok: false, brokenAt: <sequence_number>, reason: 'prev_mismatch'|'hash_mismatch' }
 *
 * Designed to be O(n) — fine at the row counts this log produces.
 */
const verifyChain = async (userId) => {
  const r = await db.query(
    `SELECT *
       FROM ai_audit_log
      WHERE user_id = $1
      ORDER BY sequence_number ASC`,
    [userId]
  );

  let prevHash = GENESIS;
  for (const row of r.rows) {
    if (row.prev_hash !== prevHash) {
      return { ok: false, brokenAt: Number(row.sequence_number), reason: 'prev_mismatch' };
    }
    const expected = computeRecordHash({
      audit_id:              row.audit_id,
      user_id:               row.user_id,
      sequence_number:       row.sequence_number,
      created_at:            row.created_at,
      conversation_id:       row.conversation_id,
      provider:              row.provider,
      model_version:         row.model_version,
      input_hash:            row.input_hash,
      output_hash:           row.output_hash,
      safety_verdict:        row.safety_verdict,
      output_classification: row.output_classification,
      latency_ms:            row.latency_ms
    }, prevHash);

    if (expected !== row.record_hash) {
      return { ok: false, brokenAt: Number(row.sequence_number), reason: 'hash_mismatch' };
    }
    prevHash = row.record_hash;
  }
  return { ok: true, count: r.rows.length };
};

/** Fire-and-forget wrapper. Logs failures; never throws to the caller. */
const safeAppend = (args) => {
  append(args).catch((err) => {
    logger.warn('aiAuditService.append failed (non-blocking)', {
      userId: args && args.userId,
      provider: args && args.provider,
      error: err.message
    });
  });
};

/**
 * Export the user's full chain in a form suitable for independent verification.
 * Returns the same canonical-payload fields used to compute `record_hash`, plus
 * the hash + prev_hash for every row. A caller can rebuild each `record_hash`
 * locally with the algorithm in this module (or any independent implementation
 * of SHA-256 + the documented canonical payload) and confirm the chain is intact
 * without trusting the server's `verifyChain` result.
 *
 * Phase 1.2 of the privacy-enhancements handover (2026-06-15).
 */
const exportChain = async (userId) => {
  const r = await db.query(
    `SELECT audit_id, user_id, sequence_number, created_at,
            conversation_id, provider, model_version,
            input_hash, output_hash, safety_verdict, output_classification,
            latency_ms, record_hash, prev_hash
       FROM ai_audit_log
      WHERE user_id = $1
      ORDER BY sequence_number ASC`,
    [userId]
  );
  return {
    user_id:      userId,
    exported_at:  new Date().toISOString(),
    chain_length: r.rows.length,
    genesis:      GENESIS,
    hash_algo:    'SHA-256 over stable-stringified canonical payload (see aiAuditService.canonicalPayload)',
    records:      r.rows.map((row) => ({
      audit_id:              row.audit_id,
      sequence_number:       Number(row.sequence_number),
      created_at:            row.created_at,
      conversation_id:       row.conversation_id,
      provider:              row.provider,
      model_version:         row.model_version,
      input_hash:            row.input_hash,
      output_hash:           row.output_hash,
      safety_verdict:        row.safety_verdict,
      output_classification: row.output_classification,
      latency_ms:            row.latency_ms === null ? null : Number(row.latency_ms),
      record_hash:           row.record_hash,
      prev_hash:             row.prev_hash
    }))
  };
};

module.exports = {
  append,
  safeAppend,
  verifyChain,
  exportChain,
  // Exported for testing — the hash logic is the load-bearing bit.
  _internal: { stableStringify, sha256Hex, canonicalPayload, computeRecordHash, GENESIS, userLockKey }
};

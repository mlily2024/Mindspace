const db = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');
const { scoreResponses } = require('../data/screeningInstruments');

/**
 * ValidatedAssessment — persistence for the 5 free clinical-screening
 * instruments (PHQ-9, GAD-7, PSS-4, ISI, WEMWBS).
 *
 * E2EE shape mirrors MoodEntry (commit 60641e2) and JournalEntry
 * (commit c54347f): the responses array can be opaque ciphertext from
 * the client; total_score, severity_tier, and has_crisis_flag stay
 * plaintext for analytics and crisis dashboards.
 *
 * Schema: backend/database/migrations/014_validated_assessments.sql
 * Questions + scoring lookup: backend/src/data/screeningInstruments.js
 */

class ValidatedAssessment {
  /**
   * Create a new assessment row.
   * @param {string} userId
   * @param {object} data - { instrument, responses (int[]), note? (string?), is_e2ee_encrypted? }
   */
  static async create(userId, data) {
    const {
      instrument,
      responses,            // integer array (client always sends plaintext; we score then optionally encrypt)
      note            = null,
      is_e2ee_encrypted: isE2EE = false,
    } = data;

    // Always score on the server from the plaintext array the client just sent.
    // (Client cannot pre-encrypt and still let us score; for v1 we require
    // the responses in clear at submit time, then we encrypt-then-store.)
    const { total_score, severity_tier, has_crisis_flag } =
      scoreResponses(instrument, responses);

    let storedResponses = JSON.stringify(responses);
    let storedNote = note;
    let isLegacyEncrypted = false;
    if (isE2EE) {
      // For v1 we DO NOT support E2EE on submit because the server has to
      // score the responses (server cannot score opaque ciphertext). The
      // flag flows through for read paths only; on write we either skip
      // both encryption layers, or use legacy server-side AES-256-GCM
      // for at-rest protection.
      // A future v2 could score client-side and accept already-encrypted
      // responses. Out of scope for now.
      storedResponses = encrypt(storedResponses);
      if (storedNote) storedNote = encrypt(storedNote);
      isLegacyEncrypted = true;
    }

    const result = await db.query(
      `INSERT INTO validated_assessments (
        user_id, instrument, responses, total_score, severity_tier,
        has_crisis_flag, is_encrypted, is_e2ee_encrypted, note
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *`,
      [
        userId, instrument, storedResponses, total_score, severity_tier,
        has_crisis_flag, isLegacyEncrypted, false, storedNote,
      ]
    );
    return this._decryptRow(result.rows[0]);
  }

  static async getUserAssessments(userId, { instrument, limit = 30, offset = 0 } = {}) {
    const params = [userId];
    let sql = `SELECT assessment_id, instrument, responses, total_score, severity_tier,
                      has_crisis_flag, is_encrypted, is_e2ee_encrypted, note, completed_at
               FROM validated_assessments
               WHERE user_id = $1`;
    if (instrument) {
      params.push(instrument);
      sql += ` AND instrument = $${params.length}`;
    }
    sql += ` ORDER BY completed_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await db.query(sql, params);
    return result.rows.map(r => this._decryptRow(r));
  }

  static async getLatestPerInstrument(userId) {
    const result = await db.query(
      `SELECT DISTINCT ON (instrument)
              assessment_id, instrument, responses, total_score, severity_tier,
              has_crisis_flag, is_encrypted, is_e2ee_encrypted, note, completed_at
       FROM validated_assessments
       WHERE user_id = $1
       ORDER BY instrument, completed_at DESC`,
      [userId]
    );
    return result.rows.map(r => this._decryptRow(r));
  }

  static async deleteOne(assessmentId, userId) {
    const result = await db.query(
      `DELETE FROM validated_assessments WHERE assessment_id = $1 AND user_id = $2 RETURNING assessment_id`,
      [assessmentId, userId]
    );
    return result.rowCount > 0;
  }

  // Internal: decrypt legacy-encrypted columns, parse responses JSON to array.
  static _decryptRow(row) {
    if (!row) return row;
    if (row.is_encrypted && !row.is_e2ee_encrypted) {
      if (row.responses) row.responses = decrypt(row.responses);
      if (row.note)      row.note      = decrypt(row.note);
    }
    if (row.responses && typeof row.responses === 'string') {
      try { row.responses = JSON.parse(row.responses); }
      catch (_) { /* leave as string if not JSON */ }
    }
    return row;
  }
}

module.exports = ValidatedAssessment;

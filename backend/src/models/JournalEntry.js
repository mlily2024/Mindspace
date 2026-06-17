const db = require('../config/database');
const { encrypt, decrypt } = require('../utils/encryption');

/**
 * JournalEntry — persistence for the Journal page (W2 polish 2026-06-17).
 *
 * Mirrors the MoodEntry E2EE shape (commit 60641e2): when the client sets
 * is_e2ee_encrypted=true, `response` and `follow_up_responses` are opaque
 * ciphertext blobs and the server stores them as-is; when false, the
 * server applies its own AES-256-GCM at rest (legacy `encrypt`). Read
 * paths skip server-side decrypt for E2EE rows so the opaque blob reaches
 * the client untouched.
 *
 * Schema: backend/database/migrations/013_journal_entries.sql
 */

const _legacyEncryptIfText = (val) => (val ? encrypt(val) : null);

const _legacyDecryptIfRow = (row) => {
  if (!row) return row;
  if (row.is_encrypted && !row.is_e2ee_encrypted) {
    if (row.response)            row.response            = decrypt(row.response);
    if (row.follow_up_responses) row.follow_up_responses = decrypt(row.follow_up_responses);
  }
  return row;
};

class JournalEntry {
  static async create(userId, data) {
    const {
      promptId,
      promptText,
      response          = null,
      followUpResponses = null, // already-serialised string (JSON.stringify on the client)
      moodBefore        = null,
      moodAfter         = null,
      is_e2ee_encrypted: isE2EE = false,
    } = data;

    const hasAnyText = Boolean(response) || Boolean(followUpResponses);

    let storedResponse  = response;
    let storedFollowUps = followUpResponses;
    let isLegacyEncrypted = false;
    if (hasAnyText) {
      if (isE2EE) {
        // Client already encrypted; store opaque
        isLegacyEncrypted = false;
      } else {
        storedResponse  = _legacyEncryptIfText(response);
        storedFollowUps = _legacyEncryptIfText(followUpResponses);
        isLegacyEncrypted = true;
      }
    }
    const finalE2EEFlag = isE2EE && hasAnyText;

    const result = await db.query(
      `
      INSERT INTO journal_entries (
        user_id, prompt_id, prompt_text, response, follow_up_responses,
        mood_before, mood_after, is_encrypted, is_e2ee_encrypted
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
      `,
      [
        userId, promptId, promptText, storedResponse, storedFollowUps,
        moodBefore, moodAfter, isLegacyEncrypted, finalE2EEFlag,
      ]
    );
    return _legacyDecryptIfRow(result.rows[0]);
  }

  static async getUserEntries(userId, { limit = 30, offset = 0 } = {}) {
    const result = await db.query(
      `
      SELECT entry_id, prompt_id, prompt_text, response, follow_up_responses,
             mood_before, mood_after, is_encrypted, is_e2ee_encrypted,
             created_at, updated_at
        FROM journal_entries
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset]
    );
    return result.rows.map(_legacyDecryptIfRow);
  }

  static async deleteOne(entryId, userId) {
    const result = await db.query(
      `DELETE FROM journal_entries WHERE entry_id = $1 AND user_id = $2 RETURNING entry_id`,
      [entryId, userId]
    );
    return result.rowCount > 0;
  }
}

module.exports = JournalEntry;

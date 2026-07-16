const db = require('../config/database');

/**
 * PasswordResetToken — persistence for single-use, short-lived password-reset
 * tokens. Only the SHA-256 hash of a token is stored; the raw token lives only
 * in the emailed reset link. See migration 016.
 */
class PasswordResetToken {
  /**
   * Store a new reset token hash for a user.
   * @param {string} userId
   * @param {string} tokenHash - SHA-256 hex of the raw token
   * @param {Date} expiresAt
   */
  static async create(userId, tokenHash, expiresAt) {
    const result = await db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, expires_at`,
      [userId, tokenHash, expiresAt]
    );
    return result.rows[0];
  }

  /**
   * Find a token by hash that is unused and not yet expired.
   * Returns undefined if none matches.
   */
  static async findValidByHash(tokenHash) {
    const result = await db.query(
      `SELECT id, user_id, expires_at, used_at
         FROM password_reset_tokens
        WHERE token_hash = $1
          AND used_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
        LIMIT 1`,
      [tokenHash]
    );
    return result.rows[0];
  }

  /** Mark a token as used (single-use). */
  static async markUsed(id) {
    await db.query(
      `UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
  }

  /** Remove all reset tokens for a user (invalidate prior links). */
  static async deleteForUser(userId) {
    await db.query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1`,
      [userId]
    );
  }
}

module.exports = PasswordResetToken;

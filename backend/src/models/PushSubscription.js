const db = require('../config/database');

/**
 * PushSubscription — persistence for browser Web Push endpoints.
 *
 * One row per (user, browser-endpoint). The UNIQUE(user_id, endpoint)
 * constraint lets re-subscriptions from the same browser upsert cleanly
 * (browsers may rotate their auth/p256dh keys silently).
 */
class PushSubscription {

  /**
   * Insert or update a subscription. Returns the row.
   * @param {string|number} userId
   * @param {{endpoint:string, p256dhKey:string, authKey:string, userAgent?:string|null}} sub
   */
  static async upsert(userId, { endpoint, p256dhKey, authKey, userAgent = null }) {
    const query = `
      INSERT INTO push_subscriptions
        (user_id, endpoint, p256dh_key, auth_key, user_agent, last_used_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (user_id, endpoint)
      DO UPDATE SET
        p256dh_key   = EXCLUDED.p256dh_key,
        auth_key     = EXCLUDED.auth_key,
        user_agent   = COALESCE(EXCLUDED.user_agent, push_subscriptions.user_agent),
        last_used_at = NOW()
      RETURNING *
    `;
    const result = await db.query(query, [userId, endpoint, p256dhKey, authKey, userAgent]);
    return result.rows[0];
  }

  /** Return all subscriptions for a user (most-recent first). */
  static async findByUser(userId) {
    const result = await db.query(
      `SELECT subscription_id, user_id, endpoint, p256dh_key, auth_key,
              user_agent, created_at, last_used_at
         FROM push_subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /** Remove a single subscription identified by (user, endpoint). */
  static async deleteByEndpoint(userId, endpoint) {
    const result = await db.query(
      `DELETE FROM push_subscriptions
        WHERE user_id = $1 AND endpoint = $2
        RETURNING subscription_id`,
      [userId, endpoint]
    );
    return result.rowCount;
  }

  /** Remove all subscriptions for a user (e.g. on account deletion). */
  static async deleteByUser(userId) {
    const result = await db.query(
      `DELETE FROM push_subscriptions WHERE user_id = $1`,
      [userId]
    );
    return result.rowCount;
  }

  /** Bump last_used_at on successful dispatch. Fire-and-forget. */
  static async touchLastUsed(subscriptionId) {
    await db.query(
      `UPDATE push_subscriptions SET last_used_at = NOW() WHERE subscription_id = $1`,
      [subscriptionId]
    );
  }
}

module.exports = PushSubscription;

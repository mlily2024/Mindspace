const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class User {
  /**
   * Create a new user
   */
  static async create({ email, username, password, isAnonymous = false, userGroup }) {
    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (user_id, email, username, password_hash, is_anonymous, user_group)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING user_id, email, username, is_anonymous, user_group, created_at
    `;

    const values = [
      userId,
      isAnonymous ? null : email,
      username || `user_${userId.substring(0, 8)}`,
      passwordHash,
      isAnonymous,
      userGroup || 'other'
    ];

    const result = await db.query(query, values);

    // Create default preferences
    await this.createDefaultPreferences(userId);

    return result.rows[0];
  }

  /**
   * Create default user preferences
   */
  static async createDefaultPreferences(userId) {
    const query = `
      INSERT INTO user_preferences (user_id)
      VALUES ($1)
      RETURNING *
    `;

    return await db.query(query, [userId]);
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const query = `
      SELECT * FROM users
      WHERE email = $1 AND account_status = 'active'
    `;

    const result = await db.query(query, [email]);
    return result.rows[0];
  }

  /**
   * Find user by ID
   */
  static async findById(userId) {
    const query = `
      SELECT
        u.user_id, u.email, u.username, u.is_anonymous, u.user_group,
        u.timezone, u.created_at, u.last_login, u.account_status,
        up.language, up.theme, up.accessibility_mode, up.font_size,
        up.notifications_enabled, up.data_sharing_consent, up.peer_support_enabled
      FROM users u
      LEFT JOIN user_preferences up ON u.user_id = up.user_id
      WHERE u.user_id = $1 AND u.account_status = 'active'
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Verify password
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Update last login timestamp
   */
  static async updateLastLogin(userId) {
    const query = `
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;

    await db.query(query, [userId]);
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId, updates) {
    const allowedFields = ['username', 'user_group', 'timezone'];
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);
    const query = `
      UPDATE users
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $${paramCount}
      RETURNING user_id, email, username, user_group, timezone, updated_at
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(userId, preferences) {
    const allowedFields = [
      'language', 'theme', 'accessibility_mode', 'font_size',
      'notifications_enabled', 'data_sharing_consent', 'peer_support_enabled'
    ];

    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(preferences).forEach(key => {
      if (allowedFields.includes(key) && preferences[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(preferences[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(userId);
    const query = `
      UPDATE user_preferences
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Soft delete user account (GDPR compliance)
   */
  static async deleteAccount(userId) {
    const query = `
      UPDATE users
      SET account_status = 'deleted',
          email = NULL,
          username = 'deleted_user',
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING user_id
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Request data export (GDPR compliance)
   */
  static async requestDataExport(userId) {
    const requestId = uuidv4();
    const query = `
      INSERT INTO data_export_requests (request_id, user_id, request_type, request_status)
      VALUES ($1, $2, 'export', 'pending')
      RETURNING *
    `;

    const result = await db.query(query, [requestId, userId]);
    return result.rows[0];
  }
}

module.exports = User;

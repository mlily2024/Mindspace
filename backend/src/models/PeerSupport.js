const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { encrypt, decrypt } = require('../utils/encryption');

/**
 * PeerSupport Model
 * Handles database operations for peer support groups, members, and messages
 */
class PeerSupport {
  // ==================== GROUP OPERATIONS ====================

  /**
   * Create a new peer support group
   * @param {Object} groupData - Group data
   * @returns {Object} Created group
   */
  static async createGroup(groupData) {
    const groupId = uuidv4();
    const {
      name,
      description,
      groupType = 'general',
      maxMembers = 50,
      isModerated = true,
      createdBy
    } = groupData;

    const query = `
      INSERT INTO peer_support_groups (
        group_id, name, description, group_type, max_members, is_moderated, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [groupId, name, description, groupType, maxMembers, isModerated, createdBy];
    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get all available groups
   * @param {Object} filters - Optional filters
   * @returns {Array} List of groups
   */
  static async getGroups(filters = {}) {
    const { groupType, isActive = true, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        g.*,
        COUNT(gm.member_id) as member_count
      FROM peer_support_groups g
      LEFT JOIN group_members gm ON g.group_id = gm.group_id AND gm.is_active = true
      WHERE g.is_active = $1
    `;

    const values = [isActive];
    let paramCount = 2;

    if (groupType) {
      query += ` AND g.group_type = $${paramCount}`;
      values.push(groupType);
      paramCount++;
    }

    query += `
      GROUP BY g.group_id
      ORDER BY g.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    values.push(limit, offset);

    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Get a single group by ID
   * @param {string} groupId - Group ID
   * @returns {Object|null} Group data
   */
  static async getGroupById(groupId) {
    const query = `
      SELECT
        g.*,
        COUNT(gm.member_id) as member_count
      FROM peer_support_groups g
      LEFT JOIN group_members gm ON g.group_id = gm.group_id AND gm.is_active = true
      WHERE g.group_id = $1
      GROUP BY g.group_id
    `;

    const result = await db.query(query, [groupId]);
    return result.rows[0] || null;
  }

  /**
   * Update group details
   * @param {string} groupId - Group ID
   * @param {Object} updates - Fields to update
   * @returns {Object} Updated group
   */
  static async updateGroup(groupId, updates) {
    const allowedFields = ['name', 'description', 'max_members', 'is_moderated', 'is_active'];
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

    values.push(groupId);
    const query = `
      UPDATE peer_support_groups
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE group_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  // ==================== MEMBERSHIP OPERATIONS ====================

  /**
   * Join a peer support group
   * @param {string} userId - User ID
   * @param {string} groupId - Group ID
   * @param {string} anonymousNickname - Anonymous display name
   * @returns {Object} Membership record
   */
  static async joinGroup(userId, groupId, anonymousNickname) {
    const memberId = uuidv4();

    // Check if already a member
    const existingQuery = `
      SELECT * FROM group_members
      WHERE user_id = $1 AND group_id = $2
    `;
    const existing = await db.query(existingQuery, [userId, groupId]);

    if (existing.rows.length > 0) {
      // Reactivate if previously left
      if (!existing.rows[0].is_active) {
        const reactivateQuery = `
          UPDATE group_members
          SET is_active = true, anonymous_nickname = $3, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND group_id = $2
          RETURNING *
        `;
        const result = await db.query(reactivateQuery, [userId, groupId, anonymousNickname]);
        return result.rows[0];
      }
      throw new Error('Already a member of this group');
    }

    // Check group capacity
    const groupQuery = `
      SELECT g.max_members, COUNT(gm.member_id) as current_members
      FROM peer_support_groups g
      LEFT JOIN group_members gm ON g.group_id = gm.group_id AND gm.is_active = true
      WHERE g.group_id = $1
      GROUP BY g.group_id
    `;
    const groupResult = await db.query(groupQuery, [groupId]);

    if (groupResult.rows.length === 0) {
      throw new Error('Group not found');
    }

    const { max_members, current_members } = groupResult.rows[0];
    if (parseInt(current_members) >= max_members) {
      throw new Error('Group is full');
    }

    // Add member
    const query = `
      INSERT INTO group_members (member_id, group_id, user_id, anonymous_nickname)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query(query, [memberId, groupId, userId, anonymousNickname]);
    return result.rows[0];
  }

  /**
   * Leave a peer support group
   * @param {string} userId - User ID
   * @param {string} groupId - Group ID
   * @returns {Object|null} Updated membership
   */
  static async leaveGroup(userId, groupId) {
    const query = `
      UPDATE group_members
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND group_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [userId, groupId]);
    return result.rows[0] || null;
  }

  /**
   * Get user's joined groups
   * @param {string} userId - User ID
   * @returns {Array} List of groups
   */
  static async getUserGroups(userId) {
    const query = `
      SELECT
        g.*,
        gm.anonymous_nickname,
        gm.is_moderator,
        gm.joined_at,
        COUNT(DISTINCT gm2.member_id) as member_count
      FROM group_members gm
      JOIN peer_support_groups g ON gm.group_id = g.group_id
      LEFT JOIN group_members gm2 ON g.group_id = gm2.group_id AND gm2.is_active = true
      WHERE gm.user_id = $1 AND gm.is_active = true
      GROUP BY g.group_id, gm.anonymous_nickname, gm.is_moderator, gm.joined_at
      ORDER BY gm.joined_at DESC
    `;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get members of a group
   * @param {string} groupId - Group ID
   * @returns {Array} List of members (anonymous)
   */
  static async getGroupMembers(groupId) {
    const query = `
      SELECT
        member_id,
        anonymous_nickname,
        is_moderator,
        joined_at,
        is_active
      FROM group_members
      WHERE group_id = $1 AND is_active = true
      ORDER BY is_moderator DESC, joined_at ASC
    `;

    const result = await db.query(query, [groupId]);
    return result.rows;
  }

  /**
   * Get user's membership in a group
   * @param {string} userId - User ID
   * @param {string} groupId - Group ID
   * @returns {Object|null} Membership record
   */
  static async getMembership(userId, groupId) {
    const query = `
      SELECT * FROM group_members
      WHERE user_id = $1 AND group_id = $2 AND is_active = true
    `;

    const result = await db.query(query, [userId, groupId]);
    return result.rows[0] || null;
  }

  /**
   * Set moderator status
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @param {boolean} isModerator - Moderator status
   * @returns {Object} Updated membership
   */
  static async setModerator(groupId, userId, isModerator) {
    const query = `
      UPDATE group_members
      SET is_moderator = $3, updated_at = CURRENT_TIMESTAMP
      WHERE group_id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [groupId, userId, isModerator]);
    return result.rows[0];
  }

  // ==================== MESSAGE OPERATIONS ====================

  /**
   * Send a message to a group
   * @param {string} groupId - Group ID
   * @param {string} userId - User ID
   * @param {string} content - Message content
   * @returns {Object} Created message
   */
  static async sendMessage(groupId, userId, content) {
    const messageId = uuidv4();

    // Get user's anonymous nickname
    const memberQuery = `
      SELECT anonymous_nickname FROM group_members
      WHERE group_id = $1 AND user_id = $2 AND is_active = true
    `;
    const memberResult = await db.query(memberQuery, [groupId, userId]);

    if (memberResult.rows.length === 0) {
      throw new Error('Not a member of this group');
    }

    const anonymousNickname = memberResult.rows[0].anonymous_nickname;

    const query = `
      INSERT INTO peer_messages (message_id, group_id, user_id, anonymous_nickname, content)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await db.query(query, [messageId, groupId, userId, anonymousNickname, content]);
    return result.rows[0];
  }

  /**
   * Get messages from a group
   * @param {string} groupId - Group ID
   * @param {Object} options - Pagination options
   * @returns {Array} List of messages
   */
  static async getMessages(groupId, options = {}) {
    const { limit = 50, before, after } = options;

    let query = `
      SELECT
        message_id,
        group_id,
        anonymous_nickname,
        content,
        is_moderated,
        created_at,
        edited_at
      FROM peer_messages
      WHERE group_id = $1 AND is_deleted = false
    `;

    const values = [groupId];
    let paramCount = 2;

    if (before) {
      query += ` AND created_at < $${paramCount}`;
      values.push(before);
      paramCount++;
    }

    if (after) {
      query += ` AND created_at > $${paramCount}`;
      values.push(after);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    values.push(limit);

    const result = await db.query(query, values);
    return result.rows.reverse(); // Return in chronological order
  }

  /**
   * Get a single message by ID
   * @param {string} messageId - Message ID
   * @returns {Object|null} Message data
   */
  static async getMessageById(messageId) {
    const query = `
      SELECT * FROM peer_messages
      WHERE message_id = $1 AND is_deleted = false
    `;

    const result = await db.query(query, [messageId]);
    return result.rows[0] || null;
  }

  /**
   * Flag a message for moderation
   * @param {string} messageId - Message ID
   * @param {string} reason - Flag reason
   * @returns {Object} Updated message
   */
  static async flagMessage(messageId, reason) {
    const query = `
      UPDATE peer_messages
      SET is_flagged = true, flag_reason = $2
      WHERE message_id = $1
      RETURNING *
    `;

    const result = await db.query(query, [messageId, reason]);
    return result.rows[0];
  }

  /**
   * Moderate a message
   * @param {string} messageId - Message ID
   * @param {string} action - 'approve' or 'delete'
   * @returns {Object} Updated message
   */
  static async moderateMessage(messageId, action) {
    let query;

    if (action === 'delete') {
      query = `
        UPDATE peer_messages
        SET is_deleted = true, is_moderated = true
        WHERE message_id = $1
        RETURNING *
      `;
    } else if (action === 'approve') {
      query = `
        UPDATE peer_messages
        SET is_flagged = false, flag_reason = NULL, is_moderated = true
        WHERE message_id = $1
        RETURNING *
      `;
    } else {
      throw new Error('Invalid moderation action');
    }

    const result = await db.query(query, [messageId]);
    return result.rows[0];
  }

  /**
   * Delete a message (soft delete)
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID (for ownership check)
   * @returns {Object|null} Deleted message
   */
  static async deleteMessage(messageId, userId) {
    const query = `
      UPDATE peer_messages
      SET is_deleted = true
      WHERE message_id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [messageId, userId]);
    return result.rows[0] || null;
  }

  /**
   * Get flagged messages for moderation
   * @param {string} groupId - Optional group ID filter
   * @returns {Array} List of flagged messages
   */
  static async getFlaggedMessages(groupId = null) {
    let query = `
      SELECT pm.*, g.name as group_name
      FROM peer_messages pm
      JOIN peer_support_groups g ON pm.group_id = g.group_id
      WHERE pm.is_flagged = true AND pm.is_deleted = false AND pm.is_moderated = false
    `;

    const values = [];

    if (groupId) {
      query += ` AND pm.group_id = $1`;
      values.push(groupId);
    }

    query += ` ORDER BY pm.created_at DESC`;

    const result = await db.query(query, values);
    return result.rows;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Generate a random anonymous nickname
   * @returns {string} Random nickname
   */
  static generateAnonymousNickname() {
    const adjectives = [
      'Gentle', 'Calm', 'Brave', 'Kind', 'Wise', 'Hopeful', 'Peaceful', 'Caring',
      'Warm', 'Bright', 'Strong', 'Serene', 'Resilient', 'Thoughtful', 'Graceful'
    ];
    const nouns = [
      'Robin', 'River', 'Star', 'Cloud', 'Meadow', 'Breeze', 'Light', 'Moon',
      'Willow', 'Oak', 'Fern', 'Wave', 'Hill', 'Sage', 'Path'
    ];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const number = Math.floor(Math.random() * 100);

    return `${adjective}${noun}${number}`;
  }

  /**
   * Check if nickname is unique in a group
   * @param {string} groupId - Group ID
   * @param {string} nickname - Nickname to check
   * @returns {boolean} True if unique
   */
  static async isNicknameUnique(groupId, nickname) {
    const query = `
      SELECT COUNT(*) as count FROM group_members
      WHERE group_id = $1 AND anonymous_nickname = $2 AND is_active = true
    `;

    const result = await db.query(query, [groupId, nickname]);
    return parseInt(result.rows[0].count) === 0;
  }
}

module.exports = PeerSupport;

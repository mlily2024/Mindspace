const db = require('../config/database');
const logger = require('../config/logger');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Data Export Service - GDPR compliant data export
 */
class DataExportService {
  /**
   * Generate complete data export for a user
   */
  static async generateExport(userId) {
    try {
      logger.info('Starting data export generation', { userId });

      // Gather all user data
      const [
        userData,
        preferences,
        moodEntries,
        insights,
        recommendations,
        chatbotConversations,
        chatbotMessages,
        peerGroups,
        peerMessages,
        achievements,
        streaks
      ] = await Promise.all([
        this.getUserData(userId),
        this.getUserPreferences(userId),
        this.getMoodEntries(userId),
        this.getInsights(userId),
        this.getRecommendations(userId),
        this.getChatbotConversations(userId),
        this.getChatbotMessages(userId),
        this.getPeerGroups(userId),
        this.getPeerMessages(userId),
        this.getAchievements(userId),
        this.getStreaks(userId)
      ]);

      // Compile export data
      const exportData = {
        exportInfo: {
          exportId: uuidv4(),
          userId: userId,
          exportDate: new Date().toISOString(),
          exportFormat: 'JSON',
          gdprCompliant: true
        },
        profile: {
          ...userData,
          password_hash: '[REDACTED]' // Never export password hash
        },
        preferences,
        moodEntries: {
          count: moodEntries.length,
          entries: moodEntries
        },
        insights: {
          count: insights.length,
          entries: insights
        },
        recommendations: {
          count: recommendations.length,
          entries: recommendations
        },
        chatbot: {
          conversationCount: chatbotConversations.length,
          conversations: chatbotConversations,
          messageCount: chatbotMessages.length,
          messages: chatbotMessages
        },
        peerSupport: {
          groupMemberships: peerGroups,
          messages: peerMessages
        },
        gamification: {
          streaks,
          achievements
        }
      };

      // Generate export file
      const exportDir = path.join(__dirname, '../../exports');
      await fs.mkdir(exportDir, { recursive: true });

      const fileName = `export_${userId}_${Date.now()}.json`;
      const filePath = path.join(exportDir, fileName);

      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

      // Update export request status
      await this.updateExportRequest(userId, 'completed', filePath);

      logger.info('Data export completed', { userId, filePath });

      return {
        success: true,
        filePath,
        fileName,
        data: exportData
      };
    } catch (error) {
      logger.error('Data export error', { error: error.message, userId });
      await this.updateExportRequest(userId, 'failed', null);
      throw error;
    }
  }

  /**
   * Get user profile data
   */
  static async getUserData(userId) {
    const query = `
      SELECT user_id, email, username, is_anonymous, user_group, timezone,
             created_at, updated_at, last_login, account_status, email_verified
      FROM users WHERE user_id = $1
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Get user preferences
   */
  static async getUserPreferences(userId) {
    const query = `SELECT * FROM user_preferences WHERE user_id = $1`;
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Get all mood entries
   */
  static async getMoodEntries(userId) {
    const query = `
      SELECT entry_id, entry_date, entry_time, mood_score, energy_level,
             stress_level, sleep_quality, sleep_hours, anxiety_level,
             social_interaction_quality, notes, activities, triggers, created_at
      FROM mood_entries
      WHERE user_id = $1
      ORDER BY entry_date DESC, entry_time DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get all insights
   */
  static async getInsights(userId) {
    const query = `
      SELECT insight_id, insight_type, insight_period, insight_data,
             severity, is_read, generated_at
      FROM user_insights
      WHERE user_id = $1
      ORDER BY generated_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get all recommendations
   */
  static async getRecommendations(userId) {
    const query = `
      SELECT recommendation_id, recommendation_type, title, description,
             effort_level, estimated_duration, is_completed, completed_at, created_at
      FROM recommendations
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get chatbot conversations
   */
  static async getChatbotConversations(userId) {
    const query = `
      SELECT conversation_id, started_at, ended_at, mood_at_start, mood_at_end
      FROM chatbot_conversations
      WHERE user_id = $1
      ORDER BY started_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get chatbot messages
   */
  static async getChatbotMessages(userId) {
    const query = `
      SELECT message_id, conversation_id, sender, message_content,
             message_type, emotion_detected, created_at
      FROM chatbot_messages
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get peer support group memberships
   */
  static async getPeerGroups(userId) {
    const query = `
      SELECT gm.membership_id, gm.anonymous_nickname, gm.joined_at, gm.is_moderator,
             psg.group_name, psg.group_type
      FROM group_members gm
      JOIN peer_support_groups psg ON gm.group_id = psg.group_id
      WHERE gm.user_id = $1
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get peer support messages
   */
  static async getPeerMessages(userId) {
    const query = `
      SELECT message_id, anonymous_nickname, message_content, created_at
      FROM peer_messages
      WHERE user_id = $1 AND is_deleted = false
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get user achievements
   */
  static async getAchievements(userId) {
    const query = `
      SELECT a.achievement_code, a.title, a.description, a.icon, a.category,
             ua.earned_at
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.achievement_id
      WHERE ua.user_id = $1
      ORDER BY ua.earned_at DESC
    `;
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get user streaks
   */
  static async getStreaks(userId) {
    const query = `SELECT * FROM user_streaks WHERE user_id = $1`;
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Update export request status
   */
  static async updateExportRequest(userId, status, filePath) {
    const query = `
      UPDATE data_export_requests
      SET request_status = $2,
          export_file_path = $3,
          completed_at = CASE WHEN $2 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END
      WHERE user_id = $1
        AND request_status = 'pending'
      ORDER BY requested_at DESC
      LIMIT 1
    `;
    await db.query(query, [userId, status, filePath]);
  }

  /**
   * Get export file for download
   */
  static async getExportFile(userId, requestId) {
    const query = `
      SELECT export_file_path, request_status
      FROM data_export_requests
      WHERE user_id = $1 AND request_id = $2
    `;
    const result = await db.query(query, [userId, requestId]);

    if (result.rows.length === 0) {
      return null;
    }

    const { export_file_path, request_status } = result.rows[0];

    if (request_status !== 'completed' || !export_file_path) {
      return null;
    }

    try {
      const fileContent = await fs.readFile(export_file_path, 'utf8');
      return {
        content: fileContent,
        fileName: path.basename(export_file_path)
      };
    } catch (error) {
      logger.error('Error reading export file', { error: error.message });
      return null;
    }
  }

  /**
   * Delete user data (GDPR right to be forgotten)
   */
  static async deleteUserData(userId) {
    try {
      logger.info('Starting user data deletion', { userId });

      // Delete in order of dependencies
      await db.query('DELETE FROM chatbot_messages WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM chatbot_conversations WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM peer_messages WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM group_members WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM recommendation_feedback WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM recommendations WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM user_insights WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM safety_alerts WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM mood_entries WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM user_streaks WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM user_preferences WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM emergency_contacts WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM data_export_requests WHERE user_id = $1', [userId]);

      // Finally delete the user (hard delete for GDPR compliance)
      await db.query('DELETE FROM users WHERE user_id = $1', [userId]);

      logger.info('User data deletion completed', { userId });

      return { success: true };
    } catch (error) {
      logger.error('User data deletion error', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = DataExportService;

const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * ChatbotMessage Model
 * Handles all chatbot conversation and message operations
 */

class ChatbotMessage {
  /**
   * Start a new conversation
   */
  static async startConversation(userId, moodAtStart = null) {
    const conversationId = uuidv4();
    const query = `
      INSERT INTO chatbot_conversations (conversation_id, user_id, mood_at_start)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await db.query(query, [conversationId, userId, moodAtStart]);
    return result.rows[0];
  }

  /**
   * End a conversation
   */
  static async endConversation(conversationId, moodAtEnd = null, summary = null) {
    const query = `
      UPDATE chatbot_conversations
      SET ended_at = CURRENT_TIMESTAMP, is_active = false, mood_at_end = $2, conversation_summary = $3
      WHERE conversation_id = $1
      RETURNING *
    `;
    const result = await db.query(query, [conversationId, moodAtEnd, summary]);
    return result.rows[0];
  }

  /**
   * Get active conversation for user
   */
  static async getActiveConversation(userId) {
    const query = `
      SELECT * FROM chatbot_conversations
      WHERE user_id = $1 AND is_active = true
      ORDER BY started_at DESC
      LIMIT 1
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Save a message
   */
  static async saveMessage(conversationId, userId, sender, content, messageType = 'text', emotionDetected = null) {
    const messageId = uuidv4();
    const query = `
      INSERT INTO chatbot_messages (message_id, conversation_id, user_id, sender, message_content, message_type, emotion_detected)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await db.query(query, [messageId, conversationId, userId, sender, content, messageType, emotionDetected]);
    return result.rows[0];
  }

  /**
   * Get conversation messages
   */
  static async getMessages(conversationId, limit = 50) {
    const query = `
      SELECT * FROM chatbot_messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2
    `;
    const result = await db.query(query, [conversationId, limit]);
    return result.rows;
  }

  /**
   * Get recent conversations for user
   */
  static async getRecentConversations(userId, limit = 10) {
    const query = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM chatbot_messages WHERE conversation_id = c.conversation_id) as message_count
      FROM chatbot_conversations c
      WHERE c.user_id = $1
      ORDER BY c.started_at DESC
      LIMIT $2
    `;
    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Get conversation stats for user
   */
  static async getStats(userId) {
    const query = `
      SELECT
        COUNT(DISTINCT conversation_id) as total_conversations,
        COUNT(*) as total_messages,
        AVG(CASE WHEN mood_at_end IS NOT NULL AND mood_at_start IS NOT NULL
            THEN mood_at_end - mood_at_start ELSE NULL END) as avg_mood_change
      FROM chatbot_conversations c
      LEFT JOIN chatbot_messages m USING (conversation_id)
      WHERE c.user_id = $1
    `;
    const result = await db.query(query, [userId]);
    return result.rows[0];
  }
}

module.exports = ChatbotMessage;

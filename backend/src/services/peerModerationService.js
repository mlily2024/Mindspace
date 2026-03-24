const logger = require('../config/logger');

/**
 * Peer Support Moderation Service
 * Handles content moderation, crisis detection, and safety checks
 */
class PeerModerationService {
  // Crisis keywords that trigger safety alerts
  static CRISIS_KEYWORDS = [
    'suicide', 'suicidal', 'kill myself', 'end my life', 'want to die',
    'self-harm', 'self harm', 'cut myself', 'hurt myself',
    'overdose', 'no reason to live', 'better off dead',
    'goodbye forever', 'final goodbye', 'ending it all'
  ];

  // Inappropriate content patterns
  static INAPPROPRIATE_PATTERNS = [
    // Harassment
    /\b(hate|kill|die|stupid|idiot|loser)\b.*\b(you|yourself)\b/i,
    // Contact solicitation
    /\b(phone|number|email|address|meet|dm|message me)\b/i,
    // Spam patterns
    /(.)\1{5,}/,
    // Excessive caps (shouting)
    /\b[A-Z]{10,}\b/
  ];

  // Supportive response templates for crisis detection
  static CRISIS_RESPONSES = {
    default: "I noticed you may be going through a difficult time. Please know that help is available. If you're in crisis, please reach out to Samaritans at 116 123 (available 24/7).",
    severe: "Your safety matters. Please consider reaching out to emergency services (999) or Samaritans (116 123) right now. You don't have to face this alone.",
    supportive: "It sounds like you're struggling. That takes courage to share. Please remember that professional support is available whenever you need it."
  };

  /**
   * Detect crisis content in a message
   * @param {string} content - Message content
   * @returns {Object} Crisis detection result
   */
  static detectCrisisContent(content) {
    if (!content) return { isCrisis: false };

    const lowerContent = content.toLowerCase();
    const detectedKeywords = [];

    for (const keyword of this.CRISIS_KEYWORDS) {
      if (lowerContent.includes(keyword)) {
        detectedKeywords.push(keyword);
      }
    }

    if (detectedKeywords.length > 0) {
      logger.warn('Crisis content detected', {
        keywordCount: detectedKeywords.length,
        contentLength: content.length
      });

      return {
        isCrisis: true,
        severity: detectedKeywords.length >= 2 ? 'high' : 'moderate',
        keywords: detectedKeywords,
        suggestedResponse: detectedKeywords.length >= 2
          ? this.CRISIS_RESPONSES.severe
          : this.CRISIS_RESPONSES.default
      };
    }

    return { isCrisis: false };
  }

  /**
   * Check for inappropriate content
   * @param {string} content - Message content
   * @returns {Object} Inappropriate content check result
   */
  static checkInappropriateContent(content) {
    if (!content) return { isInappropriate: false };

    const issues = [];

    for (const pattern of this.INAPPROPRIATE_PATTERNS) {
      if (pattern.test(content)) {
        issues.push('Pattern match detected');
      }
    }

    // Check for excessive length
    if (content.length > 2000) {
      issues.push('Message too long');
    }

    // Check for empty or whitespace-only
    if (content.trim().length === 0) {
      issues.push('Empty message');
    }

    return {
      isInappropriate: issues.length > 0,
      issues
    };
  }

  /**
   * Sanitize message content
   * @param {string} content - Raw message content
   * @returns {string} Sanitized content
   */
  static sanitizeContent(content) {
    if (!content) return '';

    // Trim whitespace
    let sanitized = content.trim();

    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Limit length
    if (sanitized.length > 2000) {
      sanitized = sanitized.substring(0, 2000);
    }

    // Basic HTML entity encoding to prevent XSS
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    return sanitized;
  }

  /**
   * Perform full content moderation check
   * @param {string} content - Message content
   * @returns {Object} Full moderation result
   */
  static moderateContent(content) {
    const sanitized = this.sanitizeContent(content);
    const crisisCheck = this.detectCrisisContent(sanitized);
    const inappropriateCheck = this.checkInappropriateContent(sanitized);

    return {
      originalContent: content,
      sanitizedContent: sanitized,
      crisis: crisisCheck,
      inappropriate: inappropriateCheck,
      shouldBlock: inappropriateCheck.isInappropriate,
      shouldAlert: crisisCheck.isCrisis,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate supportive auto-response for crisis situations
   * @param {string} severity - Crisis severity level
   * @returns {Object} Auto-response message
   */
  static generateCrisisResponse(severity = 'default') {
    const response = this.CRISIS_RESPONSES[severity] || this.CRISIS_RESPONSES.default;

    return {
      type: 'system',
      content: response,
      resources: {
        emergency: '999',
        samaritans: '116 123',
        shout: 'Text SHOUT to 85258',
        nhs: '111 (option 2)'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Check if user is being rate-limited for messages
   * @param {string} userId - User ID
   * @param {Map} rateLimitMap - Rate limit tracking map
   * @param {number} maxMessages - Max messages per minute
   * @returns {boolean} True if rate limited
   */
  static isRateLimited(userId, rateLimitMap, maxMessages = 10) {
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    if (!rateLimitMap.has(userId)) {
      rateLimitMap.set(userId, []);
    }

    const userMessages = rateLimitMap.get(userId);

    // Remove old entries
    const recentMessages = userMessages.filter(time => now - time < windowMs);
    rateLimitMap.set(userId, recentMessages);

    if (recentMessages.length >= maxMessages) {
      logger.warn('User rate limited for peer messages', { userId, messageCount: recentMessages.length });
      return true;
    }

    // Add current message
    recentMessages.push(now);
    rateLimitMap.set(userId, recentMessages);

    return false;
  }

  /**
   * Get moderation statistics for a group
   * @param {string} groupId - Group ID
   * @param {Object} db - Database connection
   * @returns {Object} Moderation stats
   */
  static async getModerationStats(groupId, db) {
    const query = `
      SELECT
        COUNT(*) as total_messages,
        COUNT(*) FILTER (WHERE is_flagged = true) as flagged_count,
        COUNT(*) FILTER (WHERE is_deleted = true) as deleted_count,
        COUNT(*) FILTER (WHERE is_moderated = true) as moderated_count
      FROM peer_messages
      WHERE group_id = $1
    `;

    const result = await db.query(query, [groupId]);
    return result.rows[0];
  }
}

module.exports = PeerModerationService;

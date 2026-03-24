const logger = require('../config/logger');
const { isUserOnline } = require('../config/socketio');

/**
 * Real-time Notification Service
 * Handles sending notifications via Socket.io
 */
class NotificationService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Send notification to a specific user
   * @param {string} userId - Target user ID
   * @param {string} event - Event name
   * @param {Object} data - Notification data
   */
  sendToUser(userId, event, data) {
    if (!this.io) {
      logger.warn('Socket.io not initialized, notification not sent', { userId, event });
      return false;
    }

    const payload = {
      ...data,
      timestamp: new Date().toISOString()
    };

    this.io.to(`user:${userId}`).emit(event, payload);

    logger.info('Notification sent', {
      userId,
      event,
      isOnline: isUserOnline(userId)
    });

    return true;
  }

  /**
   * Send safety alert notification (high priority)
   * @param {string} userId - User ID
   * @param {Object} alert - Alert data
   */
  sendSafetyAlert(userId, alert) {
    return this.sendToUser(userId, 'alert:safety', {
      type: 'safety_alert',
      priority: 'high',
      alert: {
        alertId: alert.alert_id,
        alertType: alert.alert_type,
        severity: alert.severity,
        message: alert.alert_data?.message || 'A safety concern has been detected',
        crisisResources: true
      }
    });
  }

  /**
   * Send achievement earned notification
   * @param {string} userId - User ID
   * @param {Object} achievement - Achievement data
   */
  sendAchievementEarned(userId, achievement) {
    return this.sendToUser(userId, 'achievement:earned', {
      type: 'achievement',
      priority: 'normal',
      achievement: {
        achievementId: achievement.achievement_id,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        points: achievement.points,
        category: achievement.category
      }
    });
  }

  /**
   * Send new insight notification
   * @param {string} userId - User ID
   * @param {Object} insight - Insight data
   */
  sendNewInsight(userId, insight) {
    return this.sendToUser(userId, 'insight:new', {
      type: 'insight',
      priority: insight.severity === 'high' ? 'high' : 'normal',
      insight: {
        insightId: insight.insight_id,
        insightType: insight.insight_type,
        title: insight.insight_data?.title || 'New Insight Available',
        description: insight.insight_data?.description,
        severity: insight.severity
      }
    });
  }

  /**
   * Send new recommendation notification
   * @param {string} userId - User ID
   * @param {Object} recommendation - Recommendation data
   */
  sendNewRecommendation(userId, recommendation) {
    return this.sendToUser(userId, 'recommendation:new', {
      type: 'recommendation',
      priority: 'normal',
      recommendation: {
        recommendationId: recommendation.recommendation_id,
        title: recommendation.title,
        type: recommendation.recommendation_type,
        effortLevel: recommendation.effort_level
      }
    });
  }

  /**
   * Send streak update notification
   * @param {string} userId - User ID
   * @param {Object} streak - Streak data
   */
  sendStreakUpdate(userId, streak) {
    return this.sendToUser(userId, 'streak:update', {
      type: 'streak',
      priority: 'normal',
      streak: {
        currentStreak: streak.current_streak,
        longestStreak: streak.longest_streak,
        totalCheckIns: streak.total_check_ins,
        isNewRecord: streak.current_streak >= streak.longest_streak
      }
    });
  }

  /**
   * Send peer message notification (for peer support)
   * @param {string} groupId - Group ID
   * @param {Object} message - Message data
   * @param {string} excludeUserId - User to exclude (sender)
   */
  sendPeerMessage(groupId, message, excludeUserId = null) {
    if (!this.io) {
      logger.warn('Socket.io not initialized, peer message not sent', { groupId });
      return false;
    }

    const payload = {
      type: 'peer_message',
      message: {
        messageId: message.message_id,
        groupId: message.group_id,
        senderNickname: message.anonymous_nickname,
        content: message.content,
        createdAt: message.created_at
      },
      timestamp: new Date().toISOString()
    };

    // Send to group room, excluding sender
    if (excludeUserId) {
      this.io.to(`group:${groupId}`).except(`user:${excludeUserId}`).emit('peer:new_message', payload);
    } else {
      this.io.to(`group:${groupId}`).emit('peer:new_message', payload);
    }

    logger.info('Peer message broadcast', { groupId, messageId: message.message_id });
    return true;
  }

  /**
   * Send typing indicator for peer chat
   * @param {string} groupId - Group ID
   * @param {string} nickname - Typer's nickname
   * @param {string} excludeUserId - User to exclude
   */
  sendTypingIndicator(groupId, nickname, excludeUserId) {
    if (!this.io) return false;

    this.io.to(`group:${groupId}`).except(`user:${excludeUserId}`).emit('peer:user_typing', {
      groupId,
      nickname,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  /**
   * Send user joined group notification
   * @param {string} groupId - Group ID
   * @param {string} nickname - New member's nickname
   */
  sendUserJoinedGroup(groupId, nickname) {
    if (!this.io) return false;

    this.io.to(`group:${groupId}`).emit('peer:user_joined', {
      groupId,
      nickname,
      timestamp: new Date().toISOString()
    });

    logger.info('User joined group broadcast', { groupId, nickname });
    return true;
  }

  /**
   * Send user left group notification
   * @param {string} groupId - Group ID
   * @param {string} nickname - Leaving member's nickname
   */
  sendUserLeftGroup(groupId, nickname) {
    if (!this.io) return false;

    this.io.to(`group:${groupId}`).emit('peer:user_left', {
      groupId,
      nickname,
      timestamp: new Date().toISOString()
    });

    logger.info('User left group broadcast', { groupId, nickname });
    return true;
  }

  /**
   * Broadcast to all connected users (admin use)
   * @param {string} event - Event name
   * @param {Object} data - Broadcast data
   */
  broadcast(event, data) {
    if (!this.io) return false;

    this.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });

    logger.info('Broadcast sent', { event });
    return true;
  }
}

// Singleton instance
let notificationServiceInstance = null;

/**
 * Initialize the notification service with Socket.io instance
 * @param {Object} io - Socket.io server instance
 * @returns {NotificationService} Notification service instance
 */
const initNotificationService = (io) => {
  notificationServiceInstance = new NotificationService(io);
  logger.info('Notification service initialized');
  return notificationServiceInstance;
};

/**
 * Get the notification service instance
 * @returns {NotificationService|null} Notification service instance
 */
const getNotificationService = () => {
  return notificationServiceInstance;
};

module.exports = {
  NotificationService,
  initNotificationService,
  getNotificationService
};

const PeerSupport = require('../models/PeerSupport');
const PeerModerationService = require('../services/peerModerationService');
const logger = require('../config/logger');
const { getNotificationService } = require('../services/notificationService');

// Rate limit map for message sending
const messageRateLimitMap = new Map();

// ==================== GROUP CONTROLLERS ====================

/**
 * Get all available groups
 */
const getGroups = async (req, res, next) => {
  try {
    const { groupType, limit, offset } = req.query;

    const groups = await PeerSupport.getGroups({
      groupType,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });

    res.json({
      success: true,
      data: {
        groups,
        count: groups.length
      }
    });
  } catch (error) {
    logger.error('Get groups error', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get a specific group by ID
 */
const getGroupById = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await PeerSupport.getGroupById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    // Check if user is a member
    const membership = await PeerSupport.getMembership(req.user.userId, groupId);

    res.json({
      success: true,
      data: {
        group,
        isMember: !!membership,
        membership
      }
    });
  } catch (error) {
    logger.error('Get group error', { error: error.message, groupId: req.params.groupId });
    next(error);
  }
};

/**
 * Create a new group
 */
const createGroup = async (req, res, next) => {
  try {
    const { name, description, groupType, maxMembers, isModerated } = req.body;

    const group = await PeerSupport.createGroup({
      name,
      description,
      groupType,
      maxMembers,
      isModerated,
      createdBy: req.user.userId
    });

    logger.info('Group created', { groupId: group.group_id, userId: req.user.userId });

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: { group }
    });
  } catch (error) {
    logger.error('Create group error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Join a group
 */
const joinGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    let { anonymousNickname } = req.body;

    // Generate nickname if not provided
    if (!anonymousNickname) {
      anonymousNickname = PeerSupport.generateAnonymousNickname();

      // Ensure uniqueness
      let attempts = 0;
      while (!(await PeerSupport.isNicknameUnique(groupId, anonymousNickname)) && attempts < 5) {
        anonymousNickname = PeerSupport.generateAnonymousNickname();
        attempts++;
      }
    }

    // Check nickname uniqueness
    const isUnique = await PeerSupport.isNicknameUnique(groupId, anonymousNickname);
    if (!isUnique) {
      return res.status(400).json({
        success: false,
        message: 'Nickname is already taken in this group'
      });
    }

    const membership = await PeerSupport.joinGroup(req.user.userId, groupId, anonymousNickname);

    // Notify group members
    const notificationService = getNotificationService();
    if (notificationService) {
      notificationService.sendUserJoinedGroup(groupId, anonymousNickname);
    }

    logger.info('User joined group', { groupId, userId: req.user.userId, nickname: anonymousNickname });

    res.json({
      success: true,
      message: 'Joined group successfully',
      data: { membership }
    });
  } catch (error) {
    if (error.message === 'Already a member of this group') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    if (error.message === 'Group is full') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    logger.error('Join group error', { error: error.message, groupId: req.params.groupId, userId: req.user.userId });
    next(error);
  }
};

/**
 * Leave a group
 */
const leaveGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const membership = await PeerSupport.getMembership(req.user.userId, groupId);
    if (!membership) {
      return res.status(400).json({
        success: false,
        message: 'Not a member of this group'
      });
    }

    await PeerSupport.leaveGroup(req.user.userId, groupId);

    // Notify group members
    const notificationService = getNotificationService();
    if (notificationService) {
      notificationService.sendUserLeftGroup(groupId, membership.anonymous_nickname);
    }

    logger.info('User left group', { groupId, userId: req.user.userId });

    res.json({
      success: true,
      message: 'Left group successfully'
    });
  } catch (error) {
    logger.error('Leave group error', { error: error.message, groupId: req.params.groupId, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get user's joined groups
 */
const getUserGroups = async (req, res, next) => {
  try {
    const groups = await PeerSupport.getUserGroups(req.user.userId);

    res.json({
      success: true,
      data: {
        groups,
        count: groups.length
      }
    });
  } catch (error) {
    logger.error('Get user groups error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Get group members
 */
const getGroupMembers = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    // Check if user is a member
    const membership = await PeerSupport.getMembership(req.user.userId, groupId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Must be a member to view group members'
      });
    }

    const members = await PeerSupport.getGroupMembers(groupId);

    res.json({
      success: true,
      data: {
        members,
        count: members.length
      }
    });
  } catch (error) {
    logger.error('Get group members error', { error: error.message, groupId: req.params.groupId });
    next(error);
  }
};

// ==================== MESSAGE CONTROLLERS ====================

/**
 * Get messages from a group
 */
const getMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { limit, before, after } = req.query;

    // Check if user is a member
    const membership = await PeerSupport.getMembership(req.user.userId, groupId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Must be a member to view messages'
      });
    }

    const messages = await PeerSupport.getMessages(groupId, {
      limit: limit ? parseInt(limit) : 50,
      before,
      after
    });

    res.json({
      success: true,
      data: {
        messages,
        count: messages.length,
        userNickname: membership.anonymous_nickname
      }
    });
  } catch (error) {
    logger.error('Get messages error', { error: error.message, groupId: req.params.groupId });
    next(error);
  }
};

/**
 * Send a message to a group
 */
const sendMessage = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { content } = req.body;

    // Check rate limit
    if (PeerModerationService.isRateLimited(req.user.userId, messageRateLimitMap)) {
      return res.status(429).json({
        success: false,
        message: 'Too many messages. Please wait a moment.'
      });
    }

    // Check if user is a member
    const membership = await PeerSupport.getMembership(req.user.userId, groupId);
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Must be a member to send messages'
      });
    }

    // Moderate content
    const moderation = PeerModerationService.moderateContent(content);

    if (moderation.shouldBlock) {
      return res.status(400).json({
        success: false,
        message: 'Message contains inappropriate content'
      });
    }

    // Create message
    const message = await PeerSupport.sendMessage(groupId, req.user.userId, moderation.sanitizedContent);

    // Broadcast to group via Socket.io
    const notificationService = getNotificationService();
    if (notificationService) {
      notificationService.sendPeerMessage(groupId, message, req.user.userId);
    }

    // Handle crisis content
    if (moderation.shouldAlert) {
      logger.warn('Crisis content in peer message', {
        groupId,
        userId: req.user.userId,
        severity: moderation.crisis.severity
      });

      // Send crisis resources to the user
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.user.userId}`).emit('crisis:resources', {
          message: moderation.crisis.suggestedResponse,
          resources: PeerModerationService.generateCrisisResponse(moderation.crisis.severity).resources
        });
      }
    }

    logger.info('Message sent', { groupId, userId: req.user.userId, messageId: message.message_id });

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: {
          messageId: message.message_id,
          groupId: message.group_id,
          anonymousNickname: message.anonymous_nickname,
          content: message.content,
          createdAt: message.created_at
        }
      }
    });
  } catch (error) {
    logger.error('Send message error', { error: error.message, groupId: req.params.groupId, userId: req.user.userId });
    next(error);
  }
};

/**
 * Flag a message for moderation
 */
const flagMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { reason } = req.body;

    const message = await PeerSupport.getMessageById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is a member of the group
    const membership = await PeerSupport.getMembership(req.user.userId, message.group_id);
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Must be a member to flag messages'
      });
    }

    const flaggedMessage = await PeerSupport.flagMessage(messageId, reason || 'Flagged by user');

    logger.info('Message flagged', { messageId, userId: req.user.userId, reason });

    res.json({
      success: true,
      message: 'Message flagged for moderation'
    });
  } catch (error) {
    logger.error('Flag message error', { error: error.message, messageId: req.params.messageId });
    next(error);
  }
};

/**
 * Delete own message
 */
const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const deleted = await PeerSupport.deleteMessage(messageId, req.user.userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not owned by you'
      });
    }

    logger.info('Message deleted', { messageId, userId: req.user.userId });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    logger.error('Delete message error', { error: error.message, messageId: req.params.messageId });
    next(error);
  }
};

// ==================== MODERATION CONTROLLERS ====================

/**
 * Moderate a message (moderator only)
 */
const moderateMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { action } = req.body;

    if (!['approve', 'delete'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "delete"'
      });
    }

    const message = await PeerSupport.getMessageById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is a moderator
    const membership = await PeerSupport.getMembership(req.user.userId, message.group_id);
    if (!membership || !membership.is_moderator) {
      return res.status(403).json({
        success: false,
        message: 'Moderator access required'
      });
    }

    const moderated = await PeerSupport.moderateMessage(messageId, action);

    logger.info('Message moderated', { messageId, action, moderatorId: req.user.userId });

    res.json({
      success: true,
      message: `Message ${action === 'delete' ? 'deleted' : 'approved'} successfully`,
      data: { message: moderated }
    });
  } catch (error) {
    logger.error('Moderate message error', { error: error.message, messageId: req.params.messageId });
    next(error);
  }
};

/**
 * Get flagged messages (moderator only)
 */
const getFlaggedMessages = async (req, res, next) => {
  try {
    const { groupId } = req.query;

    // If groupId specified, check moderator status
    if (groupId) {
      const membership = await PeerSupport.getMembership(req.user.userId, groupId);
      if (!membership || !membership.is_moderator) {
        return res.status(403).json({
          success: false,
          message: 'Moderator access required'
        });
      }
    }

    const messages = await PeerSupport.getFlaggedMessages(groupId);

    res.json({
      success: true,
      data: {
        messages,
        count: messages.length
      }
    });
  } catch (error) {
    logger.error('Get flagged messages error', { error: error.message, userId: req.user.userId });
    next(error);
  }
};

/**
 * Generate a unique anonymous nickname
 */
const generateNickname = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    let nickname = PeerSupport.generateAnonymousNickname();
    let attempts = 0;

    while (!(await PeerSupport.isNicknameUnique(groupId, nickname)) && attempts < 10) {
      nickname = PeerSupport.generateAnonymousNickname();
      attempts++;
    }

    res.json({
      success: true,
      data: { nickname }
    });
  } catch (error) {
    logger.error('Generate nickname error', { error: error.message });
    next(error);
  }
};

module.exports = {
  // Groups
  getGroups,
  getGroupById,
  createGroup,
  joinGroup,
  leaveGroup,
  getUserGroups,
  getGroupMembers,
  // Messages
  getMessages,
  sendMessage,
  flagMessage,
  deleteMessage,
  // Moderation
  moderateMessage,
  getFlaggedMessages,
  // Utilities
  generateNickname
};

const logger = require('../config/logger');

/**
 * Socket.io Event Handlers
 * Registers all socket event handlers for real-time features
 */

/**
 * Simple per-socket rate limiter
 * Returns true if the event should be allowed, false if rate-limited
 */
const createRateLimiter = (maxEvents, windowMs) => {
  const events = [];
  return () => {
    const now = Date.now();
    // Remove events outside the window
    while (events.length > 0 && events[0] <= now - windowMs) {
      events.shift();
    }
    if (events.length >= maxEvents) {
      return false; // rate limited
    }
    events.push(now);
    return true;
  };
};

/**
 * Register all socket handlers for a connected socket
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Connected socket instance
 * @param {Object} services - Object containing service instances
 */
const registerSocketHandlers = (io, socket, services = {}) => {
  const userId = socket.userId;

  // Register peer chat handlers
  registerPeerChatHandlers(io, socket, services);

  // Register notification handlers
  registerNotificationHandlers(io, socket, services);

  logger.info('Socket handlers registered', { userId, socketId: socket.id });
};

/**
 * Peer Chat Socket Handlers
 */
const registerPeerChatHandlers = (io, socket, services) => {
  const userId = socket.userId;

  // Rate limiters: 30 events/min for actions, 10/sec for typing
  const actionLimiter = createRateLimiter(30, 60000);
  const typingLimiter = createRateLimiter(10, 1000);

  // Join a peer support group room
  socket.on('peer:join_group', async (data) => {
    if (!actionLimiter()) {
      socket.emit('peer:error', { message: 'Too many requests, please slow down' });
      return;
    }
    try {
      const { groupId } = data;

      if (!groupId) {
        socket.emit('peer:error', { message: 'Group ID required' });
        return;
      }

      // Join the group's socket room
      socket.join(`group:${groupId}`);

      logger.info('User joined group room', { userId, groupId, socketId: socket.id });

      socket.emit('peer:joined_group', {
        groupId,
        message: 'Joined group successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error joining group room', { error: error.message, userId });
      socket.emit('peer:error', { message: 'Failed to join group' });
    }
  });

  // Leave a peer support group room
  socket.on('peer:leave_group', async (data) => {
    try {
      const { groupId } = data;

      if (!groupId) {
        socket.emit('peer:error', { message: 'Group ID required' });
        return;
      }

      // Leave the group's socket room
      socket.leave(`group:${groupId}`);

      logger.info('User left group room', { userId, groupId, socketId: socket.id });

      socket.emit('peer:left_group', {
        groupId,
        message: 'Left group successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error leaving group room', { error: error.message, userId });
      socket.emit('peer:error', { message: 'Failed to leave group' });
    }
  });

  // Typing indicator (rate-limited to prevent spam)
  socket.on('peer:typing', async (data) => {
    if (!typingLimiter()) return; // silently drop excess typing events
    try {
      const { groupId, nickname } = data;

      if (!groupId || !nickname) {
        return;
      }

      // Broadcast typing to group (excluding sender)
      socket.to(`group:${groupId}`).emit('peer:user_typing', {
        groupId,
        nickname,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error broadcasting typing', { error: error.message, userId });
    }
  });

  // Stop typing indicator
  socket.on('peer:stop_typing', async (data) => {
    try {
      const { groupId, nickname } = data;

      if (!groupId || !nickname) {
        return;
      }

      // Broadcast stop typing to group (excluding sender)
      socket.to(`group:${groupId}`).emit('peer:user_stopped_typing', {
        groupId,
        nickname,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error broadcasting stop typing', { error: error.message, userId });
    }
  });

  // Request online members in a group
  socket.on('peer:get_online_members', async (data) => {
    try {
      const { groupId } = data;

      if (!groupId) {
        socket.emit('peer:error', { message: 'Group ID required' });
        return;
      }

      // Get sockets in the group room
      const room = io.sockets.adapter.rooms.get(`group:${groupId}`);
      const onlineCount = room ? room.size : 0;

      socket.emit('peer:online_members', {
        groupId,
        count: onlineCount,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting online members', { error: error.message, userId });
      socket.emit('peer:error', { message: 'Failed to get online members' });
    }
  });
};

/**
 * Notification Socket Handlers
 */
const registerNotificationHandlers = (io, socket, services) => {
  const userId = socket.userId;

  // Acknowledge a notification
  socket.on('notification:acknowledge', async (data) => {
    try {
      const { notificationId, type } = data;

      logger.info('Notification acknowledged', {
        userId,
        notificationId,
        type
      });

      socket.emit('notification:acknowledged', {
        notificationId,
        type,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error acknowledging notification', { error: error.message, userId });
    }
  });

  // Request notification count (unread)
  socket.on('notification:get_count', async (data) => {
    try {
      // This would be integrated with a notification storage system
      // For now, emit a placeholder response
      socket.emit('notification:count', {
        count: 0,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting notification count', { error: error.message, userId });
    }
  });

  // Mark notifications as read
  socket.on('notification:mark_read', async (data) => {
    try {
      const { notificationIds } = data;

      logger.info('Notifications marked as read', {
        userId,
        count: notificationIds?.length || 0
      });

      socket.emit('notification:marked_read', {
        notificationIds,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error marking notifications as read', { error: error.message, userId });
    }
  });
};

/**
 * Get count of users in a specific room
 * @param {Object} io - Socket.io server instance
 * @param {string} roomName - Room name
 * @returns {number} Number of sockets in the room
 */
const getRoomMemberCount = (io, roomName) => {
  const room = io.sockets.adapter.rooms.get(roomName);
  return room ? room.size : 0;
};

/**
 * Broadcast to all users in a specific room
 * @param {Object} io - Socket.io server instance
 * @param {string} roomName - Room name
 * @param {string} event - Event name
 * @param {Object} data - Data to broadcast
 */
const broadcastToRoom = (io, roomName, event, data) => {
  io.to(roomName).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  registerSocketHandlers,
  registerPeerChatHandlers,
  registerNotificationHandlers,
  getRoomMemberCount,
  broadcastToRoom
};

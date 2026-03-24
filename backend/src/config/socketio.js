const jwt = require('jsonwebtoken');
const logger = require('./logger');

/**
 * Socket.io Configuration and Authentication
 * Provides real-time communication for notifications and peer chat
 */

// Store active connections by user ID
const userSockets = new Map();

/**
 * Configure Socket.io server with JWT authentication
 * @param {Object} io - Socket.io server instance
 */
const configureSocketIO = (io) => {
  // Authentication middleware - verify JWT token on connection
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        logger.warn('Socket connection attempt without token', {
          ip: socket.handshake.address
        });
        return next(new Error('Authentication required'));
      }

      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          logger.warn('Socket connection with invalid token', {
            ip: socket.handshake.address,
            error: err.message
          });
          return next(new Error('Invalid or expired token'));
        }

        // Attach user data to socket
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        next();
      });
    } catch (error) {
      logger.error('Socket authentication error', { error: error.message });
      next(new Error('Authentication failed'));
    }
  });

  // Handle new connections
  io.on('connection', (socket) => {
    const userId = socket.userId;

    logger.info('Socket connected', {
      userId,
      socketId: socket.id,
      ip: socket.handshake.address
    });

    // Store socket reference for user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join user's personal room for direct notifications
    socket.join(`user:${userId}`);

    // Emit connection success
    socket.emit('connected', {
      message: 'Connected to Mental Health Tracker',
      userId,
      timestamp: new Date().toISOString()
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', {
        userId,
        socketId: socket.id,
        reason
      });

      // Remove socket from user's set
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
        }
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error', {
        userId,
        socketId: socket.id,
        error: error.message
      });
    });

    // Heartbeat for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  });

  logger.info('Socket.io configured successfully');
};

/**
 * Get all socket IDs for a user
 * @param {string} userId - User ID
 * @returns {Set} Set of socket IDs
 */
const getUserSockets = (userId) => {
  return userSockets.get(userId) || new Set();
};

/**
 * Check if user is online
 * @param {string} userId - User ID
 * @returns {boolean} Whether user has active connections
 */
const isUserOnline = (userId) => {
  const sockets = userSockets.get(userId);
  return sockets && sockets.size > 0;
};

/**
 * Get count of active connections
 * @returns {number} Total active socket connections
 */
const getActiveConnectionCount = () => {
  let count = 0;
  for (const sockets of userSockets.values()) {
    count += sockets.size;
  }
  return count;
};

/**
 * Get count of online users
 * @returns {number} Number of unique online users
 */
const getOnlineUserCount = () => {
  return userSockets.size;
};

module.exports = {
  configureSocketIO,
  getUserSockets,
  isUserOnline,
  getActiveConnectionCount,
  getOnlineUserCount
};

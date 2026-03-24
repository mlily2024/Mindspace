import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Initialize Socket.io connection with authentication
 * @param {string} token - JWT authentication token
 * @returns {Object} Socket.io client instance
 */
export const initializeSocket = (token) => {
  if (socket?.connected) {
    console.log('Socket already connected');
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling']
  });

  // Connection event handlers
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    reconnectAttempts = 0;
  });

  socket.on('connected', (data) => {
    console.log('Server confirmed connection:', data);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    if (reason === 'io server disconnect') {
      // Server disconnected, try to reconnect
      socket.connect();
    }
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
    reconnectAttempts++;

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  // Heartbeat handling
  socket.on('pong', (data) => {
    console.log('Heartbeat received:', data.timestamp);
  });

  return socket;
};

/**
 * Get the current socket instance
 * @returns {Object|null} Socket.io client instance or null
 */
export const getSocket = () => socket;

/**
 * Check if socket is connected
 * @returns {boolean} Connection status
 */
export const isSocketConnected = () => socket?.connected ?? false;

/**
 * Disconnect the socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('Socket disconnected manually');
  }
};

/**
 * Reconnect the socket
 */
export const reconnectSocket = () => {
  if (socket && !socket.connected) {
    socket.connect();
  }
};

/**
 * Emit an event to the server
 * @param {string} event - Event name
 * @param {Object} data - Event data
 * @returns {boolean} Success status
 */
export const emitEvent = (event, data) => {
  if (!socket?.connected) {
    console.warn('Socket not connected, cannot emit:', event);
    return false;
  }
  socket.emit(event, data);
  return true;
};

/**
 * Join a peer support group room
 * @param {string} groupId - Group ID to join
 */
export const joinGroup = (groupId) => {
  emitEvent('peer:join_group', { groupId });
};

/**
 * Leave a peer support group room
 * @param {string} groupId - Group ID to leave
 */
export const leaveGroup = (groupId) => {
  emitEvent('peer:leave_group', { groupId });
};

/**
 * Send typing indicator
 * @param {string} groupId - Group ID
 * @param {string} nickname - User's anonymous nickname
 */
export const sendTypingIndicator = (groupId, nickname) => {
  emitEvent('peer:typing', { groupId, nickname });
};

/**
 * Send stop typing indicator
 * @param {string} groupId - Group ID
 * @param {string} nickname - User's anonymous nickname
 */
export const sendStopTyping = (groupId, nickname) => {
  emitEvent('peer:stop_typing', { groupId, nickname });
};

/**
 * Request online members count
 * @param {string} groupId - Group ID
 */
export const requestOnlineMembers = (groupId) => {
  emitEvent('peer:get_online_members', { groupId });
};

/**
 * Acknowledge a notification
 * @param {string} notificationId - Notification ID
 * @param {string} type - Notification type
 */
export const acknowledgeNotification = (notificationId, type) => {
  emitEvent('notification:acknowledge', { notificationId, type });
};

/**
 * Send heartbeat ping
 */
export const sendHeartbeat = () => {
  emitEvent('ping', {});
};

export default {
  initializeSocket,
  getSocket,
  isSocketConnected,
  disconnectSocket,
  reconnectSocket,
  emitEvent,
  joinGroup,
  leaveGroup,
  sendTypingIndicator,
  sendStopTyping,
  requestOnlineMembers,
  acknowledgeNotification,
  sendHeartbeat
};

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { initializeSocket, disconnectSocket, getSocket, isSocketConnected } from '../services/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

/**
 * Custom hook to use the socket context
 * @returns {Object} Socket context value
 */
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

/**
 * Socket Provider Component
 * Manages WebSocket connection and provides socket state to children
 */
export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Initialize socket when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('token');
      if (token) {
        const socketInstance = initializeSocket(token);
        setSocket(socketInstance);

        // Set up connection status listeners
        socketInstance.on('connect', () => {
          setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
          setIsConnected(false);
        });

        // Set up notification listeners
        socketInstance.on('alert:safety', handleSafetyAlert);
        socketInstance.on('achievement:earned', handleAchievement);
        socketInstance.on('insight:new', handleNewInsight);
        socketInstance.on('recommendation:new', handleNewRecommendation);
        socketInstance.on('streak:update', handleStreakUpdate);
        socketInstance.on('crisis:resources', handleCrisisResources);

        // Check initial connection status
        setIsConnected(socketInstance.connected);
      }
    } else {
      // Disconnect when not authenticated
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      if (!isAuthenticated) {
        disconnectSocket();
      }
    };
  }, [isAuthenticated]);

  // Notification handlers
  const handleSafetyAlert = useCallback((data) => {
    const notification = {
      id: data.alert?.alertId || Date.now().toString(),
      type: 'safety_alert',
      priority: 'high',
      title: 'Safety Alert',
      message: data.alert?.message || 'A safety concern has been detected',
      timestamp: data.timestamp,
      read: false,
      data: data.alert
    };
    addNotification(notification);
  }, []);

  const handleAchievement = useCallback((data) => {
    const notification = {
      id: data.achievement?.achievementId || Date.now().toString(),
      type: 'achievement',
      priority: 'normal',
      title: 'Achievement Unlocked!',
      message: data.achievement?.name || 'You earned a new achievement',
      timestamp: data.timestamp,
      read: false,
      data: data.achievement
    };
    addNotification(notification);
  }, []);

  const handleNewInsight = useCallback((data) => {
    const notification = {
      id: data.insight?.insightId || Date.now().toString(),
      type: 'insight',
      priority: data.priority || 'normal',
      title: 'New Insight',
      message: data.insight?.title || 'A new insight is available',
      timestamp: data.timestamp,
      read: false,
      data: data.insight
    };
    addNotification(notification);
  }, []);

  const handleNewRecommendation = useCallback((data) => {
    const notification = {
      id: data.recommendation?.recommendationId || Date.now().toString(),
      type: 'recommendation',
      priority: 'normal',
      title: 'New Recommendation',
      message: data.recommendation?.title || 'A new self-care activity is suggested',
      timestamp: data.timestamp,
      read: false,
      data: data.recommendation
    };
    addNotification(notification);
  }, []);

  const handleStreakUpdate = useCallback((data) => {
    if (data.streak?.isNewRecord) {
      const notification = {
        id: Date.now().toString(),
        type: 'streak',
        priority: 'normal',
        title: 'New Streak Record!',
        message: `You've reached a ${data.streak.currentStreak}-day streak!`,
        timestamp: data.timestamp,
        read: false,
        data: data.streak
      };
      addNotification(notification);
    }
  }, []);

  const handleCrisisResources = useCallback((data) => {
    const notification = {
      id: Date.now().toString(),
      type: 'crisis_resources',
      priority: 'high',
      title: 'Support Available',
      message: data.message,
      timestamp: data.timestamp,
      read: false,
      data: data.resources
    };
    addNotification(notification);
  }, []);

  // Add a notification
  const addNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
    setUnreadCount(prev => prev + 1);
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    setUnreadCount(0);
  }, []);

  // Clear notifications
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Remove a notification
  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      if (notification && !notification.read) {
        setUnreadCount(count => Math.max(0, count - 1));
      }
      return prev.filter(n => n.id !== notificationId);
    });
  }, []);

  const value = {
    socket,
    isConnected,
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    removeNotification
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;

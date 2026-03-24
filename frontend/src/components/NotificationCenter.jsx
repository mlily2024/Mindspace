import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { Link } from 'react-router-dom';

/**
 * NotificationCenter Component
 * Displays real-time notifications as a floating panel
 */
const NotificationCenter = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [showToast, setShowToast] = useState(null);
  const panelRef = useRef(null);

  // Show toast for new high-priority notifications
  useEffect(() => {
    const highPriorityNotifications = notifications.filter(
      n => !n.read && n.priority === 'high'
    );
    if (highPriorityNotifications.length > 0) {
      setShowToast(highPriorityNotifications[0]);
      const timer = setTimeout(() => setShowToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getNotificationIcon = (type) => {
    const icons = {
      safety_alert: '⚠️',
      achievement: '🏆',
      insight: '💡',
      recommendation: '✨',
      streak: '🔥',
      crisis_resources: '❤️',
      default: '🔔'
    };
    return icons[type] || icons.default;
  };

  const getNotificationColor = (type, priority) => {
    if (priority === 'high') return 'var(--danger-color)';
    const colors = {
      achievement: 'var(--success-color)',
      insight: 'var(--primary-color)',
      recommendation: 'var(--secondary-color)',
      streak: 'var(--warning-color)',
      default: 'var(--text-secondary)'
    };
    return colors[type] || colors.default;
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    // Could navigate based on notification type
  };

  return (
    <>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="notification-bell"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 'var(--spacing-sm)',
          fontSize: '1.5rem',
          color: 'var(--text-primary)'
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              backgroundColor: 'var(--danger-color)',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="notification-panel"
          role="dialog"
          aria-label="Notifications"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: '360px',
            maxHeight: '480px',
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            zIndex: 1000,
            animation: 'fadeInUp 0.2s ease-out'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: 'var(--spacing-md)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)' }}>
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-small)'
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div
            style={{
              maxHeight: '400px',
              overflowY: 'auto'
            }}
          >
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: 'var(--spacing-xl)',
                  textAlign: 'center',
                  color: 'var(--text-secondary)'
                }}
              >
                <p style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>🔔</p>
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    padding: 'var(--spacing-md)',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: notification.read ? 'transparent' : 'var(--primary-light)',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 'var(--spacing-sm)',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = notification.read ? 'transparent' : 'var(--primary-light)'}
                >
                  {/* Icon */}
                  <div
                    style={{
                      fontSize: '1.5rem',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--background)',
                      borderRadius: '50%',
                      flexShrink: 0
                    }}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'var(--spacing-xs)'
                      }}
                    >
                      <span
                        style={{
                          fontWeight: notification.read ? 'normal' : 'bold',
                          color: getNotificationColor(notification.type, notification.priority),
                          fontSize: 'var(--font-size-small)'
                        }}
                      >
                        {notification.title}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(notification.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '2px',
                          fontSize: '1rem'
                        }}
                        aria-label="Dismiss notification"
                      >
                        ×
                      </button>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 'var(--font-size-small)',
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {notification.message}
                    </p>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        marginTop: 'var(--spacing-xs)',
                        display: 'block'
                      }}
                    >
                      {formatTime(notification.timestamp)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Toast Notification for High Priority */}
      {showToast && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed',
            bottom: '100px',
            right: '20px',
            backgroundColor: showToast.type === 'safety_alert' ? 'var(--danger-color)' : 'var(--primary-color)',
            color: 'white',
            padding: 'var(--spacing-md)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            maxWidth: '360px',
            zIndex: 2000,
            animation: 'slideInRight 0.3s ease-out',
            display: 'flex',
            gap: 'var(--spacing-sm)',
            alignItems: 'flex-start'
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>{getNotificationIcon(showToast.type)}</span>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: 'var(--spacing-xs)' }}>
              {showToast.title}
            </strong>
            <p style={{ margin: 0, fontSize: 'var(--font-size-small)' }}>
              {showToast.message}
            </p>
            {showToast.type === 'safety_alert' && (
              <Link
                to="/crisis-resources"
                style={{
                  color: 'white',
                  textDecoration: 'underline',
                  fontSize: 'var(--font-size-small)',
                  marginTop: 'var(--spacing-xs)',
                  display: 'inline-block'
                }}
              >
                View crisis resources
              </Link>
            )}
          </div>
          <button
            onClick={() => setShowToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: 0
            }}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
};

export default NotificationCenter;

import React, { useState } from 'react';

/**
 * MessageBubble Component
 * Displays a single message in the chat
 */
const MessageBubble = ({ message, isOwnMessage, onFlag }) => {
  const [showFlagMenu, setShowFlagMenu] = useState(false);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const flagReasons = [
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'spam', label: 'Spam' },
    { value: 'crisis', label: 'Crisis concern' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
        marginBottom: 'var(--spacing-sm)',
        position: 'relative'
      }}
    >
      {/* Sender name (for others' messages) */}
      {!isOwnMessage && (
        <span style={{
          fontSize: 'var(--font-size-small)',
          color: 'var(--primary-color)',
          marginBottom: '2px',
          marginLeft: 'var(--spacing-sm)'
        }}>
          {message.sender_nickname}
        </span>
      )}

      {/* Message bubble */}
      <div
        style={{
          maxWidth: '70%',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          backgroundColor: isOwnMessage ? 'var(--primary-color)' : 'var(--surface)',
          color: isOwnMessage ? 'white' : 'var(--text-primary)',
          borderRadius: 'var(--radius-lg)',
          borderTopLeftRadius: isOwnMessage ? 'var(--radius-lg)' : '4px',
          borderTopRightRadius: isOwnMessage ? '4px' : 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative'
        }}
        onContextMenu={(e) => {
          if (!isOwnMessage) {
            e.preventDefault();
            setShowFlagMenu(!showFlagMenu);
          }
        }}
      >
        <p style={{ margin: 0, wordBreak: 'break-word', lineHeight: 1.4 }}>
          {message.content}
        </p>

        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          marginTop: 'var(--spacing-xs)'
        }}>
          <span style={{
            fontSize: '0.7rem',
            opacity: 0.7
          }}>
            {formatTime(message.created_at)}
          </span>
          {isOwnMessage && message.status === 'sent' && (
            <span style={{ fontSize: '0.7rem' }}>✓</span>
          )}
        </div>

        {/* Flag button for others' messages */}
        {!isOwnMessage && (
          <button
            onClick={() => setShowFlagMenu(!showFlagMenu)}
            style={{
              position: 'absolute',
              top: '50%',
              right: '-30px',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              opacity: 0.5,
              fontSize: '0.9rem',
              padding: '4px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
            title="Report message"
            aria-label="Report message"
          >
            ⚑
          </button>
        )}
      </div>

      {/* Flag menu */}
      {showFlagMenu && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: isOwnMessage ? '0' : 'auto',
            left: isOwnMessage ? 'auto' : '0',
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: 'var(--spacing-sm)',
            zIndex: 100,
            minWidth: '180px'
          }}
        >
          <p style={{
            margin: '0 0 var(--spacing-sm) 0',
            fontSize: 'var(--font-size-small)',
            color: 'var(--text-secondary)',
            fontWeight: 'bold'
          }}>
            Report as:
          </p>
          {flagReasons.map((reason) => (
            <button
              key={reason.value}
              onClick={() => {
                onFlag(message.id, reason.value);
                setShowFlagMenu(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-size-small)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--background)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {reason.label}
            </button>
          ))}
          <button
            onClick={() => setShowFlagMenu(false)}
            style={{
              display: 'block',
              width: '100%',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              textAlign: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--font-size-small)',
              color: 'var(--text-secondary)',
              marginTop: 'var(--spacing-xs)'
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;

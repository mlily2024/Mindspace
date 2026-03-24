import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../context/SocketContext';
import { peerSupportAPI } from '../../services/api';
import { joinGroup, leaveGroup, sendTypingIndicator, sendStopTyping, getSocket } from '../../services/socket';
import MessageBubble from './MessageBubble';

/**
 * ChatRoom Component
 * Real-time chat interface for peer support groups
 */
const ChatRoom = ({ group, membership, onBack }) => {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingDebounceRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        const response = await peerSupportAPI.getMessages(group.id, { limit: 50 });
        setMessages(response.data?.messages || []);
        setTimeout(scrollToBottom, 100);
      } catch (err) {
        setError('Failed to load messages');
        console.error('Load messages error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [group.id, scrollToBottom]);

  // Join socket room and set up listeners
  useEffect(() => {
    if (!isConnected || !group.id) return;

    // Join the group room
    joinGroup(group.id);

    const socketInstance = getSocket();
    if (!socketInstance) return;

    // Listen for new messages
    const handleNewMessage = (data) => {
      if (data.groupId === group.id) {
        setMessages(prev => [...prev, data.message]);
        setTimeout(scrollToBottom, 100);
      }
    };

    // Listen for typing indicators
    const handleTyping = (data) => {
      if (data.groupId === group.id && data.nickname !== membership?.anonymous_nickname) {
        setTypingUsers(prev => {
          if (!prev.includes(data.nickname)) {
            return [...prev, data.nickname];
          }
          return prev;
        });
      }
    };

    // Listen for stop typing
    const handleStopTyping = (data) => {
      if (data.groupId === group.id) {
        setTypingUsers(prev => prev.filter(n => n !== data.nickname));
      }
    };

    // Listen for online count updates
    const handleOnlineUpdate = (data) => {
      if (data.groupId === group.id) {
        setOnlineCount(data.count);
      }
    };

    socketInstance.on('peer:message', handleNewMessage);
    socketInstance.on('peer:typing', handleTyping);
    socketInstance.on('peer:stop_typing', handleStopTyping);
    socketInstance.on('peer:online_count', handleOnlineUpdate);

    return () => {
      leaveGroup(group.id);
      socketInstance.off('peer:message', handleNewMessage);
      socketInstance.off('peer:typing', handleTyping);
      socketInstance.off('peer:stop_typing', handleStopTyping);
      socketInstance.off('peer:online_count', handleOnlineUpdate);
    };
  }, [isConnected, group.id, membership, scrollToBottom]);

  // Handle typing indicator (debounced to prevent socket spam)
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    if (membership?.anonymous_nickname) {
      // Clear existing stop-typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Debounce: only send typing indicator at most once per 300ms
      if (!typingDebounceRef.current) {
        sendTypingIndicator(group.id, membership.anonymous_nickname);
        typingDebounceRef.current = setTimeout(() => {
          typingDebounceRef.current = null;
        }, 300);
      }

      // Set timeout to send stop typing after 2s of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        sendStopTyping(group.id, membership.anonymous_nickname);
      }, 2000);
    }
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      // Stop typing indicator
      if (membership?.anonymous_nickname) {
        sendStopTyping(group.id, membership.anonymous_nickname);
      }

      await peerSupportAPI.sendMessage(group.id, newMessage.trim());
      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      const errorMsg = err.error || err.message || 'Failed to send message';
      setError(errorMsg);
      console.error('Send message error:', err);
    } finally {
      setIsSending(false);
    }
  };

  // Flag message
  const handleFlagMessage = async (messageId, reason) => {
    try {
      await peerSupportAPI.flagMessage(messageId, reason);
      // Show success feedback
      alert('Message reported. Thank you for helping keep our community safe.');
    } catch (err) {
      console.error('Flag message error:', err);
      alert('Failed to report message. Please try again.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--background)'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)'
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.5rem',
            padding: 'var(--spacing-xs)',
            color: 'var(--text-primary)'
          }}
          aria-label="Go back"
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>{group.name}</h2>
          <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
            {isConnected ? (
              <>🟢 {onlineCount} online</>
            ) : (
              <>🔴 Disconnected</>
            )}
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontSize: 'var(--font-size-small)',
            color: 'var(--primary-color)',
            backgroundColor: 'var(--primary-light)',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)'
          }}>
            {membership?.anonymous_nickname}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--spacing-md)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {isLoading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%'
          }}>
            <div className="spinner" aria-label="Loading messages"></div>
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            color: 'var(--text-secondary)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>💬</span>
            <p>No messages yet. Be the first to start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={message.sender_nickname === membership?.anonymous_nickname}
                onFlag={handleFlagMessage}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div
          style={{
            padding: 'var(--spacing-xs) var(--spacing-md)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--font-size-small)',
            fontStyle: 'italic'
          }}
        >
          {typingUsers.length === 1
            ? `${typingUsers[0]} is typing...`
            : `${typingUsers.slice(0, 2).join(', ')}${typingUsers.length > 2 ? ` and ${typingUsers.length - 2} others` : ''} are typing...`
          }
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md)',
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            color: 'var(--danger-color)',
            fontSize: 'var(--font-size-small)',
            textAlign: 'center'
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        style={{
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 'var(--spacing-sm)'
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          placeholder="Type a message..."
          style={{
            flex: 1,
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            fontSize: 'var(--font-size-base)',
            backgroundColor: 'var(--background)',
            color: 'var(--text-primary)'
          }}
          disabled={!isConnected || isSending}
          aria-label="Message input"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || !isConnected || isSending}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            borderRadius: 'var(--radius-lg)',
            border: 'none',
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            cursor: newMessage.trim() && isConnected && !isSending ? 'pointer' : 'not-allowed',
            opacity: newMessage.trim() && isConnected && !isSending ? 1 : 0.5,
            fontSize: 'var(--font-size-base)',
            transition: 'opacity 0.2s'
          }}
          aria-label="Send message"
        >
          {isSending ? '...' : 'Send'}
        </button>
      </form>

      {/* Safety reminder */}
      <div
        style={{
          padding: 'var(--spacing-xs) var(--spacing-md)',
          backgroundColor: 'var(--background)',
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}
      >
        Remember: This is a supportive community. Be kind and respectful. If you're in crisis, please call your local emergency services.
      </div>
    </div>
  );
};

export default ChatRoom;

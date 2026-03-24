import React, { useState, useEffect, useRef } from 'react';
import { chatbotAPI } from '../services/api';

/**
 * Luna - Floating Chat Widget
 * AI wellness companion that provides supportive conversations
 */
const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      loadHistory();
    }
  }, [isOpen]);

  // Load conversation history
  const loadHistory = async () => {
    try {
      const response = await chatbotAPI.getHistory();
      if (response.data?.messages) {
        setMessages(response.data.messages);
      } else {
        // Start new conversation if none exists
        startNewConversation();
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  // Start new conversation
  const startNewConversation = async () => {
    try {
      const response = await chatbotAPI.newConversation();
      if (response.data?.message) {
        setMessages([response.data.message]);
      }
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  // Send message
  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      sender: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await chatbotAPI.chat(userMessage.content);

      // Simulate typing delay for more natural feel
      setTimeout(() => {
        setIsTyping(false);
        if (response.data?.message) {
          setMessages(prev => [...prev, response.data.message]);
        }
      }, 500 + Math.random() * 1000);
    } catch (error) {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        sender: 'luna',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        type: 'text'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Quick action buttons
  const quickActions = [
    { label: 'Breathing', action: 'I need a breathing exercise' },
    { label: 'Grounding', action: 'Can you guide me through grounding?' },
    { label: 'Affirmation', action: 'I need an affirmation' }
  ];

  const handleQuickAction = (action) => {
    setInputValue(action);
    setTimeout(() => {
      handleSend();
    }, 100);
  };

  // Styles
  const fabStyle = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--primary-color), #8A7A94)',
    border: 'none',
    boxShadow: '0 4px 20px rgba(155, 138, 165, 0.5)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.8rem',
    transition: 'all var(--transition-fast)',
    zIndex: 1000
  };

  const chatContainerStyle = {
    position: 'fixed',
    bottom: '100px',
    right: '24px',
    width: '380px',
    maxWidth: 'calc(100vw - 48px)',
    height: '500px',
    maxHeight: 'calc(100vh - 150px)',
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 1000,
    animation: 'fadeInUp 0.3s var(--animation-smooth)'
  };

  const headerStyle = {
    background: 'linear-gradient(135deg, var(--primary-color), #8A7A94)',
    color: 'white',
    padding: 'var(--spacing-md) var(--spacing-lg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  };

  const messagesContainerStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--spacing-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
    background: 'var(--background)'
  };

  const getMessageStyle = (sender) => ({
    maxWidth: '85%',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderRadius: sender === 'user'
      ? 'var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg)'
      : 'var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm)',
    background: sender === 'user'
      ? 'linear-gradient(135deg, var(--primary-color), #8A7A94)'
      : 'var(--surface)',
    color: sender === 'user' ? 'white' : 'var(--text-primary)',
    alignSelf: sender === 'user' ? 'flex-end' : 'flex-start',
    boxShadow: 'var(--shadow-sm)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  });

  const inputContainerStyle = {
    padding: 'var(--spacing-md)',
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)'
  };

  const inputWrapperStyle = {
    display: 'flex',
    gap: 'var(--spacing-sm)',
    alignItems: 'flex-end'
  };

  const inputStyle = {
    flex: 1,
    padding: 'var(--spacing-sm) var(--spacing-md)',
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--font-size-base)',
    fontFamily: 'var(--font-family-primary)',
    resize: 'none',
    minHeight: '44px',
    maxHeight: '100px',
    background: 'var(--background)'
  };

  const sendButtonStyle = {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: isLoading || !inputValue.trim()
      ? 'var(--border)'
      : 'linear-gradient(135deg, var(--primary-color), #8A7A94)',
    border: 'none',
    color: 'white',
    cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    transition: 'all var(--transition-fast)'
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          style={fabStyle}
          onClick={() => setIsOpen(true)}
          aria-label="Open chat with Luna"
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.1)';
            e.target.style.boxShadow = '0 6px 25px rgba(155, 138, 165, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 20px rgba(155, 138, 165, 0.5)';
          }}
        >
          <span role="img" aria-hidden="true">🌙</span>
        </button>
      )}

      {/* Chat Container */}
      {isOpen && (
        <div style={chatContainerStyle}>
          {/* Header */}
          <div style={headerStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span style={{ fontSize: '1.5rem' }}>🌙</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-base)', fontWeight: 600 }}>Luna</h3>
                <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>Your wellness companion</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
              <button
                onClick={startNewConversation}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.75rem'
                }}
                title="New conversation"
              >
                New
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  padding: '0 4px'
                }}
                aria-label="Close chat"
              >
                ×
              </button>
            </div>
          </div>

          {/* Messages */}
          <div style={messagesContainerStyle}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 'var(--spacing-xl)' }}>
                <p>Starting conversation...</p>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} style={getMessageStyle(msg.sender)}>
                {msg.sender === 'luna' && (
                  <span style={{ fontSize: '0.9rem', marginRight: '4px' }}>🌙</span>
                )}
                {msg.content}
              </div>
            ))}

            {isTyping && (
              <div style={{
                ...getMessageStyle('luna'),
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ fontSize: '0.9rem' }}>🌙</span>
                <span style={{ animation: 'pulse-gentle 1s infinite' }}>...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length > 0 && messages.length < 3 && (
            <div style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              display: 'flex',
              gap: 'var(--spacing-xs)',
              flexWrap: 'wrap',
              borderTop: '1px solid var(--border)'
            }}>
              {quickActions.map((qa, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickAction(qa.action)}
                  style={{
                    padding: '4px 12px',
                    background: 'var(--primary-light)',
                    border: '1px solid var(--primary-color)',
                    borderRadius: 'var(--radius-full)',
                    color: 'var(--primary-color)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={inputContainerStyle}>
            <div style={inputWrapperStyle}>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                style={inputStyle}
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
                style={sendButtonStyle}
                aria-label="Send message"
              >
                {isLoading ? '...' : '➤'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;

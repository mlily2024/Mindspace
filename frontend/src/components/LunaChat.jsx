import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * LunaChat - Enhanced Luna 2.0 chatbot component
 * Full-featured AI wellness companion with technique suggestions,
 * emotional granularity prompts, data insights, and crisis detection.
 */
const LunaChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionContext, setSessionContext] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      if (messages.length === 0) {
        startNewSession();
      }
    }
  }, [isOpen]);

  const loadContext = async () => {
    try {
      const res = await api.get('/luna/context');
      setSessionContext(res.data || null);
    } catch (err) {
      console.error('Failed to load Luna context:', err);
    }
  };

  const startNewSession = async () => {
    setMessages([{
      sender: 'luna',
      type: 'text',
      content: "Hi, I'm Luna. How are you feeling right now?",
      timestamp: new Date().toISOString()
    }]);
    setSessionId(null);
    setSessionContext(null);
    loadContext();
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMsg = {
      sender: 'user',
      type: 'text',
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const res = await api.post('/luna/message', {
        message: userMsg.content,
        sessionId
      });

      const data = res.data || res;

      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      setTimeout(() => {
        setIsTyping(false);
        const newMessages = [];

        // Crisis alert
        if (data.crisisDetected) {
          newMessages.push({
            sender: 'luna',
            type: 'crisis',
            content: data.response || "I'm concerned about what you've shared.",
            crisisResources: data.crisisResources || [
              '988 Suicide & Crisis Lifeline: Call or text 988',
              'Crisis Text Line: Text HOME to 741741',
              'Emergency: Call 911'
            ],
            timestamp: new Date().toISOString()
          });
        } else {
          // Text response
          if (data.response) {
            newMessages.push({
              sender: 'luna',
              type: 'text',
              content: data.response,
              timestamp: new Date().toISOString()
            });
          }

          // Suggested technique
          if (data.suggestedTechnique) {
            newMessages.push({
              sender: 'luna',
              type: 'technique',
              technique: data.suggestedTechnique,
              timestamp: new Date().toISOString()
            });
          }

          // Emotional granularity
          if (data.granularityPrompt) {
            newMessages.push({
              sender: 'luna',
              type: 'granularity',
              content: data.granularityPrompt.text,
              options: data.granularityPrompt.options || [],
              timestamp: new Date().toISOString()
            });
          }

          // Data insight
          if (data.dataInsight) {
            newMessages.push({
              sender: 'luna',
              type: 'insight',
              content: data.dataInsight,
              timestamp: new Date().toISOString()
            });
          }
        }

        setMessages(prev => [...prev, ...newMessages]);

        // Update session context
        if (data.sessionContext) {
          setSessionContext(data.sessionContext);
        }
      }, 500 + Math.random() * 800);
    } catch (err) {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        sender: 'luna',
        type: 'text',
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGranularitySelect = (option) => {
    setInputValue(option);
    setTimeout(() => handleSend(), 100);
  };

  const handleTryTechnique = (technique) => {
    // 2026-06-17: backend lunaService sends { type, name } in
    // suggestedTechnique, not { title }. The old `.title` lookup was
    // undefined, so the autofilled text became literally
    //   I'd like to try "undefined"
    // Fall through title → name → 'this technique' so a missing field
    // never surfaces as the JS undefined value.
    const label = technique?.title || technique?.name || 'this technique';
    setInputValue(`I'd like to try "${label}"`);
    setTimeout(() => handleSend(), 100);
  };

  // --- Styles ---
  const fabStyle = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #9B8AA5, #8A7A94)',
    color: 'white',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(155, 138, 165, 0.4)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s ease'
  };

  // 2026-06-18: maxHeight cap so the window can NEVER exceed the
  // viewport. Previously height: 560px + bottom: 96px needed 656px
  // of vertical room — on short laptop screens, split-screen, or
  // browser zoom, the top of the window (with the header + close +
  // minimise buttons) was clipped above the viewport. Because the
  // window is position: fixed, page scroll cannot reach it.
  //
  // calc(100vh - 120px) leaves 96px below (FAB clearance) + ~24px
  // above (breathing room) so the header is always visible.
  const chatWindowStyle = {
    position: 'fixed',
    bottom: '96px',
    right: '24px',
    width: isMobile ? 'calc(100vw - 32px)' : '420px',
    maxWidth: '95vw',
    height: isMobile ? '70vh' : '560px',
    maxHeight: 'calc(100vh - 120px)',
    background: 'white',
    borderRadius: 'var(--radius-xl)',
    boxShadow: '0 8px 40px rgba(155, 138, 165, 0.3)',
    display: 'flex',
    flexDirection: 'row',
    overflow: 'hidden',
    zIndex: 1001
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--spacing-md) var(--spacing-lg)',
    background: 'linear-gradient(135deg, #9B8AA5, #8A7A94)',
    color: 'white'
  };

  const messagesContainerStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--spacing-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
    background: '#FFFBF8'
  };

  const inputAreaStyle = {
    display: 'flex',
    gap: 'var(--spacing-sm)',
    padding: 'var(--spacing-md)',
    borderTop: '1px solid #F3EDF7',
    background: 'white'
  };

  const inputStyle = {
    flex: 1,
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #B8A9C9',
    fontSize: 'var(--font-size-base)',
    color: '#4A3F55',
    background: '#FFFBF8',
    outline: 'none',
    fontFamily: 'inherit'
  };

  const sendButtonStyle = {
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'linear-gradient(135deg, #9B8AA5, #8A7A94)',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: 'var(--font-size-base)'
  };

  const userBubbleStyle = {
    alignSelf: 'flex-end',
    background: 'linear-gradient(135deg, #9B8AA5, #B8A9C9)',
    color: 'white',
    borderRadius: '16px 16px 4px 16px',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    maxWidth: '80%',
    wordBreak: 'break-word'
  };

  const lunaBubbleStyle = {
    alignSelf: 'flex-start',
    background: '#F3EDF7',
    color: '#4A3F55',
    borderRadius: '16px 16px 16px 4px',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    maxWidth: '80%',
    wordBreak: 'break-word'
  };

  const crisisBannerStyle = {
    alignSelf: 'stretch',
    background: '#FDE8E8',
    border: '2px solid #E53E3E',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--spacing-md)',
    color: '#6B2D2D'
  };

  const techniqueCardStyle = {
    alignSelf: 'flex-start',
    background: 'white',
    border: '1px solid #B8A9C9',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--spacing-md)',
    maxWidth: '85%'
  };

  const insightCardStyle = {
    alignSelf: 'flex-start',
    background: 'linear-gradient(135deg, #E6F7ED, #D5F0E3)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    maxWidth: '80%',
    color: '#276749',
    fontSize: 'var(--font-size-small)',
    fontStyle: 'italic'
  };

  const granularityStyle = {
    alignSelf: 'flex-start',
    background: '#FEF3C7',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--spacing-md)',
    maxWidth: '85%'
  };

  // 2026-06-18: shared shape for the Minimise + Close icon buttons in
  // the header. Bigger hit area + radius so they read as buttons; hover
  // background applied inline on mouse enter/leave to avoid pulling
  // CSS-in-JS dependency for a two-element interaction.
  const iconButtonStyle = {
    background: 'rgba(255,255,255,0.0)',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: 1,
    width: 28,
    height: 28,
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 120ms ease'
  };

  const sidebarStyle = {
    width: showSidebar && !isMobile ? '200px' : '0px',
    overflow: 'hidden',
    borderLeft: showSidebar && !isMobile ? '1px solid #F3EDF7' : 'none',
    background: 'white',
    transition: 'width 0.3s ease',
    flexShrink: 0
  };

  const renderMessage = (msg, idx) => {
    if (msg.sender === 'user') {
      return (
        <div key={idx} style={userBubbleStyle}>
          {msg.content}
        </div>
      );
    }

    switch (msg.type) {
      case 'crisis':
        return (
          <div key={idx} style={crisisBannerStyle} role="alert">
            <div style={{ fontWeight: 700, marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-large)' }}>
              You're Not Alone
            </div>
            <p style={{ marginBottom: 'var(--spacing-sm)' }}>{msg.content}</p>
            <div style={{ marginTop: 'var(--spacing-sm)', fontSize: 'var(--font-size-small)' }}>
              <strong>Crisis Resources:</strong>
              <ul style={{ paddingLeft: 'var(--spacing-md)', marginTop: 'var(--spacing-xs)' }}>
                {(msg.crisisResources || []).map((r, i) => (
                  <li key={i} style={{ padding: '2px 0' }}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        );

      case 'technique':
        return (
          <div key={idx} style={techniqueCardStyle}>
            <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', marginBottom: '4px' }}>Suggested Technique</div>
            <div style={{ fontWeight: 600, color: '#4A3F55', marginBottom: 'var(--spacing-xs)' }}>
              {msg.technique?.title}
            </div>
            <p style={{ fontSize: 'var(--font-size-small)', color: '#4A3F55', marginBottom: 'var(--spacing-sm)' }}>
              {msg.technique?.description}
            </p>
            <button
              onClick={() => handleTryTechnique(msg.technique)}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #9B8AA5',
                background: 'transparent',
                color: '#9B8AA5',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 'var(--font-size-small)'
              }}
            >
              Try it
            </button>
          </div>
        );

      case 'granularity':
        return (
          <div key={idx} style={granularityStyle}>
            <p style={{ color: '#92400E', marginBottom: 'var(--spacing-sm)', fontWeight: 500 }}>
              {msg.content}
            </p>
            {msg.options?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {msg.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleGranularitySelect(opt)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      border: '1px solid #D69E2E',
                      background: 'white',
                      color: '#92400E',
                      cursor: 'pointer',
                      fontSize: 'var(--font-size-small)'
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'insight':
        return (
          <div key={idx} style={insightCardStyle}>
            <span style={{ marginRight: '6px' }}>&#x1F4CA;</span>
            {msg.content}
          </div>
        );

      default:
        return (
          <div key={idx} style={lunaBubbleStyle}>
            {msg.content}
          </div>
        );
    }
  };

  return (
    <>
      {/* FAB toggle. 2026-06-16: className "chat-toggle" is the hook
          Insights uses to open Luna programmatically via
          document.querySelector('.chat-toggle').click() — without it,
          the "Chat with Luna" action button on the Insights page
          silently no-ops because the FAB had no matching selector. */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chat-toggle"
          style={fabStyle}
          aria-label="Open Luna chat"
        >
          &#x1F31F;
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div style={chatWindowStyle}>
          {/* Main chat area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Header */}
            <div style={headerStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span style={{ fontSize: '20px' }}>&#x1F31F;</span>
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-base)' }}>Luna</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                {!isMobile && (
                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}
                    title="Toggle context sidebar"
                  >
                    {showSidebar ? 'Hide' : 'Context'}
                  </button>
                )}
                <button
                  onClick={startNewSession}
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}
                >
                  New Session
                </button>
                {/* 2026-06-18: split the previous lone ASCII "x" into TWO
                    affordances — Minimise + Close. They call the same
                    handler because the component is mounted at app level,
                    so setIsOpen(false) preserves the conversation in
                    React state either way. The split exists so the user
                    has a recognisable "tuck this away, keep my chat"
                    target. Icons rendered larger with hover background
                    so they read as real buttons, not stray characters. */}
                <button
                  onClick={() => setIsOpen(false)}
                  style={iconButtonStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.0)'; }}
                  aria-label="Minimise chat"
                  title="Minimise (keeps your conversation)"
                >
                  &#x2013;
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  style={iconButtonStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.0)'; }}
                  aria-label="Close chat"
                  title="Close"
                >
                  &#x2715;
                </button>
              </div>
            </div>

            {/* Messages */}
            <div style={messagesContainerStyle}>
              {messages.map((msg, idx) => renderMessage(msg, idx))}

              {isTyping && (
                <div style={{ ...lunaBubbleStyle, opacity: 0.7 }}>
                  <span>Luna is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={inputAreaStyle}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Talk to Luna..."
                style={inputStyle}
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                style={{
                  ...sendButtonStyle,
                  opacity: !inputValue.trim() || isLoading ? 0.5 : 1,
                  cursor: !inputValue.trim() || isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                Send
              </button>
            </div>
          </div>

          {/* Sidebar — desktop only */}
          <div style={sidebarStyle}>
            {showSidebar && sessionContext && (
              <div style={{ padding: 'var(--spacing-md)', fontSize: 'var(--font-size-small)', overflowY: 'auto', height: '100%' }}>
                <div style={{ fontWeight: 600, color: '#4A3F55', marginBottom: 'var(--spacing-md)' }}>Session Context</div>

                {sessionContext.themes?.length > 0 && (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <div style={{ color: '#9B8AA5', fontWeight: 500, marginBottom: '4px' }}>Key Themes</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {sessionContext.themes.map((theme, i) => (
                        <span key={i} style={{
                          background: '#F3EDF7',
                          color: '#4A3F55',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px'
                        }}>{theme}</span>
                      ))}
                    </div>
                  </div>
                )}

                {sessionContext.moodTrend && (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <div style={{ color: '#9B8AA5', fontWeight: 500, marginBottom: '4px' }}>Mood Trend</div>
                    <div style={{ color: '#4A3F55' }}>{sessionContext.moodTrend}</div>
                  </div>
                )}

                {sessionContext.techniqueEffectiveness && (
                  <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <div style={{ color: '#9B8AA5', fontWeight: 500, marginBottom: '4px' }}>Technique Effectiveness</div>
                    <div style={{ color: '#4A3F55' }}>{sessionContext.techniqueEffectiveness}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LunaChat;

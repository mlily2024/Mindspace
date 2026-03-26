import React, { useState, useEffect, useCallback } from 'react';

/**
 * EMAPrompt - Ecological Momentary Assessment micro-prompt
 * Floating notification for quick mood check-ins throughout the day.
 * Props:
 *   - prompt: { prompt_id, prompt_text }
 *   - onRespond: (response) => void
 *   - onDismiss: () => void
 */
const EMAPrompt = ({ prompt, onRespond, onDismiss }) => {
  const [moodRating, setMoodRating] = useState(null);
  const [energy, setEnergy] = useState(5);
  const [note, setNote] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Slide in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss after 60 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDismiss();
    }, 60000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss?.();
    }, 300);
  }, [onDismiss]);

  const handleMoodSelect = (rating) => {
    setMoodRating(rating);
    setShowDetails(true);
  };

  const handleSubmit = () => {
    onRespond?.({
      prompt_id: prompt?.prompt_id,
      mood_rating: moodRating,
      energy_level: energy,
      note: note.trim() || null
    });
    setIsExiting(true);
  };

  const handleQuickSubmit = (rating) => {
    onRespond?.({
      prompt_id: prompt?.prompt_id,
      mood_rating: rating,
      energy_level: null,
      note: null
    });
    setIsExiting(true);
  };

  const moodEmojis = [
    { value: 1, emoji: '\uD83D\uDE1E', label: 'Very Low' },
    { value: 2, emoji: '\uD83D\uDE14', label: 'Low' },
    { value: 3, emoji: '\uD83D\uDE10', label: 'Okay' },
    { value: 4, emoji: '\uD83D\uDE42', label: 'Good' },
    { value: 5, emoji: '\uD83D\uDE0A', label: 'Great' }
  ];

  const overlayStyle = {
    position: 'fixed',
    top: 'var(--spacing-lg)',
    right: 'var(--spacing-lg)',
    zIndex: 9999,
    transform: isVisible && !isExiting ? 'translateX(0)' : 'translateX(120%)',
    opacity: isVisible && !isExiting ? 1 : 0,
    transition: 'transform 0.3s ease, opacity 0.3s ease'
  };

  const cardStyle = {
    background: 'white',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-lg)',
    boxShadow: '0 8px 30px rgba(155, 138, 165, 0.25)',
    border: '1px solid #B8A9C9',
    maxWidth: '320px',
    width: '100%'
  };

  const emojiButtonStyle = (isSelected) => ({
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: isSelected ? '2px solid #9B8AA5' : '2px solid transparent',
    background: isSelected ? '#F3EDF7' : 'transparent',
    fontSize: '24px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  });

  const dismissButtonStyle = {
    background: 'none',
    border: 'none',
    color: '#9B8AA5',
    fontSize: 'var(--font-size-small)',
    cursor: 'pointer',
    padding: 'var(--spacing-xs)',
    textDecoration: 'underline'
  };

  const submitButtonStyle = {
    padding: 'var(--spacing-sm) var(--spacing-lg)',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'linear-gradient(135deg, #9B8AA5, #8A7A94)',
    color: 'white',
    fontSize: 'var(--font-size-small)',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%'
  };

  const sliderStyle = {
    width: '100%',
    accentColor: '#9B8AA5'
  };

  const textareaStyle = {
    width: '100%',
    padding: 'var(--spacing-sm)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #B8A9C9',
    fontSize: 'var(--font-size-small)',
    color: '#4A3F55',
    background: '#FFFBF8',
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  };

  return (
    <div style={overlayStyle} role="alertdialog" aria-label="Mood check-in prompt">
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
          <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: '#4A3F55' }}>
            {prompt?.prompt_text || 'How are you right now?'}
          </span>
          <button
            onClick={handleDismiss}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#9B8AA5', padding: '0', lineHeight: 1 }}
            aria-label="Close prompt"
          >
            x
          </button>
        </div>

        {/* Mood Emoji Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
          {moodEmojis.map((item) => (
            <button
              key={item.value}
              onClick={() => showDetails ? handleMoodSelect(item.value) : handleQuickSubmit(item.value)}
              onDoubleClick={() => handleMoodSelect(item.value)}
              style={emojiButtonStyle(moodRating === item.value)}
              aria-label={item.label}
              title={item.label}
            >
              {item.emoji}
            </button>
          ))}
        </div>

        {/* Expanded details */}
        {showDetails && moodRating && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {/* Energy slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5' }}>Energy</label>
                <span style={{ fontSize: 'var(--font-size-small)', color: '#4A3F55', fontWeight: 500 }}>{energy}/10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={energy}
                onChange={(e) => setEnergy(Number(e.target.value))}
                style={sliderStyle}
              />
            </div>

            {/* Short note */}
            <div>
              <label style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', display: 'block', marginBottom: '4px' }}>
                Quick note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                placeholder="What's on your mind?"
                rows={2}
                maxLength={200}
                style={textareaStyle}
              />
              <div style={{ textAlign: 'right', fontSize: '11px', color: '#B8A9C9' }}>{note.length}/200</div>
            </div>

            <button onClick={handleSubmit} style={submitButtonStyle}>
              Submit
            </button>
          </div>
        )}

        {!showDetails && (
          <div style={{ textAlign: 'center' }}>
            <button onClick={handleDismiss} style={dismissButtonStyle}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EMAPrompt;

import React, { useState } from 'react';

/**
 * EmojiMoodPicker - A friendly, visual mood selection component
 * Replaces clinical 1-10 slider with approachable emoji-based selection
 */
const EmojiMoodPicker = ({ value, onChange, label = "How are you feeling?", showLabels = true }) => {
  const [hoveredMood, setHoveredMood] = useState(null);

  const moods = [
    { emoji: '😢', label: 'Struggling', value: 2, color: '#E8A5A5', description: 'Having a tough time' },
    { emoji: '😔', label: 'Low', value: 4, color: '#F5C9B3', description: 'Feeling down' },
    { emoji: '😐', label: 'Okay', value: 5, color: '#F5D89A', description: 'Getting by' },
    { emoji: '🙂', label: 'Good', value: 7, color: '#A8C5A8', description: 'Doing well' },
    { emoji: '😊', label: 'Great', value: 9, color: '#7BC47B', description: 'Feeling wonderful' }
  ];

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--spacing-lg)',
    padding: 'var(--spacing-xl)',
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-sm)'
  };

  const labelStyle = {
    fontSize: 'var(--font-size-xl)',
    fontFamily: 'var(--font-family-heading)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    textAlign: 'center',
    margin: 0
  };

  const moodsContainerStyle = {
    display: 'flex',
    gap: 'var(--spacing-md)',
    flexWrap: 'wrap',
    justifyContent: 'center'
  };

  const getMoodButtonStyle = (mood, isSelected, isHovered) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
    padding: 'var(--spacing-md)',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    background: isSelected
      ? `linear-gradient(145deg, ${mood.color}40, ${mood.color}60)`
      : isHovered
        ? 'var(--surface-hover)'
        : 'transparent',
    cursor: 'pointer',
    transition: 'all var(--transition-base) var(--animation-smooth)',
    transform: isSelected ? 'scale(1.1)' : isHovered ? 'scale(1.05)' : 'scale(1)',
    boxShadow: isSelected ? `0 4px 20px ${mood.color}50` : 'none',
    minWidth: '80px'
  });

  const emojiStyle = (isSelected) => ({
    fontSize: '2.5rem',
    transition: 'transform var(--transition-fast)',
    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
    filter: isSelected ? 'none' : 'grayscale(30%)'
  });

  const moodLabelStyle = (isSelected) => ({
    fontSize: 'var(--font-size-small)',
    fontWeight: isSelected ? 600 : 500,
    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
    transition: 'color var(--transition-fast)'
  });

  const selectedMood = moods.find(m => m.value === value);
  const displayMood = hoveredMood || selectedMood;

  return (
    <div style={containerStyle} role="group" aria-labelledby="mood-picker-label">
      <h3 id="mood-picker-label" style={labelStyle}>{label}</h3>

      <div style={moodsContainerStyle}>
        {moods.map((mood) => {
          const isSelected = value === mood.value;
          const isHovered = hoveredMood?.value === mood.value;

          return (
            <button
              key={mood.value}
              type="button"
              onClick={() => onChange(mood.value)}
              onMouseEnter={() => setHoveredMood(mood)}
              onMouseLeave={() => setHoveredMood(null)}
              onFocus={() => setHoveredMood(mood)}
              onBlur={() => setHoveredMood(null)}
              style={getMoodButtonStyle(mood, isSelected, isHovered)}
              aria-label={`${mood.label} - ${mood.description}`}
              aria-pressed={isSelected}
            >
              <span style={emojiStyle(isSelected)} role="img" aria-hidden="true">
                {mood.emoji}
              </span>
              {showLabels && (
                <span style={moodLabelStyle(isSelected)}>{mood.label}</span>
              )}
            </button>
          );
        })}
      </div>

      {displayMood && (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--spacing-md)',
            background: `linear-gradient(135deg, ${displayMood.color}20, ${displayMood.color}40)`,
            borderRadius: 'var(--radius-lg)',
            minHeight: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '300px'
          }}
          aria-live="polite"
        >
          <p style={{
            margin: 0,
            color: 'var(--text-primary)',
            fontWeight: 500
          }}>
            {displayMood.description}
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * EmojiEnergyPicker - Energy level selector with battery-style icons
 */
export const EmojiEnergyPicker = ({ value, onChange, label = "Energy level" }) => {
  const [hoveredLevel, setHoveredLevel] = useState(null);

  const levels = [
    { emoji: '🪫', label: 'Drained', value: 2, color: '#E8A5A5' },
    { emoji: '🔋', label: 'Low', value: 4, color: '#F5C9B3' },
    { emoji: '⚡', label: 'Moderate', value: 6, color: '#F5D89A' },
    { emoji: '✨', label: 'Good', value: 8, color: '#A8C5A8' },
    { emoji: '🌟', label: 'Energized', value: 10, color: '#7BC47B' }
  ];

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--spacing-md)',
    padding: 'var(--spacing-lg)',
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)'
  };

  return (
    <div style={containerStyle} role="group" aria-labelledby="energy-picker-label">
      <h4 id="energy-picker-label" style={{
        fontSize: 'var(--font-size-large)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        margin: 0
      }}>
        {label}
      </h4>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap', justifyContent: 'center' }}>
        {levels.map((level) => {
          const isSelected = value === level.value;
          const isHovered = hoveredLevel?.value === level.value;

          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onChange(level.value)}
              onMouseEnter={() => setHoveredLevel(level)}
              onMouseLeave={() => setHoveredLevel(null)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: 'var(--spacing-sm)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: isSelected ? `${level.color}40` : isHovered ? 'var(--surface-hover)' : 'transparent',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                minWidth: '60px'
              }}
              aria-label={level.label}
              aria-pressed={isSelected}
            >
              <span style={{ fontSize: '1.5rem' }}>{level.emoji}</span>
              <span style={{
                fontSize: '0.7rem',
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isSelected ? 600 : 400
              }}>
                {level.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * QuickMoodSlider - Compact slider for optional detailed input
 */
export const QuickMoodSlider = ({ value, onChange, label, min = 1, max = 10, lowLabel = "Low", highLabel = "High" }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--spacing-sm)',
      padding: 'var(--spacing-md)',
      background: 'var(--background)',
      borderRadius: 'var(--radius-md)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{
          fontSize: 'var(--font-size-small)',
          fontWeight: 500,
          color: 'var(--text-secondary)'
        }}>
          {label}
        </label>
        <span style={{
          fontSize: 'var(--font-size-small)',
          fontWeight: 600,
          color: 'var(--primary-color)',
          background: 'var(--primary-light)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)'
        }}>
          {value}/{max}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{
          width: '100%',
          height: '8px',
          borderRadius: 'var(--radius-full)',
          background: `linear-gradient(to right, var(--primary-color) 0%, var(--primary-color) ${((value - min) / (max - min)) * 100}%, var(--border) ${((value - min) / (max - min)) * 100}%, var(--border) 100%)`,
          appearance: 'none',
          cursor: 'pointer'
        }}
        aria-label={label}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{lowLabel}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{highLabel}</span>
      </div>
    </div>
  );
};

export default EmojiMoodPicker;

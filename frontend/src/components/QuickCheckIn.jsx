import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

/**
 * QuickCheckIn - 10-second quick mood check-in modal
 * Shows 5 mood emoji buttons with optional energy slider
 */
const QuickCheckIn = ({ isOpen, onClose, onExpandToFull }) => {
  const [selectedMood, setSelectedMood] = useState(null);
  const [energy, setEnergy] = useState(3);
  const [showEnergy, setShowEnergy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);
  const dialogRef = useRef(null);
  const firstButtonRef = useRef(null);

  const moods = [
    { value: 1, emoji: '\u{1F622}', label: 'Awful', color: '#E8A5A5' },
    { value: 2, emoji: '\u{1F615}', label: 'Bad', color: '#F5C9B3' },
    { value: 3, emoji: '\u{1F610}', label: 'Okay', color: '#F5D89A' },
    { value: 4, emoji: '\u{1F60A}', label: 'Good', color: '#A8C5A8' },
    { value: 5, emoji: '\u{1F604}', label: 'Great', color: '#7BC47B' }
  ];

  // Focus trap and keyboard navigation
  useEffect(() => {
    if (isOpen && firstButtonRef.current) {
      firstButtonRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
    // Trap focus within dialog
    if (e.key === 'Tab' && dialogRef.current) {
      const focusable = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMood(null);
      setEnergy(3);
      setShowEnergy(false);
      setShowSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedMood) return;
    setSubmitting(true);
    setError(null);

    try {
      await api.post('/quick-checkin', {
        mood: selectedMood,
        energy: showEnergy ? energy : undefined
      });
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to save check-in');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Overlay style
  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(74, 63, 85, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 'var(--spacing-md)',
    backdropFilter: 'blur(4px)'
  };

  const dialogStyle = {
    background: '#FFFBF8',
    borderRadius: 'var(--radius-xl, 20px)',
    padding: 'var(--spacing-xl, 32px)',
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(74, 63, 85, 0.25)',
    position: 'relative',
    animation: 'slideUp 0.3s ease-out'
  };

  const titleStyle = {
    fontSize: 'var(--font-size-xl, 1.25rem)',
    fontWeight: 600,
    color: '#4A3F55',
    textAlign: 'center',
    marginBottom: 'var(--spacing-lg, 24px)',
    fontFamily: 'var(--font-family-heading, inherit)'
  };

  const moodsRowStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: 'var(--spacing-sm, 8px)',
    marginBottom: 'var(--spacing-lg, 24px)'
  };

  const getMoodButtonStyle = (mood, isSelected) => ({
    width: '60px',
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    border: isSelected ? `3px solid ${mood.color}` : '2px solid transparent',
    borderRadius: 'var(--radius-lg, 16px)',
    background: isSelected
      ? `linear-gradient(145deg, ${mood.color}30, ${mood.color}50)`
      : 'var(--surface, #fff)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    transform: isSelected ? 'scale(1.15)' : 'scale(1)',
    boxShadow: isSelected
      ? `0 4px 16px ${mood.color}40`
      : '0 2px 8px rgba(74, 63, 85, 0.08)',
    padding: 0
  });

  const moodLabelStyle = {
    fontSize: '0.7rem',
    color: '#4A3F55',
    textAlign: 'center',
    marginTop: '4px',
    fontWeight: 500
  };

  const energyContainerStyle = {
    background: 'var(--surface, #fff)',
    borderRadius: 'var(--radius-lg, 16px)',
    padding: 'var(--spacing-md, 16px)',
    marginBottom: 'var(--spacing-md, 16px)'
  };

  const sliderStyle = {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    background: `linear-gradient(to right, #9B8AA5 0%, #9B8AA5 ${((energy - 1) / 4) * 100}%, #e0d6e8 ${((energy - 1) / 4) * 100}%, #e0d6e8 100%)`,
    appearance: 'none',
    cursor: 'pointer',
    outline: 'none'
  };

  const submitButtonStyle = {
    width: '100%',
    padding: 'var(--spacing-md, 14px)',
    background: selectedMood
      ? 'linear-gradient(135deg, #9B8AA5, #B8A9C9)'
      : '#e0d6e8',
    color: selectedMood ? '#fff' : '#a098a8',
    border: 'none',
    borderRadius: 'var(--radius-lg, 12px)',
    fontSize: 'var(--font-size-base, 1rem)',
    fontWeight: 600,
    cursor: selectedMood ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s ease',
    opacity: submitting ? 0.7 : 1
  };

  const linkStyle = {
    display: 'block',
    textAlign: 'center',
    color: '#9B8AA5',
    fontSize: 'var(--font-size-small, 0.875rem)',
    marginTop: 'var(--spacing-md, 12px)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    textDecoration: 'underline',
    fontWeight: 500
  };

  const closeButtonStyle = {
    position: 'absolute',
    top: 'var(--spacing-md, 12px)',
    right: 'var(--spacing-md, 12px)',
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    color: '#4A3F55',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius-md, 8px)',
    lineHeight: 1
  };

  // Success animation view
  if (showSuccess) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div
          style={{
            ...dialogStyle,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            gap: 'var(--spacing-md, 16px)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #A8C5A8, #7BC47B)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            animation: 'scaleIn 0.4s ease-out'
          }}>
            <span role="img" aria-label="Success">&#10003;</span>
          </div>
          <p style={{
            fontSize: 'var(--font-size-lg, 1.125rem)',
            fontWeight: 600,
            color: '#4A3F55',
            margin: 0
          }}>
            Check-in saved!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Quick mood check-in"
        aria-modal="true"
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          style={closeButtonStyle}
          onClick={onClose}
          aria-label="Close check-in"
        >
          &times;
        </button>

        <h2 style={titleStyle}>How are you feeling?</h2>

        {/* Mood emoji buttons */}
        <div style={moodsRowStyle} role="radiogroup" aria-label="Select your mood">
          {moods.map((mood, index) => (
            <div key={mood.value} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                ref={index === 0 ? firstButtonRef : null}
                type="button"
                onClick={() => setSelectedMood(mood.value)}
                style={getMoodButtonStyle(mood, selectedMood === mood.value)}
                aria-label={`${mood.label} - mood ${mood.value} of 5`}
                aria-checked={selectedMood === mood.value}
                role="radio"
              >
                <span role="img" aria-hidden="true">{mood.emoji}</span>
              </button>
              <span style={moodLabelStyle}>{mood.label}</span>
            </div>
          ))}
        </div>

        {/* Energy toggle and slider */}
        {!showEnergy ? (
          <button
            type="button"
            onClick={() => setShowEnergy(true)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              background: 'none',
              border: '1px dashed #B8A9C9',
              borderRadius: 'var(--radius-md, 8px)',
              padding: 'var(--spacing-sm, 8px)',
              color: '#9B8AA5',
              cursor: 'pointer',
              fontSize: 'var(--font-size-small, 0.875rem)',
              marginBottom: 'var(--spacing-md, 16px)'
            }}
          >
            + Add energy level
          </button>
        ) : (
          <div style={energyContainerStyle}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-sm, 8px)'
            }}>
              <span style={{
                fontSize: 'var(--font-size-small, 0.875rem)',
                fontWeight: 500,
                color: '#4A3F55'
              }}>
                Energy level
              </span>
              <span style={{
                fontSize: 'var(--font-size-small, 0.875rem)',
                fontWeight: 600,
                color: '#9B8AA5',
                background: '#f0ebf4',
                padding: '2px 10px',
                borderRadius: '12px'
              }}>
                {energy}/5
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={energy}
              onChange={(e) => setEnergy(parseInt(e.target.value))}
              style={sliderStyle}
              aria-label="Energy level"
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '4px'
            }}>
              <span style={{ fontSize: '0.7rem', color: '#9B8AA5' }}>Low</span>
              <span style={{ fontSize: '0.7rem', color: '#9B8AA5' }}>High</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p style={{
            color: '#E8A5A5',
            fontSize: 'var(--font-size-small, 0.875rem)',
            textAlign: 'center',
            margin: '0 0 var(--spacing-sm, 8px) 0'
          }}>
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedMood || submitting}
          style={submitButtonStyle}
        >
          {submitting ? 'Saving...' : 'Save Check-in'}
        </button>

        {/* Expand to full */}
        <button
          type="button"
          onClick={onExpandToFull}
          style={linkStyle}
        >
          Tell me more &rarr;
        </button>

        {/* Keyframe animations */}
        <style>{`
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.5); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default QuickCheckIn;

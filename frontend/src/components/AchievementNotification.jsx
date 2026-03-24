import React, { useState, useEffect } from 'react';

/**
 * AchievementNotification - Shows popup when new achievements are earned
 */
const AchievementNotification = ({ achievements = [], onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (achievements.length > 0) {
      setVisible(true);
      setCurrentIndex(0);
    }
  }, [achievements]);

  const handleDismiss = () => {
    if (currentIndex < achievements.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setVisible(false);
      if (onDismiss) {
        onDismiss(achievements.map(a => a.achievement_id));
      }
    }
  };

  if (!visible || achievements.length === 0) return null;

  const achievement = achievements[currentIndex];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.3s ease-out'
      }}
      onClick={handleDismiss}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #FFF8E8, #FFFBF0)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--spacing-xxl)',
          maxWidth: '400px',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          animation: 'bounceIn 0.5s ease-out',
          border: '3px solid #FFD700'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confetti effect */}
        <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)', animation: 'pulse 1s infinite' }}>
          {achievement.icon || '🏆'}
        </div>

        <h2 style={{
          fontSize: 'var(--font-size-xl)',
          color: '#B8860B',
          marginBottom: 'var(--spacing-xs)',
          fontFamily: 'var(--font-family-heading)'
        }}>
          Achievement Unlocked!
        </h2>

        <h3 style={{
          fontSize: 'var(--font-size-xxl)',
          color: 'var(--text-primary)',
          marginBottom: 'var(--spacing-sm)',
          fontWeight: 700
        }}>
          {achievement.title}
        </h3>

        <p style={{
          color: 'var(--text-secondary)',
          marginBottom: 'var(--spacing-lg)',
          fontSize: 'var(--font-size-base)'
        }}>
          {achievement.description}
        </p>

        {achievement.points && (
          <div style={{
            display: 'inline-block',
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
            borderRadius: 'var(--radius-full)',
            color: 'white',
            fontWeight: 700,
            marginBottom: 'var(--spacing-lg)',
            boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)'
          }}>
            +{achievement.points} points
          </div>
        )}

        <button
          onClick={handleDismiss}
          style={{
            display: 'block',
            width: '100%',
            padding: 'var(--spacing-md) var(--spacing-xl)',
            background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(155, 138, 165, 0.4)'
          }}
        >
          {currentIndex < achievements.length - 1 ? `Awesome! (${currentIndex + 1}/${achievements.length})` : 'Continue'}
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

/**
 * Toast notification for smaller achievements
 */
export const AchievementToast = ({ achievement, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!achievement) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--spacing-xl)',
        right: 'var(--spacing-xl)',
        background: 'linear-gradient(135deg, var(--surface), #FFF8E8)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        zIndex: 9998,
        animation: 'slideInRight 0.3s ease-out',
        border: '2px solid #FFD700',
        maxWidth: '350px'
      }}
      onClick={onClose}
    >
      <span style={{ fontSize: '2rem' }}>{achievement.icon || '🏆'}</span>
      <div>
        <div style={{ fontWeight: 600, color: '#B8860B', fontSize: 'var(--font-size-small)' }}>
          Achievement Unlocked!
        </div>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
          {achievement.title}
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 'var(--spacing-xs)',
          color: 'var(--text-secondary)'
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default AchievementNotification;

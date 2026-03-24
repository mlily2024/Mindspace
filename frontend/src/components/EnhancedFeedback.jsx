import React from 'react';

/**
 * EnhancedFeedback - Personalized post-check-in feedback display
 * Shows contextual message, comparison, suggestions, and micro-insights
 */
const EnhancedFeedback = ({ feedback, onSuggestionClick, onDismiss }) => {
  if (!feedback) return null;

  const { message, comparison, suggestions, microInsight, encouragement, shouldOfferIntervention, interventionType } = feedback;

  const containerStyle = {
    background: message?.color ? `linear-gradient(145deg, var(--surface), ${message.color}15)` : 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-xl)',
    boxShadow: 'var(--shadow-md)',
    animation: 'slideUp 0.3s ease'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--spacing-md)',
    marginBottom: 'var(--spacing-lg)'
  };

  const emojiStyle = {
    fontSize: '2.5rem',
    lineHeight: 1
  };

  const titleContainerStyle = {
    flex: 1
  };

  const titleStyle = {
    fontSize: 'var(--font-size-xl)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px'
  };

  const messageStyle = {
    fontSize: 'var(--font-size-base)',
    color: 'var(--text-secondary)',
    lineHeight: 1.5
  };

  return (
    <div style={containerStyle}>
      {/* Main Message */}
      {message && (
        <div style={headerStyle}>
          <span style={emojiStyle}>{message.emoji}</span>
          <div style={titleContainerStyle}>
            <h3 style={titleStyle}>{message.title}</h3>
            <p style={messageStyle}>{message.message}</p>
          </div>
        </div>
      )}

      {/* Comparison Section */}
      {comparison && comparison.hasData && (
        <div style={{
          display: 'flex',
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-lg)',
          padding: 'var(--spacing-md)',
          background: 'var(--background)',
          borderRadius: 'var(--radius-lg)'
        }}>
          {comparison.vsYesterday !== null && (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 700,
                color: comparison.vsYesterday > 0
                  ? 'var(--success-color)'
                  : comparison.vsYesterday < 0
                    ? 'var(--warning-color)'
                    : 'var(--text-secondary)'
              }}>
                {comparison.vsYesterday > 0 ? '+' : ''}{comparison.vsYesterday}
              </div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                vs Yesterday
              </div>
            </div>
          )}

          {comparison.vsAverage !== null && (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 700,
                color: comparison.vsAverage > 0
                  ? 'var(--success-color)'
                  : comparison.vsAverage < 0
                    ? 'var(--warning-color)'
                    : 'var(--text-secondary)'
              }}>
                {comparison.vsAverage > 0 ? '+' : ''}{comparison.vsAverage}
              </div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                vs 7-day avg
              </div>
            </div>
          )}

          {comparison.trend && comparison.trend !== 'stable' && (
            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 700
              }}>
                {comparison.trend === 'improving' ? '📈' : '📉'}
              </div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                {comparison.trend === 'improving' ? 'Improving' : 'Declining'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Micro-Insight */}
      {microInsight && (
        <div style={{
          padding: 'var(--spacing-md)',
          background: microInsight.type === 'improvement'
            ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05))'
            : microInsight.type === 'decline'
              ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(255, 152, 0, 0.05))'
              : 'var(--primary-light)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--spacing-lg)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--spacing-sm)'
        }}>
          <span style={{ fontSize: '1.5rem' }}>{microInsight.icon}</span>
          <div>
            <p style={{
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '4px'
            }}>
              {microInsight.text}
            </p>
            {microInsight.detail && (
              <p style={{
                fontSize: 'var(--font-size-small)',
                color: 'var(--text-secondary)'
              }}>
                {microInsight.detail}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <p style={{
            fontSize: 'var(--font-size-small)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-sm)'
          }}>
            Suggestions for you:
          </p>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--spacing-sm)'
          }}>
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onSuggestionClick && onSuggestionClick(suggestion)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-full)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-small)',
                  color: 'var(--text-primary)',
                  transition: 'all var(--transition-base)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'var(--primary-light)';
                  e.target.style.borderColor = 'var(--primary-color)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'var(--background)';
                  e.target.style.borderColor = 'var(--border)';
                }}
              >
                <span>{suggestion.icon}</span>
                <span>{suggestion.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Encouragement */}
      {encouragement && (
        <div style={{
          textAlign: 'center',
          padding: 'var(--spacing-md)',
          background: 'linear-gradient(135deg, var(--primary-light), rgba(255, 215, 0, 0.1))',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--spacing-md)'
        }}>
          <p style={{
            fontWeight: 600,
            color: 'var(--primary-color)',
            margin: 0
          }}>
            {encouragement}
          </p>
        </div>
      )}

      {/* Dismiss Button */}
      {onDismiss && (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onDismiss}
            style={{
              padding: 'var(--spacing-md) var(--spacing-xl)',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'var(--font-size-base)'
            }}
          >
            Continue
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

/**
 * FeedbackCard - Compact version of feedback for inline display
 */
export const FeedbackCard = ({ message, comparison }) => {
  if (!message) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--spacing-md)',
      padding: 'var(--spacing-md)',
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <span style={{ fontSize: '1.5rem' }}>{message.emoji}</span>
      <div style={{ flex: 1 }}>
        <p style={{
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: 0,
          marginBottom: '2px'
        }}>
          {message.title}
        </p>
        <p style={{
          fontSize: 'var(--font-size-small)',
          color: 'var(--text-secondary)',
          margin: 0
        }}>
          {message.message.substring(0, 80)}...
        </p>
      </div>
      {comparison && comparison.vsYesterday !== null && (
        <div style={{
          padding: 'var(--spacing-xs) var(--spacing-sm)',
          background: comparison.vsYesterday > 0 ? 'rgba(76, 175, 80, 0.1)' : comparison.vsYesterday < 0 ? 'rgba(255, 152, 0, 0.1)' : 'var(--background)',
          borderRadius: 'var(--radius-md)',
          color: comparison.vsYesterday > 0 ? 'var(--success-color)' : comparison.vsYesterday < 0 ? 'var(--warning-color)' : 'var(--text-secondary)',
          fontWeight: 600,
          fontSize: 'var(--font-size-small)'
        }}>
          {comparison.vsYesterday > 0 ? '+' : ''}{comparison.vsYesterday}
        </div>
      )}
    </div>
  );
};

export default EnhancedFeedback;

import React, { useState, useEffect } from 'react';
import { predictionsAPI } from '../services/api';

/**
 * MoodForecast - Weather-style mood prediction display
 * Shows predicted mood for the next 7 days with confidence indicators
 */
const MoodForecast = ({ onRefresh, compact = false }) => {
  const [forecast, setForecast] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);

  useEffect(() => {
    loadForecast();
  }, []);

  const loadForecast = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await predictionsAPI.getForecast(7);

      if (response.data.status === 'insufficient_data') {
        setError({
          type: 'insufficient_data',
          message: response.data.message,
          currentEntries: response.data.currentEntries,
          requiredEntries: response.data.requiredEntries
        });
        setForecast(null);
      } else {
        setForecast(response.data.predictions || response.data);
        setPatterns(response.data.patterns);
      }
    } catch (err) {
      setError({ type: 'error', message: 'Unable to load mood forecast' });
    } finally {
      setLoading(false);
    }
  };

  const getMoodEmoji = (mood) => {
    if (mood >= 8) return '☀️';
    if (mood >= 6) return '🌤️';
    if (mood >= 4) return '⛅';
    if (mood >= 3) return '🌥️';
    return '🌧️';
  };

  const getMoodLabel = (mood) => {
    if (mood >= 8) return 'Great';
    if (mood >= 6) return 'Good';
    if (mood >= 4) return 'Okay';
    if (mood >= 3) return 'Low';
    return 'Difficult';
  };

  const getMoodColor = (mood) => {
    if (mood >= 8) return '#4CAF50';
    if (mood >= 6) return '#8BC34A';
    if (mood >= 4) return '#FFC107';
    if (mood >= 3) return '#FF9800';
    return '#F44336';
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 0.75) return 'High';
    if (confidence >= 0.5) return 'Moderate';
    return 'Low';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const containerStyle = {
    background: 'linear-gradient(145deg, var(--surface) 0%, #E8F5F7 100%)',
    borderRadius: 'var(--radius-xl)',
    padding: compact ? 'var(--spacing-md)' : 'var(--spacing-xl)',
    boxShadow: 'var(--shadow-sm)'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--spacing-lg)'
  };

  const titleStyle = {
    fontSize: compact ? 'var(--font-size-lg)' : 'var(--font-size-xl)',
    fontWeight: 600,
    fontFamily: 'var(--font-family-heading)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    color: 'var(--text-primary)'
  };

  const refreshButtonStyle = {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    background: 'var(--primary-light)',
    color: 'var(--primary-color)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-small)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all var(--transition-base)'
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>🔮</div>
          <p>Analyzing your patterns...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>
            <span>🔮</span> Mood Forecast
          </h3>
        </div>

        {error.type === 'insufficient_data' ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--spacing-lg)',
            background: 'var(--background)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-sm)' }}>📊</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
              {error.message}
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)',
              marginTop: 'var(--spacing-md)'
            }}>
              <div style={{
                height: '8px',
                width: '100px',
                background: 'var(--border)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(error.currentEntries / error.requiredEntries) * 100}%`,
                  background: 'var(--primary-color)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                {error.currentEntries}/{error.requiredEntries}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--error-color)' }}>
            <p>{error.message}</p>
            <button onClick={loadForecast} style={refreshButtonStyle}>
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  if (!forecast || forecast.length === 0) {
    return null;
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>
          <span>🔮</span> Mood Forecast
        </h3>
        <button onClick={loadForecast} style={refreshButtonStyle}>
          <span>↻</span> Refresh
        </button>
      </div>

      {/* Forecast Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: compact ? 'repeat(4, 1fr)' : 'repeat(7, 1fr)',
        gap: 'var(--spacing-sm)'
      }}>
        {forecast.slice(0, compact ? 4 : 7).map((day, index) => (
          <div
            key={day.predictedDate || index}
            onClick={() => setExpandedDay(expandedDay === index ? null : index)}
            style={{
              background: index === 0 ? 'var(--primary-light)' : 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-md)',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all var(--transition-base)',
              border: index === 0 ? '2px solid var(--primary-color)' : '1px solid var(--border)',
              transform: expandedDay === index ? 'scale(1.05)' : 'scale(1)'
            }}
          >
            <div style={{
              fontSize: 'var(--font-size-small)',
              color: 'var(--text-secondary)',
              marginBottom: '4px'
            }}>
              {formatDate(day.predictedDate)}
            </div>

            <div style={{ fontSize: compact ? '1.5rem' : '2rem', margin: '4px 0' }}>
              {getMoodEmoji(day.predictedMood)}
            </div>

            <div style={{
              fontSize: compact ? 'var(--font-size-base)' : 'var(--font-size-lg)',
              fontWeight: 700,
              color: getMoodColor(day.predictedMood)
            }}>
              {day.predictedMood?.toFixed(1) || '?'}
            </div>

            <div style={{
              fontSize: '0.7rem',
              color: 'var(--text-secondary)',
              marginTop: '2px'
            }}>
              {getMoodLabel(day.predictedMood)}
            </div>

            {/* Confidence indicator */}
            <div style={{
              marginTop: 'var(--spacing-xs)',
              display: 'flex',
              justifyContent: 'center',
              gap: '2px'
            }}>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '8px',
                    height: '4px',
                    borderRadius: '2px',
                    background: i < Math.round((day.confidence || 0.5) * 3)
                      ? 'var(--primary-color)'
                      : 'var(--border)'
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Day Details */}
      {expandedDay !== null && forecast[expandedDay] && (
        <div style={{
          marginTop: 'var(--spacing-md)',
          padding: 'var(--spacing-md)',
          background: 'var(--background)',
          borderRadius: 'var(--radius-lg)',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 'var(--spacing-sm)'
          }}>
            <div>
              <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>
                {formatDate(forecast[expandedDay].predictedDate)}
              </h4>
              <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                Confidence: {getConfidenceLabel(forecast[expandedDay].confidence)}
              </p>
            </div>
            <div style={{
              fontSize: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-xs)'
            }}>
              {getMoodEmoji(forecast[expandedDay].predictedMood)}
              <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: getMoodColor(forecast[expandedDay].predictedMood) }}>
                {forecast[expandedDay].predictedMood?.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Factors */}
          {forecast[expandedDay].factorsConsidered && (
            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Based on:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Object.entries(forecast[expandedDay].factorsConsidered).map(([key, value]) => (
                  <span
                    key={key}
                    style={{
                      padding: '2px 8px',
                      background: 'var(--surface)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.7rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {key.replace(/_/g, ' ')}: {typeof value === 'number' ? value.toFixed(1) : value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preventive Actions */}
          {forecast[expandedDay].preventiveActions && forecast[expandedDay].preventiveActions.length > 0 && (
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Suggestions:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {forecast[expandedDay].preventiveActions.slice(0, 3).map((action, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 'var(--spacing-sm)',
                      background: 'var(--primary-light)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-small)',
                      color: 'var(--primary-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-xs)'
                    }}
                  >
                    <span>{action.icon || '💡'}</span>
                    {action.text || action}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Patterns Summary */}
      {patterns && !compact && (
        <div style={{
          marginTop: 'var(--spacing-lg)',
          paddingTop: 'var(--spacing-md)',
          borderTop: '1px solid var(--border)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            textAlign: 'center'
          }}>
            {patterns.bestDay && (
              <div>
                <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>Best Day</div>
                <div style={{ fontWeight: 600, color: 'var(--success-color)' }}>{patterns.bestDay}</div>
              </div>
            )}
            {patterns.worstDay && (
              <div>
                <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>Challenging Day</div>
                <div style={{ fontWeight: 600, color: 'var(--warning-color)' }}>{patterns.worstDay}</div>
              </div>
            )}
            {patterns.avgMood && (
              <div>
                <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>Average Mood</div>
                <div style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{patterns.avgMood.toFixed(1)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MoodForecast;

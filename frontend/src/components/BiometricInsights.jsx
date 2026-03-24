import React, { useState } from 'react';

/**
 * BiometricInsightCard - Individual insight display
 */
const BiometricInsightCard = ({ insight, onMarkRead }) => {
  const [expanded, setExpanded] = useState(false);

  const priorityColors = {
    1: { border: 'var(--border)', bg: 'var(--surface)' },
    2: { border: '#F59E0B40', bg: 'rgba(245, 158, 11, 0.05)' },
    3: { border: '#8B5CF640', bg: 'rgba(139, 92, 246, 0.05)' }
  };

  const insightTypeIcons = {
    correlation_discovery: '',
    pattern_detected: '',
    threshold_alert: '',
    improvement_opportunity: '',
    sleep_impact: '',
    activity_impact: '',
    hrv_insight: ''
  };

  const colors = priorityColors[insight.priority] || priorityColors[1];
  const icon = insightTypeIcons[insight.insight_type] || '';

  const cardStyle = {
    background: colors.bg,
    borderRadius: 'var(--radius-lg)',
    border: `1px solid ${colors.border}`,
    padding: 'var(--spacing-md)',
    marginBottom: 'var(--spacing-sm)',
    cursor: 'pointer',
    transition: 'all var(--transition-base)',
    position: 'relative'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--spacing-sm)'
  };

  const iconStyle = {
    fontSize: '1.3rem',
    flexShrink: 0
  };

  const contentStyle = {
    flex: 1
  };

  const titleStyle = {
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)'
  };

  const descriptionStyle = {
    fontSize: 'var(--font-size-small)',
    color: 'var(--text-secondary)',
    lineHeight: 1.5
  };

  const expandedContentStyle = {
    marginTop: 'var(--spacing-md)',
    paddingTop: 'var(--spacing-md)',
    borderTop: '1px solid var(--border)'
  };

  const recommendationsStyle = {
    marginTop: 'var(--spacing-sm)'
  };

  const recommendationItemStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--spacing-xs)',
    fontSize: 'var(--font-size-small)',
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-xs)',
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    background: 'var(--background)',
    borderRadius: 'var(--radius-sm)'
  };

  const confidenceBarStyle = {
    height: '4px',
    background: 'var(--background)',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
    marginTop: 'var(--spacing-sm)'
  };

  const confidenceFillStyle = {
    height: '100%',
    width: `${(insight.confidence_score || 0.5) * 100}%`,
    background: 'linear-gradient(90deg, var(--primary-color), var(--success-color))',
    borderRadius: 'var(--radius-full)',
    transition: 'width 0.5s ease'
  };

  const unreadDotStyle = {
    position: 'absolute',
    top: 'var(--spacing-sm)',
    right: 'var(--spacing-sm)',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--primary-color)'
  };

  const handleClick = () => {
    setExpanded(!expanded);
    if (!insight.is_read && onMarkRead) {
      onMarkRead(insight.insight_id);
    }
  };

  const recommendations = insight.recommendations || [];

  return (
    <div style={cardStyle} onClick={handleClick}>
      {!insight.is_read && <div style={unreadDotStyle} />}

      <div style={headerStyle}>
        <span style={iconStyle}>{icon}</span>
        <div style={contentStyle}>
          <div style={titleStyle}>
            {insight.title}
            {insight.priority === 3 && (
              <span style={{
                fontSize: '0.65rem',
                background: 'var(--primary-light)',
                color: 'var(--primary-color)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                fontWeight: 500
              }}>
                Important
              </span>
            )}
          </div>
          <div style={descriptionStyle}>{insight.description}</div>

          {insight.confidence_score && (
            <div style={confidenceBarStyle}>
              <div style={confidenceFillStyle} />
            </div>
          )}

          {expanded && recommendations.length > 0 && (
            <div style={expandedContentStyle}>
              <div style={{
                fontSize: 'var(--font-size-small)',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 'var(--spacing-xs)'
              }}>
                Recommendations
              </div>
              <div style={recommendationsStyle}>
                {recommendations.map((rec, index) => (
                  <div key={index} style={recommendationItemStyle}>
                    <span style={{ color: rec.priority === 'high' ? 'var(--primary-color)' : 'var(--text-secondary)' }}>
                      {rec.priority === 'high' ? '' : ''}
                    </span>
                    {rec.action}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * BiometricInsights - Display list of biometric insights
 */
const BiometricInsights = ({ insights, loading, onMarkRead, onRefresh }) => {
  const containerStyle = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-xl)',
    boxShadow: 'var(--shadow-sm)'
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--spacing-lg)'
  };

  const titleStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    fontFamily: 'var(--font-family-heading)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)'
  };

  const refreshButtonStyle = {
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    background: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-small)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)'
  };

  const emptyStyle = {
    textAlign: 'center',
    padding: 'var(--spacing-xl)',
    color: 'var(--text-secondary)'
  };

  const emptyIconStyle = {
    fontSize: '2.5rem',
    marginBottom: 'var(--spacing-md)',
    opacity: 0.5
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>
            <span>Insights</span>
          </h3>
        </div>
        <div style={emptyStyle}>
          Analyzing your data...
        </div>
      </div>
    );
  }

  const unreadCount = insights?.filter(i => !i.is_read).length || 0;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>
          <span>Insights</span>
          {unreadCount > 0 && (
            <span style={{
              fontSize: '0.7rem',
              background: 'var(--primary-color)',
              color: 'white',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 500
            }}>
              {unreadCount} new
            </span>
          )}
        </h3>
        {onRefresh && (
          <button style={refreshButtonStyle} onClick={onRefresh}>
            Refresh
          </button>
        )}
      </div>

      {!insights || insights.length === 0 ? (
        <div style={emptyStyle}>
          <div style={emptyIconStyle}></div>
          <p style={{ marginBottom: 'var(--spacing-sm)', fontWeight: 500 }}>No insights yet</p>
          <p style={{ fontSize: 'var(--font-size-small)' }}>
            Keep tracking your mood and syncing your wearable data.
            We'll discover patterns and correlations for you.
          </p>
        </div>
      ) : (
        <div>
          {insights.map((insight) => (
            <BiometricInsightCard
              key={insight.insight_id}
              insight={insight}
              onMarkRead={onMarkRead}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * CorrelationDisplay - Shows biometric-mood correlations
 */
export const CorrelationDisplay = ({ correlations, loading }) => {
  const containerStyle = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-xl)',
    boxShadow: 'var(--shadow-sm)'
  };

  const headerStyle = {
    marginBottom: 'var(--spacing-lg)'
  };

  const titleStyle = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 600,
    fontFamily: 'var(--font-family-heading)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    marginBottom: 'var(--spacing-xs)'
  };

  const subtitleStyle = {
    fontSize: 'var(--font-size-small)',
    color: 'var(--text-secondary)'
  };

  const correlationListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)'
  };

  const getCorrelationColor = (coefficient) => {
    const absCoef = Math.abs(coefficient);
    if (absCoef >= 0.5) return 'var(--success-color)';
    if (absCoef >= 0.3) return 'var(--warning-color)';
    return 'var(--text-secondary)';
  };

  const getStrengthLabel = (strength) => {
    const labels = {
      very_strong: 'Very Strong',
      strong: 'Strong',
      moderate: 'Moderate',
      weak: 'Weak',
      none: 'No correlation'
    };
    return labels[strength] || strength;
  };

  const formatMetricName = (name) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h3 style={titleStyle}>
            <span>Biometric Correlations</span>
          </h3>
        </div>
        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-secondary)' }}>
          Calculating correlations...
        </div>
      </div>
    );
  }

  const strongCorrelations = correlations?.strongestCorrelations || [];

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>
          <span>Biometric-Mood Correlations</span>
        </h3>
        <p style={subtitleStyle}>
          How your biometrics relate to your mood
        </p>
      </div>

      {strongCorrelations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-lg)', color: 'var(--text-secondary)' }}>
          <p>Not enough data to calculate correlations yet.</p>
          <p style={{ fontSize: 'var(--font-size-small)', marginTop: 'var(--spacing-xs)' }}>
            Log at least 7 days of mood entries with biometric data.
          </p>
        </div>
      ) : (
        <div style={correlationListStyle}>
          {strongCorrelations.map((corr, index) => {
            const coefficient = corr.coefficient;
            const color = getCorrelationColor(coefficient);
            const direction = coefficient > 0 ? '' : '';
            const barWidth = Math.abs(coefficient) * 100;

            return (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
                padding: 'var(--spacing-sm)',
                background: 'var(--background)',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 'var(--font-size-small)',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    marginBottom: '2px'
                  }}>
                    {formatMetricName(corr.biometricType)} {direction} {formatMetricName(corr.moodMetric)}
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)'
                  }}>
                    {getStrengthLabel(corr.strength)} {corr.direction} correlation
                  </div>
                </div>
                <div style={{ width: '80px' }}>
                  <div style={{
                    height: '6px',
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${barWidth}%`,
                      background: color,
                      borderRadius: 'var(--radius-full)',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                </div>
                <div style={{
                  fontSize: 'var(--font-size-small)',
                  fontWeight: 600,
                  color,
                  minWidth: '45px',
                  textAlign: 'right'
                }}>
                  {coefficient > 0 ? '+' : ''}{coefficient.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {correlations?.totalCorrelations > 0 && (
        <div style={{
          marginTop: 'var(--spacing-md)',
          padding: 'var(--spacing-sm)',
          background: 'var(--background)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-small)',
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}>
          {correlations.significantCount} significant correlations found out of {correlations.totalCorrelations} analyzed
        </div>
      )}
    </div>
  );
};

/**
 * BiometricTrendChart - Simple trend visualization
 */
export const BiometricTrendChart = ({ data, dataType, title }) => {
  const containerStyle = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-lg)',
    boxShadow: 'var(--shadow-sm)'
  };

  const headerStyle = {
    marginBottom: 'var(--spacing-md)'
  };

  const titleStyle = {
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--text-primary)'
  };

  const chartStyle = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '4px',
    height: '60px',
    padding: 'var(--spacing-sm) 0'
  };

  if (!data || data.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h4 style={titleStyle}>{title}</h4>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>
          No data available
        </div>
      </div>
    );
  }

  // Get last 7 days of data
  const recentData = data.slice(-7);
  const values = recentData.map(d => parseFloat(d.value_numeric) || 0);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h4 style={titleStyle}>{title}</h4>
      </div>

      <div style={chartStyle}>
        {values.map((value, index) => {
          const height = ((value - minValue) / range) * 100;
          const isLatest = index === values.length - 1;

          return (
            <div
              key={index}
              style={{
                flex: 1,
                height: `${Math.max(10, height)}%`,
                background: isLatest
                  ? 'linear-gradient(180deg, var(--primary-color), var(--primary-light))'
                  : 'var(--primary-light)',
                borderRadius: 'var(--radius-sm)',
                transition: 'height 0.3s ease'
              }}
              title={`${value.toFixed(1)}`}
            />
          );
        })}
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.65rem',
        color: 'var(--text-secondary)',
        marginTop: 'var(--spacing-xs)'
      }}>
        <span>7 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
};

export default BiometricInsights;

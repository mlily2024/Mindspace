import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import MoodCalendar from '../components/MoodCalendar';
import { insightsAPI } from '../services/api';

/**
 * Insights - Enhanced analytics dashboard with pattern recognition
 * Shows mood patterns, correlations, trends, and personalized recommendations
 */
const Insights = () => {
  const navigate = useNavigate();
  const [patternData, setPatternData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadAllData();
  }, [timeRange]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [patternsRes, insightsRes, alertsRes] = await Promise.all([
        insightsAPI.getPatterns(timeRange),
        insightsAPI.getAll({ limit: 10 }),
        insightsAPI.getSafetyAlerts({ limit: 5 })
      ]);

      setPatternData(patternsRes.data);
      setInsights(insightsRes.data.insights || []);
      setSafetyAlerts(alertsRes.data.alerts || []);
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInsights = async () => {
    setGenerating(true);
    try {
      await insightsAPI.generate();
      await loadAllData();
    } catch (error) {
      console.error('Failed to generate insights:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId) => {
    try {
      await insightsAPI.acknowledgeSafetyAlert(alertId, { actionTaken: 'Acknowledged by user' });
      await loadAllData();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleRecommendationAction = (action) => {
    switch (action) {
      case 'open_chat':
        // The chatbot widget will handle this
        document.querySelector('.chat-toggle')?.click();
        break;
      case 'breathing':
        navigate('/recommendations');
        break;
      case 'grounding':
        navigate('/recommendations');
        break;
      case 'open_journal':
        navigate('/journal');
        break;
      default:
        break;
    }
  };

  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, var(--background) 0%, var(--primary-light) 100%)'
  };

  const containerStyle = {
    maxWidth: '900px',
    margin: '0 auto',
    padding: 'var(--spacing-xl)'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--spacing-xl)',
    flexWrap: 'wrap',
    gap: 'var(--spacing-md)'
  };

  const timeRangeBtnStyle = (active) => ({
    padding: 'var(--spacing-xs) var(--spacing-md)',
    borderRadius: 'var(--radius-full)',
    border: active ? '2px solid var(--primary-color)' : '2px solid var(--border)',
    background: active ? 'var(--primary-light)' : 'transparent',
    color: active ? 'var(--primary-color)' : 'var(--text-secondary)',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    fontSize: 'var(--font-size-small)'
  });

  const cardStyle = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-lg)',
    boxShadow: 'var(--shadow-md)',
    marginBottom: 'var(--spacing-lg)'
  };

  const statCardStyle = {
    ...cardStyle,
    textAlign: 'center',
    padding: 'var(--spacing-xl)'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 'var(--spacing-md)',
    marginBottom: 'var(--spacing-lg)'
  };

  // Helper to get time emoji
  const getTimeEmoji = (time) => {
    switch (time) {
      case 'morning': return '🌅';
      case 'afternoon': return '☀️';
      case 'evening': return '🌆';
      case 'night': return '🌙';
      default: return '⏰';
    }
  };

  // Helper to get trend emoji and color
  const getTrendDisplay = (direction) => {
    switch (direction) {
      case 'improving': return { emoji: '📈', color: '#A8C5A8', text: 'Improving' };
      case 'declining': return { emoji: '📉', color: '#E8A5A5', text: 'Needs attention' };
      default: return { emoji: '➡️', color: '#9B8AA5', text: 'Stable' };
    }
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <Navigation />
        <main style={containerStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'var(--spacing-xxl)' }}>
            <div className="spinner" aria-label="Loading insights"></div>
            <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--spacing-md)' }}>
              Analysing your patterns...
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Insufficient data state
  if (patternData?.status === 'insufficient_data') {
    return (
      <div style={pageStyle}>
        <Navigation />
        <main id="main-content" style={containerStyle}>
          <div style={{ ...cardStyle, textAlign: 'center', padding: 'var(--spacing-xxl)' }} className="animate-fade-in">
            <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>
              📊
            </div>
            <h1 style={{ fontSize: 'var(--font-size-xxl)', marginBottom: 'var(--spacing-sm)' }}>
              Insights Coming Soon
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)', maxWidth: '400px', margin: '0 auto var(--spacing-xl)' }}>
              {patternData.message}
            </p>

            {/* Progress bar */}
            <div style={{
              background: 'var(--border)',
              borderRadius: 'var(--radius-full)',
              height: '12px',
              maxWidth: '300px',
              margin: '0 auto var(--spacing-md)',
              overflow: 'hidden'
            }}>
              <div style={{
                background: 'linear-gradient(90deg, var(--primary-color), var(--accent-color))',
                height: '100%',
                width: `${((7 - (patternData.entriesNeeded || 0)) / 7) * 100}%`,
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.5s ease'
              }} />
            </div>
            <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
              {patternData.entriesNeeded} more {patternData.entriesNeeded === 1 ? 'day' : 'days'} of logging to unlock
            </p>

            <button
              onClick={() => navigate('/mood-tracker')}
              style={{
                marginTop: 'var(--spacing-xl)',
                padding: 'var(--spacing-md) var(--spacing-xl)',
                background: 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                color: 'white',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Log Today's Mood
            </button>
          </div>
        </main>
      </div>
    );
  }

  const { patterns, correlations, trends, recommendations } = patternData || {};
  const trendDisplay = getTrendDisplay(trends?.trendDirection);

  return (
    <div style={pageStyle}>
      <Navigation />
      <main id="main-content" style={containerStyle}>
        {/* Header */}
        <div style={headerStyle} className="animate-fade-in">
          <div>
            <h1 style={{
              fontSize: 'var(--font-size-xxl)',
              fontFamily: 'var(--font-family-heading)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              <span role="img" aria-hidden="true">🔍</span> Your Insights
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Patterns and trends from your mood tracking
            </p>
          </div>

          {/* Time range selector */}
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
            {[7, 14, 30].map(days => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                style={timeRangeBtnStyle(timeRange === days)}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        {/* Safety Alerts */}
        {safetyAlerts.length > 0 && (
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            {safetyAlerts.map((alert) => {
              const data = JSON.parse(alert.alert_data);
              return (
                <div
                  key={alert.alert_id}
                  style={{
                    ...cardStyle,
                    borderLeft: `4px solid ${alert.severity === 'critical' ? '#E8A5A5' : '#F5D89A'}`,
                    marginBottom: 'var(--spacing-md)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 'var(--spacing-md)' }}>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                        {alert.severity === 'critical' ? '🚨' : '⚠️'} {alert.severity.toUpperCase()}
                      </span>
                      <h3 style={{ margin: 'var(--spacing-xs) 0' }}>{alert.alert_type.replace('_', ' ')}</h3>
                      <p style={{ color: 'var(--text-secondary)' }}>{data.message}</p>
                    </div>
                    {!alert.is_acknowledged && (
                      <button
                        onClick={() => handleAcknowledgeAlert(alert.alert_id)}
                        style={{
                          padding: 'var(--spacing-xs) var(--spacing-md)',
                          background: 'var(--border)',
                          border: 'none',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer'
                        }}
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Trend Overview Card */}
        {trends && (
          <div style={{
            ...cardStyle,
            background: `linear-gradient(135deg, ${trendDisplay.color}15, ${trendDisplay.color}05)`,
            border: `2px solid ${trendDisplay.color}30`
          }} className="animate-fade-in-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                <span style={{ fontSize: '2.5rem' }}>{trendDisplay.emoji}</span>
                <div>
                  <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-xs)' }}>
                    {trendDisplay.text}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {trends.change > 0 ? '+' : ''}{trends.change} from previous period
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--font-size-xxl)', fontWeight: 700, color: trendDisplay.color }}>
                  {trends.recentAverage.toFixed(1)}
                </div>
                <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                  avg mood (last 7 days)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pattern Cards */}
        {patterns && (
          <div style={gridStyle} className="animate-fade-in-up">
            {/* Best Day */}
            {patterns.bestDay && (
              <div style={statCardStyle}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--spacing-sm)' }}>🌟</span>
                <h3 style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  Your Best Day
                </h3>
                <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--primary-color)' }}>
                  {patterns.bestDay.day}
                </p>
                <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                  avg {patterns.bestDay.average.toFixed(1)}/10
                </p>
              </div>
            )}

            {/* Best Time */}
            {patterns.bestTime && (
              <div style={statCardStyle}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--spacing-sm)' }}>
                  {getTimeEmoji(patterns.bestTime.time)}
                </span>
                <h3 style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  Peak Time
                </h3>
                <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--primary-color)', textTransform: 'capitalize' }}>
                  {patterns.bestTime.time}
                </p>
                <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                  when you feel best
                </p>
              </div>
            )}

            {/* Total Entries */}
            <div style={statCardStyle}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--spacing-sm)' }}>📝</span>
              <h3 style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                Check-ins
              </h3>
              <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--primary-color)' }}>
                {patterns.totalEntries}
              </p>
              <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                in the last {timeRange} days
              </p>
            </div>

            {/* Challenging Day */}
            {patterns.challengingDay && patterns.bestDay?.day !== patterns.challengingDay?.day && (
              <div style={statCardStyle}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: 'var(--spacing-sm)' }}>💪</span>
                <h3 style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                  Growth Opportunity
                </h3>
                <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--secondary-color)' }}>
                  {patterns.challengingDay.day}
                </p>
                <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                  needs more care
                </p>
              </div>
            )}
          </div>
        )}

        {/* Correlations */}
        {correlations && correlations.length > 0 && (
          <div style={cardStyle} className="animate-fade-in-up">
            <h3 style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span>🔗</span> What Affects Your Mood
            </h3>
            <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
              {correlations.map((corr, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-md)',
                    padding: 'var(--spacing-md)',
                    background: 'var(--background)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{corr.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                      <strong>{corr.factor}</strong>
                      <span style={{
                        fontSize: 'var(--font-size-small)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: corr.correlation > 0 ? '#A8C5A820' : '#E8A5A520',
                        color: corr.correlation > 0 ? '#5A7D5A' : '#8B5A5A'
                      }}>
                        {corr.correlation > 0 ? '↑' : '↓'} {corr.strength}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>
                      {corr.insight}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div style={{
            ...cardStyle,
            background: 'linear-gradient(135deg, var(--secondary-light) 0%, var(--surface) 100%)'
          }} className="animate-fade-in-up">
            <h3 style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span>💡</span> Suggestions for You
            </h3>
            <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'start',
                    gap: 'var(--spacing-md)',
                    padding: 'var(--spacing-md)',
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{rec.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ marginBottom: 'var(--spacing-xs)' }}>{rec.title}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)', marginBottom: 'var(--spacing-sm)' }}>
                      {rec.message}
                    </p>
                    {rec.actions && rec.actions.length > 0 && (
                      <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                        {rec.actions.map((action, j) => (
                          <button
                            key={j}
                            onClick={() => handleRecommendationAction(action)}
                            style={{
                              padding: 'var(--spacing-xs) var(--spacing-sm)',
                              background: 'var(--primary-light)',
                              border: 'none',
                              borderRadius: 'var(--radius-md)',
                              color: 'var(--primary-color)',
                              fontSize: 'var(--font-size-small)',
                              fontWeight: 500,
                              cursor: 'pointer'
                            }}
                          >
                            {action === 'open_chat' ? 'Chat with Luna' :
                             action === 'breathing' ? 'Try Breathing' :
                             action === 'grounding' ? 'Grounding Exercise' :
                             action === 'open_journal' ? 'Open Journal' :
                             action}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mood Trend Chart (Simple) */}
        {trends && trends.scores && trends.scores.length > 5 && (
          <div style={cardStyle} className="animate-fade-in-up">
            <h3 style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span>📈</span> Mood Over Time
            </h3>
            <div style={{
              display: 'flex',
              alignItems: 'end',
              height: '150px',
              gap: '4px',
              padding: 'var(--spacing-md) 0'
            }}>
              {trends.scores.slice(-14).map((score, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '30px',
                      height: `${(score / 10) * 120}px`,
                      background: `linear-gradient(180deg,
                        ${score >= 7 ? '#A8C5A8' : score >= 5 ? '#F5D89A' : score >= 3 ? '#F5C9B3' : '#E8A5A5'} 0%,
                        ${score >= 7 ? '#A8C5A880' : score >= 5 ? '#F5D89A80' : score >= 3 ? '#F5C9B380' : '#E8A5A580'} 100%)`,
                      borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                      transition: 'height 0.3s ease'
                    }}
                    title={`${trends.dates.slice(-14)[i]}: ${score}/10`}
                  />
                  <span style={{
                    fontSize: '0.6rem',
                    color: 'var(--text-secondary)',
                    writingMode: 'vertical-lr',
                    textOrientation: 'mixed',
                    transform: 'rotate(180deg)',
                    height: '30px',
                    overflow: 'hidden'
                  }}>
                    {trends.dates.slice(-14)[i]?.split(' ')[1] || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mood Calendar */}
        <div style={cardStyle} className="animate-fade-in-up">
          <h3 style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span>📅</span> Mood Calendar
          </h3>
          <MoodCalendar />
        </div>

        {/* Generated Insights */}
        {insights.length > 0 && (
          <div style={cardStyle} className="animate-fade-in-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-lg)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span>🎯</span> AI Insights
              </h3>
              <button
                onClick={handleGenerateInsights}
                disabled={generating}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  background: 'var(--primary-light)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--primary-color)',
                  fontWeight: 500,
                  cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.7 : 1
                }}
              >
                {generating ? 'Generating...' : 'Refresh'}
              </button>
            </div>
            <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
              {insights.slice(0, 5).map((insight) => {
                const data = JSON.parse(insight.insight_data);
                const borderColor = insight.insight_type === 'improvement' ? '#A8C5A8' :
                                   insight.insight_type === 'trend' ? '#9B8AA5' : '#F5D89A';
                return (
                  <div
                    key={insight.insight_id}
                    style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--background)',
                      borderRadius: 'var(--radius-lg)',
                      borderLeft: `4px solid ${borderColor}`
                    }}
                  >
                    <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xs)' }}>
                      {new Date(insight.generated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {' • '}
                      {insight.insight_type === 'improvement' ? '📈' : insight.insight_type === 'trend' ? '📊' : '⚠️'}
                      {' '}
                      {insight.insight_type}
                    </div>
                    <h4 style={{ marginBottom: 'var(--spacing-xs)' }}>{data.title}</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>
                      {data.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Insights;

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import StreakDisplay, { AchievementsGrid } from '../components/StreakDisplay';
import MoodForecast from '../components/MoodForecast';
import { useAuth } from '../context/AuthContext';
import { moodAPI, insightsAPI, recommendationsAPI, gamificationAPI } from '../services/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState(null);
  const [recentInsights, setRecentInsights] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [streakData, setStreakData] = useState({ currentStreak: 0, longestStreak: 0, totalCheckIns: 0 });
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, insightsRes, recsRes, alertsRes, gamificationRes] = await Promise.all([
        moodAPI.getStatistics({ period: 30 }),
        insightsAPI.getAll({ limit: 3 }),
        recommendationsAPI.getAll({ limit: 3 }),
        insightsAPI.getSafetyAlerts({ limit: 3, unacknowledgedOnly: true }),
        gamificationAPI.getStats().catch(() => null) // Graceful fallback
      ]);

      setStatistics(statsRes.data.statistics);
      setRecentInsights(insightsRes.data.insights || []);
      setRecommendations(recsRes.data.recommendations || []);
      setSafetyAlerts(alertsRes.data.alerts || []);

      // Use real gamification data from API
      if (gamificationRes?.data) {
        const { streak, achievements: allAchievements } = gamificationRes.data;
        setStreakData({
          currentStreak: streak?.current_streak || 0,
          longestStreak: streak?.longest_streak || 0,
          totalCheckIns: streak?.total_check_ins || 0
        });

        // Filter to only earned achievements for display
        const earnedAchievements = (allAchievements || [])
          .filter(a => a.is_earned)
          .map(a => ({
            code: a.achievement_code,
            earned_at: a.earned_at,
            icon: a.icon,
            title: a.title,
            description: a.description
          }));
        setAchievements(earnedAchievements);
      } else {
        // Fallback to statistics-based calculation
        const totalEntries = statsRes.data.statistics?.total_entries || 0;
        setStreakData({
          currentStreak: 0,
          longestStreak: 0,
          totalCheckIns: totalEntries
        });
        setAchievements([]);
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', emoji: '🌅' };
    if (hour < 17) return { text: 'Good afternoon', emoji: '☀️' };
    if (hour < 21) return { text: 'Good evening', emoji: '🌆' };
    return { text: 'Good night', emoji: '🌙' };
  };

  const getMoodEmoji = (score) => {
    if (!score) return '🌱';
    if (score >= 8) return '😊';
    if (score >= 6) return '🙂';
    if (score >= 4) return '😐';
    if (score >= 2) return '😔';
    return '😢';
  };

  const { text: greetingText, emoji: greetingEmoji } = getTimeGreeting();

  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, var(--background) 0%, var(--primary-light) 100%)'
  };

  const welcomeCardStyle = {
    background: 'linear-gradient(135deg, var(--primary-color), #8A7A94)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-xl)',
    color: 'white',
    marginBottom: 'var(--spacing-xl)',
    boxShadow: '0 8px 30px rgba(155, 138, 165, 0.3)'
  };

  const quickActionStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
    padding: 'var(--spacing-md)',
    background: 'rgba(255,255,255,0.15)',
    borderRadius: 'var(--radius-lg)',
    textDecoration: 'none',
    color: 'white',
    transition: 'all var(--transition-fast)',
    minWidth: '100px'
  };

  return (
    <div style={pageStyle}>
      <Navigation />
      <main id="main-content" className="container" style={{ paddingTop: 'var(--spacing-xl)', paddingBottom: 'var(--spacing-xxl)' }}>

        {/* Safety Alert (if any) */}
        {safetyAlerts.length > 0 && (
          <div
            role="alert"
            style={{
              background: 'linear-gradient(135deg, #FDE8E8, #FCDCDC)',
              borderLeft: '4px solid var(--danger-color)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-lg)',
              marginBottom: 'var(--spacing-xl)'
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-large)', marginBottom: 'var(--spacing-sm)', color: '#6B2D2D' }}>
              <span role="img" aria-hidden="true">💚</span> We're here for you
            </h2>
            <p style={{ color: '#6B2D2D', marginBottom: 'var(--spacing-md)' }}>
              We've noticed you might be going through a difficult time. Remember, it's okay to seek support.
            </p>
            <Link
              to="/crisis-resources"
              style={{
                display: 'inline-block',
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                background: 'var(--danger-color)',
                color: 'white',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                fontWeight: 600
              }}
            >
              View Support Resources
            </Link>
          </div>
        )}

        {/* Welcome Card */}
        <div style={welcomeCardStyle} className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--spacing-lg)' }}>
            <div>
              <h1 style={{ fontSize: 'var(--font-size-xxl)', fontWeight: 700, marginBottom: 'var(--spacing-xs)' }}>
                <span role="img" aria-hidden="true">{greetingEmoji}</span> {greetingText}, {user?.username || 'friend'}
              </h1>
              <p style={{ opacity: 0.9, fontSize: 'var(--font-size-large)' }}>
                How are you feeling today?
              </p>
            </div>
            <StreakDisplay compact currentStreak={streakData.currentStreak} />
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-xl)', flexWrap: 'wrap' }}>
            <Link to="/mood-tracker" style={quickActionStyle}>
              <span style={{ fontSize: '1.5rem' }}>✨</span>
              <span style={{ fontWeight: 600 }}>Check In</span>
            </Link>
            <Link to="/insights" style={quickActionStyle}>
              <span style={{ fontSize: '1.5rem' }}>🌟</span>
              <span style={{ fontWeight: 600 }}>Insights</span>
            </Link>
            <Link to="/recommendations" style={quickActionStyle}>
              <span style={{ fontSize: '1.5rem' }}>💜</span>
              <span style={{ fontWeight: 600 }}>Self-Care</span>
            </Link>
          </div>
        </div>

        {/* Mood Forecast - Phase 1 Feature */}
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
          <MoodForecast compact={false} />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-xxl)' }}>
            <div className="spinner" aria-label="Loading dashboard"></div>
          </div>
        ) : (
          <div className="grid grid-2 animate-fade-in-up">
            {/* Streak & Progress */}
            <StreakDisplay
              currentStreak={streakData.currentStreak}
              longestStreak={streakData.longestStreak}
              totalCheckIns={streakData.totalCheckIns}
            />

            {/* Recent Mood Summary */}
            <div className="card card-gradient">
              <h2 style={{
                marginBottom: 'var(--spacing-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)'
              }}>
                <span role="img" aria-hidden="true">📊</span> Your Wellbeing
              </h2>
              {statistics && statistics.total_entries > 0 ? (
                <div style={{ display: 'grid', gap: 'var(--spacing-lg)' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-md)',
                    padding: 'var(--spacing-md)',
                    background: 'var(--background)',
                    borderRadius: 'var(--radius-lg)'
                  }}>
                    <span style={{ fontSize: '2.5rem' }}>{getMoodEmoji(parseFloat(statistics.avg_mood))}</span>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xxl)', fontWeight: 700, color: 'var(--primary-color)' }}>
                        {parseFloat(statistics.avg_mood).toFixed(1)}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>
                        Average mood this month
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
                    <div style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--background)',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
                        {parseFloat(statistics.avg_sleep_hours).toFixed(1)}h
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>Avg Sleep</div>
                    </div>
                    <div style={{
                      padding: 'var(--spacing-md)',
                      background: 'var(--background)',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>
                        {statistics.total_entries}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>Check-ins</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                  <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--spacing-md)' }}>🌱</span>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                    Start your wellness journey
                  </p>
                  <Link
                    to="/mood-tracker"
                    style={{
                      display: 'inline-block',
                      padding: 'var(--spacing-sm) var(--spacing-lg)',
                      background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
                      color: 'white',
                      borderRadius: 'var(--radius-lg)',
                      textDecoration: 'none',
                      fontWeight: 600
                    }}
                  >
                    First Check-in
                  </Link>
                </div>
              )}
            </div>

            {/* Achievements */}
            <div style={{ gridColumn: 'span 2' }}>
              <AchievementsGrid userAchievements={achievements} />
            </div>

            {/* Self-Care Suggestions */}
            <div className="card card-peach" style={{ gridColumn: 'span 2' }}>
              <h2 style={{
                marginBottom: 'var(--spacing-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)'
              }}>
                <span role="img" aria-hidden="true">💜</span> Self-Care For You
              </h2>
              {recommendations.length > 0 ? (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: 'var(--spacing-md)'
                }}>
                  {recommendations.slice(0, 3).map((rec) => (
                    <div
                      key={rec.recommendation_id}
                      style={{
                        padding: 'var(--spacing-lg)',
                        background: 'var(--surface)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <div style={{ fontSize: '2rem', marginBottom: 'var(--spacing-sm)' }}>
                        {rec.recommendation_type === 'breathing' && '🌬️'}
                        {rec.recommendation_type === 'exercise' && '🏃'}
                        {rec.recommendation_type === 'social' && '👥'}
                        {rec.recommendation_type === 'rest' && '😴'}
                        {rec.recommendation_type === 'activity' && '✨'}
                      </div>
                      <h3 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--spacing-xs)', fontWeight: 600 }}>
                        {rec.title}
                      </h3>
                      <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                        {rec.description}
                      </p>
                      <div style={{
                        display: 'flex',
                        gap: 'var(--spacing-sm)',
                        fontSize: 'var(--font-size-small)',
                        color: 'var(--text-secondary)'
                      }}>
                        <span>⏱️ {rec.estimated_duration}min</span>
                        <span>•</span>
                        <span style={{ textTransform: 'capitalize' }}>{rec.effort_level}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>
                  Complete a few check-ins to receive personalized self-care suggestions.
                </p>
              )}
              <Link
                to="/recommendations"
                style={{
                  display: 'inline-block',
                  marginTop: 'var(--spacing-lg)',
                  padding: 'var(--spacing-sm) var(--spacing-lg)',
                  background: 'linear-gradient(135deg, var(--secondary-color), var(--secondary-hover))',
                  color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-lg)',
                  textDecoration: 'none',
                  fontWeight: 600
                }}
              >
                View All Activities
              </Link>
            </div>

            {/* Insights */}
            {recentInsights.length > 0 && (
              <div className="card card-sage" style={{ gridColumn: 'span 2' }}>
                <h2 style={{
                  marginBottom: 'var(--spacing-lg)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)'
                }}>
                  <span role="img" aria-hidden="true">🌟</span> Recent Insights
                </h2>
                <div style={{ display: 'grid', gap: 'var(--spacing-md)' }}>
                  {recentInsights.map((insight) => {
                    const data = typeof insight.insight_data === 'string'
                      ? JSON.parse(insight.insight_data)
                      : insight.insight_data;
                    return (
                      <div
                        key={insight.insight_id}
                        style={{
                          padding: 'var(--spacing-md)',
                          background: 'var(--surface)',
                          borderRadius: 'var(--radius-md)',
                          borderLeft: `4px solid ${
                            insight.severity === 'high' ? 'var(--danger-color)' :
                            insight.severity === 'moderate' ? 'var(--warning-color)' :
                            'var(--accent-color)'
                          }`
                        }}
                      >
                        <h3 style={{ fontSize: 'var(--font-size-base)', marginBottom: 'var(--spacing-xs)' }}>
                          {data.title}
                        </h3>
                        <p style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                          {data.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <Link
                  to="/insights"
                  style={{
                    display: 'inline-block',
                    marginTop: 'var(--spacing-lg)',
                    color: 'var(--accent-color)',
                    textDecoration: 'none',
                    fontWeight: 600
                  }}
                >
                  View All Insights →
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import api from '../services/api';

/**
 * EnhancedPeerSupport Page
 * Pattern-based matching, structured exercises, and mentorship features
 * that complement the existing PeerSupport page.
 */
const EnhancedPeerSupport = () => {
  const [pattern, setPattern] = useState(null);
  const [matches, setMatches] = useState([]);
  const [suggestedGroup, setSuggestedGroup] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [mentorships, setMentorships] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeExercise, setActiveExercise] = useState(null);
  const [exerciseResponse, setExerciseResponse] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [patternRes, matchesRes, mentorRes] = await Promise.all([
        api.get('/peer-support/enhanced/pattern').catch(() => ({ data: null })),
        api.get('/peer-support/enhanced/matches').catch(() => ({ data: { matches: [] } })),
        api.get('/peer-support/enhanced/mentorships').catch(() => ({ data: null }))
      ]);
      setPattern(patternRes.data?.pattern || null);
      setMatches(matchesRes.data?.matches || []);
      setExercises(matchesRes.data?.exercises || patternRes.data?.exercises || []);
      setMentorships(mentorRes.data || null);
    } catch (err) {
      console.error('Failed to load enhanced peer support data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestGroup = async () => {
    try {
      const res = await api.get('/peer-support/enhanced/suggest-group');
      setSuggestedGroup(res.data?.group || res.data || null);
    } catch (err) {
      console.error('Failed to get group suggestion:', err);
    }
  };

  const handleJoinSuggestedGroup = async () => {
    if (!suggestedGroup?.id) return;
    try {
      await api.post(`/peer-support/groups/${suggestedGroup.id}/join`, { nickname: null });
      setSuggestedGroup(prev => prev ? { ...prev, joined: true } : prev);
    } catch (err) {
      console.error('Failed to join group:', err);
    }
  };

  const handleExerciseRespond = async (exerciseId) => {
    if (!exerciseResponse.trim()) return;
    try {
      setSubmitting(true);
      await api.post(`/peer-support/enhanced/exercises/${exerciseId}/respond`, {
        response: exerciseResponse.trim()
      });
      setExercises(prev => prev.map(ex =>
        ex.id === exerciseId ? { ...ex, status: 'completed', participationCount: (ex.participationCount || 0) + 1 } : ex
      ));
      setActiveExercise(null);
      setExerciseResponse('');
    } catch (err) {
      console.error('Failed to submit exercise response:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const exerciseIcons = {
    gratitude_round: '\uD83D\uDE4F',
    coping_strategy_share: '\uD83D\uDCA1',
    weekly_challenge: '\uD83C\uDFAF',
    check_in_circle: '\uD83D\uDD04',
    mindful_moment: '\uD83E\uDDD8'
  };

  // --- Styles ---
  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #FFFBF8 0%, #F3EDF7 100%)'
  };

  const containerStyle = {
    paddingTop: 'var(--spacing-xl)',
    paddingBottom: 'var(--spacing-xxl)'
  };

  const headingStyle = {
    fontSize: 'var(--font-size-xxl)',
    fontWeight: 700,
    color: '#4A3F55',
    marginBottom: 'var(--spacing-lg)'
  };

  const cardStyle = {
    background: 'white',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-xl)',
    marginBottom: 'var(--spacing-lg)',
    boxShadow: '0 2px 12px rgba(155, 138, 165, 0.1)'
  };

  const sectionHeadingStyle = {
    fontSize: 'var(--font-size-large)',
    fontWeight: 600,
    color: '#4A3F55',
    marginBottom: 'var(--spacing-md)',
    paddingBottom: 'var(--spacing-sm)',
    borderBottom: '2px solid #B8A9C9'
  };

  const buttonStyle = {
    padding: 'var(--spacing-sm) var(--spacing-lg)',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'linear-gradient(135deg, #9B8AA5, #8A7A94)',
    color: 'white',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  const outlineButtonStyle = {
    padding: 'var(--spacing-sm) var(--spacing-lg)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #9B8AA5',
    background: 'transparent',
    color: '#9B8AA5',
    fontSize: 'var(--font-size-small)',
    fontWeight: 600,
    cursor: 'pointer'
  };

  const badgeStyle = (type) => {
    const colors = {
      gratitude_round: { bg: '#FEF3C7', text: '#92400E' },
      coping_strategy_share: { bg: '#E6F7ED', text: '#276749' },
      weekly_challenge: { bg: '#F3EDF7', text: '#9B8AA5' },
      check_in_circle: { bg: '#DBEAFE', text: '#1E40AF' },
      mindful_moment: { bg: '#FCE7F3', text: '#9D174D' }
    };
    const c = colors[type] || { bg: '#F3EDF7', text: '#4A3F55' };
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 10px',
      borderRadius: '12px',
      background: c.bg,
      color: c.text,
      fontSize: 'var(--font-size-small)',
      fontWeight: 500
    };
  };

  const statBoxStyle = {
    background: '#F3EDF7',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--spacing-md)',
    textAlign: 'center'
  };

  const textareaStyle = {
    width: '100%',
    padding: 'var(--spacing-sm)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #B8A9C9',
    fontSize: 'var(--font-size-base)',
    color: '#4A3F55',
    background: '#FFFBF8',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
    minHeight: '80px',
    boxSizing: 'border-box'
  };

  if (loading) {
    return (
      <div style={pageStyle}>
        <Navigation />
        <main className="container" style={containerStyle}>
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xxl)', color: '#9B8AA5' }}>Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <Navigation />
      <main id="main-content" className="container" style={containerStyle}>
        <h1 style={headingStyle}>Enhanced Peer Support</h1>

        {error && (
          <div role="alert" style={{ background: '#FDE8E8', borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', color: '#6B2D2D' }}>
            {error}
          </div>
        )}

        {/* Your Pattern Card */}
        <div style={cardStyle}>
          <h2 style={sectionHeadingStyle}>Your Pattern</h2>
          {pattern ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--spacing-md)' }}>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', marginBottom: '4px' }}>Peak Day</div>
                <div style={{ fontWeight: 600, color: '#4A3F55' }}>{pattern.peakDay || '—'}</div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', marginBottom: '4px' }}>Trough Day</div>
                <div style={{ fontWeight: 600, color: '#4A3F55' }}>{pattern.troughDay || '—'}</div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', marginBottom: '4px' }}>Cluster</div>
                <div style={{ fontWeight: 600, color: '#4A3F55' }}>{pattern.clusterName || '—'}</div>
              </div>
              <div style={statBoxStyle}>
                <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', marginBottom: '4px' }}>Variability</div>
                <div style={{ fontWeight: 600, color: '#4A3F55' }}>{pattern.variability != null ? pattern.variability.toFixed(1) : '—'}</div>
              </div>
            </div>
          ) : (
            <p style={{ color: '#9B8AA5' }}>Not enough data to determine your pattern yet. Keep logging your mood!</p>
          )}
        </div>

        {/* Similar Patterns */}
        <div style={cardStyle}>
          <h2 style={sectionHeadingStyle}>Similar Patterns</h2>
          {matches.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {matches.map((match, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: '#F3EDF7',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <div>
                    <span style={{ fontWeight: 500, color: '#4A3F55' }}>{match.anonymousName || `User ${idx + 1}`}</span>
                    <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', marginTop: '2px' }}>
                      {match.patternDescription || match.clusterName || 'Similar mood pattern'}
                    </div>
                  </div>
                  {match.similarity != null && (
                    <span style={{
                      background: '#9B8AA5',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: 'var(--font-size-small)',
                      fontWeight: 500
                    }}>
                      {Math.round(match.similarity * 100)}% match
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#9B8AA5' }}>No pattern matches found yet.</p>
          )}

          <div style={{ marginTop: 'var(--spacing-lg)' }}>
            <button onClick={handleSuggestGroup} style={buttonStyle}>
              Suggest Group
            </button>
          </div>

          {/* Suggested Group */}
          {suggestedGroup && (
            <div style={{
              marginTop: 'var(--spacing-md)',
              padding: 'var(--spacing-md)',
              background: 'linear-gradient(135deg, #F3EDF7, #E6DDEF)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid #B8A9C9'
            }}>
              <div style={{ fontWeight: 600, color: '#4A3F55', marginBottom: 'var(--spacing-xs)' }}>
                {suggestedGroup.name || 'Suggested Group'}
              </div>
              <p style={{ fontSize: 'var(--font-size-small)', color: '#4A3F55', marginBottom: 'var(--spacing-sm)' }}>
                {suggestedGroup.description || 'A group matched to your pattern.'}
              </p>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5' }}>
                  {suggestedGroup.memberCount || 0} members
                </span>
                {!suggestedGroup.joined ? (
                  <button onClick={handleJoinSuggestedGroup} style={outlineButtonStyle}>
                    Join Group
                  </button>
                ) : (
                  <span style={{ color: '#276749', fontWeight: 500, fontSize: 'var(--font-size-small)' }}>Joined</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Structured Exercises */}
        <div style={cardStyle}>
          <h2 style={sectionHeadingStyle}>Group Exercises</h2>
          {exercises.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {exercises.map((ex) => (
                <div key={ex.id} style={{
                  border: '1px solid #F3EDF7',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--spacing-md)',
                  background: activeExercise === ex.id ? '#FFFBF8' : 'white'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
                        <span style={badgeStyle(ex.type)}>
                          {exerciseIcons[ex.type] || '\u2728'} {(ex.type || '').replace(/_/g, ' ')}
                        </span>
                        {ex.status === 'completed' && (
                          <span style={{ fontSize: 'var(--font-size-small)', color: '#276749', fontWeight: 500 }}>Completed</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 600, color: '#4A3F55', marginBottom: '4px' }}>{ex.title}</div>
                      <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5' }}>
                        {ex.participationCount || 0} participants
                      </div>
                    </div>
                    {ex.status !== 'completed' && (
                      <button
                        onClick={() => setActiveExercise(activeExercise === ex.id ? null : ex.id)}
                        style={outlineButtonStyle}
                      >
                        {activeExercise === ex.id ? 'Cancel' : 'Respond'}
                      </button>
                    )}
                  </div>

                  {activeExercise === ex.id && (
                    <div style={{ marginTop: 'var(--spacing-md)' }}>
                      <textarea
                        value={exerciseResponse}
                        onChange={(e) => setExerciseResponse(e.target.value)}
                        placeholder="Share your response..."
                        style={textareaStyle}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-sm)' }}>
                        <button
                          onClick={() => handleExerciseRespond(ex.id)}
                          disabled={submitting || !exerciseResponse.trim()}
                          style={{
                            ...buttonStyle,
                            fontSize: 'var(--font-size-small)',
                            padding: 'var(--spacing-xs) var(--spacing-lg)',
                            opacity: submitting || !exerciseResponse.trim() ? 0.6 : 1,
                            cursor: submitting || !exerciseResponse.trim() ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {submitting ? 'Submitting...' : 'Submit'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#9B8AA5' }}>No group exercises available right now. Check back later!</p>
          )}
        </div>

        {/* Mentorship Section */}
        <div style={cardStyle}>
          <h2 style={sectionHeadingStyle}>Mentorship</h2>

          {mentorships?.eligibleAsMentor && (
            <div style={{
              background: 'linear-gradient(135deg, #E6F7ED, #D5F0E3)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-md)',
              marginBottom: 'var(--spacing-lg)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--spacing-sm)'
            }}>
              <div>
                <div style={{ fontWeight: 600, color: '#276749' }}>You're eligible to be a mentor!</div>
                <div style={{ fontSize: 'var(--font-size-small)', color: '#276749' }}>
                  Your consistent engagement qualifies you to support others.
                </div>
              </div>
              {!mentorships?.isMentor && (
                <button
                  onClick={async () => {
                    try {
                      await api.post('/peer-support/enhanced/mentorships/volunteer');
                      loadData();
                    } catch (err) {
                      console.error('Failed to volunteer:', err);
                    }
                  }}
                  style={{ ...outlineButtonStyle, borderColor: '#276749', color: '#276749' }}
                >
                  Volunteer
                </button>
              )}
            </div>
          )}

          {mentorships?.active?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {mentorships.active.map((m, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: '#F3EDF7',
                  borderRadius: 'var(--radius-md)'
                }}>
                  <div>
                    <span style={{ fontWeight: 500, color: '#4A3F55' }}>{m.partnerName || 'Anonymous'}</span>
                    <div style={{ fontSize: 'var(--font-size-small)', color: '#9B8AA5', marginTop: '2px' }}>
                      {m.role === 'mentor' ? 'You are mentoring' : 'Your mentor'}
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 10px',
                    borderRadius: '12px',
                    background: m.role === 'mentor' ? '#E6F7ED' : '#F3EDF7',
                    color: m.role === 'mentor' ? '#276749' : '#9B8AA5',
                    fontSize: 'var(--font-size-small)',
                    fontWeight: 500
                  }}>
                    {m.role === 'mentor' ? 'Mentor' : 'Mentee'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#9B8AA5' }}>No active mentorships. {mentorships?.eligibleAsMentor ? 'Volunteer above to get started!' : 'Keep logging to become eligible.'}</p>
          )}
        </div>
      </main>
    </div>
  );
};

export default EnhancedPeerSupport;

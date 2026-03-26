import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import api from '../services/api';

/**
 * Protocols - Therapeutic protocols page
 * Browse, enroll, and complete structured therapy programs
 */
const Protocols = () => {
  const [protocols, setProtocols] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Views: 'list' | 'enroll-confirm' | 'session'
  const [view, setView] = useState('list');
  const [selectedProtocol, setSelectedProtocol] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Completion form
  const [moodBefore, setMoodBefore] = useState(5);
  const [moodAfter, setMoodAfter] = useState(5);
  const [difficulty, setDifficulty] = useState(3);
  const [completing, setCompleting] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [protocolsRes, enrolledRes] = await Promise.all([
        api.get('/protocols'),
        api.get('/protocols/enrolled').catch(() => ({ data: [] }))
      ]);
      setProtocols(protocolsRes.data?.protocols || protocolsRes.data || []);
      setEnrolled(enrolledRes.data?.enrollments || enrolledRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load protocols');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (protocolId) => {
    try {
      await api.post('/protocols/enroll', { protocolId });
      await loadData();
      setView('list');
      setSelectedProtocol(null);
    } catch (err) {
      setError(err.message || 'Failed to enroll');
    }
  };

  const loadSession = async (protocolId) => {
    setSessionLoading(true);
    try {
      const res = await api.get(`/protocols/${protocolId}/session`);
      setCurrentSession(res.data?.session || res.data);
      setSelectedProtocol(protocolId);
      setView('session');
      setShowComplete(false);
      setMoodBefore(5);
      setMoodAfter(5);
      setDifficulty(3);
    } catch (err) {
      setError(err.message || 'Failed to load session');
    } finally {
      setSessionLoading(false);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await api.post(`/protocols/${selectedProtocol}/complete`, {
        moodBefore,
        moodAfter,
        difficulty
      });
      await loadData();
      setView('list');
      setCurrentSession(null);
      setSelectedProtocol(null);
    } catch (err) {
      setError(err.message || 'Failed to complete session');
    } finally {
      setCompleting(false);
    }
  };

  // ---- Styles ----
  const pageStyle = { minHeight: '100vh', background: '#FFFBF8' };

  const containerStyle = {
    maxWidth: '780px',
    margin: '0 auto',
    padding: 'var(--spacing-lg, 24px) var(--spacing-md, 16px)'
  };

  const headerStyle = {
    fontSize: 'var(--font-size-2xl, 1.5rem)',
    fontWeight: 700,
    color: '#4A3F55',
    marginBottom: 'var(--spacing-lg, 24px)',
    fontFamily: 'var(--font-family-heading, inherit)'
  };

  const cardStyle = {
    background: '#fff',
    borderRadius: 'var(--radius-lg, 16px)',
    padding: 'var(--spacing-lg, 20px)',
    marginBottom: 'var(--spacing-md, 16px)',
    boxShadow: '0 2px 12px rgba(74, 63, 85, 0.06)',
    border: '1px solid rgba(184, 169, 201, 0.15)'
  };

  const modalityColors = {
    CBT: '#9B8AA5', DBT: '#A8C5A8', ACT: '#F5D89A',
    Mindfulness: '#B8A9C9', 'Behavioral Activation': '#F5C9B3',
    default: '#B8A9C9'
  };

  const badgeStyle = (text, bgColor) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: 600,
    background: `${bgColor || '#B8A9C9'}25`,
    color: bgColor || '#9B8AA5',
    marginRight: '6px'
  });

  const btnStyle = (variant = 'primary', disabled = false) => ({
    padding: '10px 20px',
    border: 'none',
    borderRadius: 'var(--radius-md, 10px)',
    fontWeight: 600,
    fontSize: 'var(--font-size-small, 0.875rem)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.2s ease',
    ...(variant === 'primary' ? {
      background: 'linear-gradient(135deg, #9B8AA5, #B8A9C9)',
      color: '#fff'
    } : {
      background: 'transparent',
      color: '#9B8AA5',
      border: '1px solid #B8A9C9'
    })
  });

  const progressBarStyle = (percent) => ({
    width: '100%',
    height: '8px',
    background: '#f0ebf4',
    borderRadius: '4px',
    overflow: 'hidden',
    position: 'relative'
  });

  const progressFillStyle = (percent) => ({
    height: '100%',
    width: `${Math.min(100, percent)}%`,
    background: 'linear-gradient(90deg, #9B8AA5, #B8A9C9)',
    borderRadius: '4px',
    transition: 'width 0.4s ease'
  });

  const sliderContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '16px'
  };

  const sliderLabelRow = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const sliderInputStyle = (value, max) => ({
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    background: `linear-gradient(to right, #9B8AA5 0%, #9B8AA5 ${((value - 1) / (max - 1)) * 100}%, #e0d6e8 ${((value - 1) / (max - 1)) * 100}%, #e0d6e8 100%)`,
    appearance: 'none',
    cursor: 'pointer',
    outline: 'none'
  });

  const difficultyLabels = ['Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard'];

  // ---- Enrollment Confirmation View ----
  if (view === 'enroll-confirm' && selectedProtocol) {
    const proto = protocols.find(p => (p.id || p.protocol_id) === selectedProtocol) || {};
    return (
      <div style={pageStyle}>
        <Navigation />
        <div style={containerStyle}>
          <button
            onClick={() => { setView('list'); setSelectedProtocol(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8AA5', fontSize: '1rem', marginBottom: '16px' }}
          >
            &larr; Back
          </button>

          <div style={{ ...cardStyle, textAlign: 'center', padding: 'var(--spacing-xl, 32px)' }}>
            <h2 style={{ ...headerStyle, marginBottom: '12px' }}>Start Program</h2>
            <h3 style={{ fontSize: '1.2rem', color: '#4A3F55', fontWeight: 600, margin: '0 0 16px' }}>
              {proto.name || proto.title}
            </h3>
            <p style={{ color: '#6b5f7a', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '20px' }}>
              {proto.description}
            </p>

            <div style={{
              background: '#f8f4fb',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              textAlign: 'left'
            }}>
              <p style={{ color: '#4A3F55', fontWeight: 600, margin: '0 0 8px', fontSize: '0.9rem' }}>
                Before you begin:
              </p>
              <p style={{ color: '#6b5f7a', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                We recommend completing a baseline assessment first so we can measure your progress throughout the program.
                You can do this from the Assessments page.
              </p>
            </div>

            {proto.total_sessions && (
              <p style={{ color: '#9B8AA5', fontSize: '0.85rem', marginBottom: '20px' }}>
                {proto.total_sessions} sessions &middot; {proto.duration || 'Self-paced'}
                {proto.difficulty && ` \u00B7 ${proto.difficulty}`}
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => { setView('list'); setSelectedProtocol(null); }}
                style={btnStyle('secondary')}
              >
                Cancel
              </button>
              <button
                onClick={() => handleEnroll(selectedProtocol)}
                style={btnStyle('primary')}
              >
                Enroll &amp; Start
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Session View ----
  if (view === 'session' && currentSession) {
    return (
      <div style={pageStyle}>
        <Navigation />
        <div style={containerStyle}>
          <button
            onClick={() => { setView('list'); setCurrentSession(null); setSelectedProtocol(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8AA5', fontSize: '1rem', marginBottom: '16px' }}
          >
            &larr; Back to Programs
          </button>

          {sessionLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9B8AA5' }}>Loading session...</div>
          ) : (
            <>
              <div style={cardStyle}>
                <h2 style={{
                  fontSize: 'var(--font-size-xl, 1.25rem)',
                  fontWeight: 700,
                  color: '#4A3F55',
                  marginBottom: '8px'
                }}>
                  {currentSession.title || `Session ${currentSession.session_number || ''}`}
                </h2>

                {currentSession.description && (
                  <p style={{
                    color: '#6b5f7a',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    marginBottom: '16px'
                  }}>
                    {currentSession.description}
                  </p>
                )}

                {/* Instructions */}
                {currentSession.instructions && (
                  <div style={{
                    background: '#f8f4fb',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <h4 style={{ color: '#4A3F55', fontWeight: 600, margin: '0 0 8px', fontSize: '0.9rem' }}>
                      Instructions
                    </h4>
                    <div style={{ color: '#6b5f7a', fontSize: '0.85rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {currentSession.instructions}
                    </div>
                  </div>
                )}

                {/* Exercise area */}
                {currentSession.exercise && (
                  <div style={{
                    border: '1px dashed #B8A9C9',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <h4 style={{ color: '#9B8AA5', fontWeight: 600, margin: '0 0 8px', fontSize: '0.9rem' }}>
                      Exercise
                    </h4>
                    <div style={{ color: '#4A3F55', fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {currentSession.exercise}
                    </div>
                  </div>
                )}

                {/* Complete Session toggle */}
                {!showComplete ? (
                  <button
                    onClick={() => setShowComplete(true)}
                    style={{ ...btnStyle('primary'), width: '100%', padding: '14px' }}
                  >
                    Complete Session
                  </button>
                ) : (
                  <div style={{
                    background: '#faf7fd',
                    borderRadius: '12px',
                    padding: '20px',
                    marginTop: '16px'
                  }}>
                    <h4 style={{ color: '#4A3F55', fontWeight: 600, margin: '0 0 16px' }}>
                      Session Feedback
                    </h4>

                    {/* Mood Before */}
                    <div style={sliderContainerStyle}>
                      <div style={sliderLabelRow}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#4A3F55' }}>
                          Mood before session
                        </span>
                        <span style={{
                          fontSize: '0.8rem', fontWeight: 600, color: '#9B8AA5',
                          background: '#f0ebf4', padding: '2px 8px', borderRadius: '10px'
                        }}>
                          {moodBefore}/10
                        </span>
                      </div>
                      <input
                        type="range" min={1} max={10} value={moodBefore}
                        onChange={(e) => setMoodBefore(parseInt(e.target.value))}
                        style={sliderInputStyle(moodBefore, 10)}
                        aria-label="Mood before session"
                      />
                    </div>

                    {/* Mood After */}
                    <div style={sliderContainerStyle}>
                      <div style={sliderLabelRow}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#4A3F55' }}>
                          Mood after session
                        </span>
                        <span style={{
                          fontSize: '0.8rem', fontWeight: 600, color: '#9B8AA5',
                          background: '#f0ebf4', padding: '2px 8px', borderRadius: '10px'
                        }}>
                          {moodAfter}/10
                        </span>
                      </div>
                      <input
                        type="range" min={1} max={10} value={moodAfter}
                        onChange={(e) => setMoodAfter(parseInt(e.target.value))}
                        style={sliderInputStyle(moodAfter, 10)}
                        aria-label="Mood after session"
                      />
                    </div>

                    {/* Difficulty */}
                    <div style={sliderContainerStyle}>
                      <div style={sliderLabelRow}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#4A3F55' }}>
                          Difficulty
                        </span>
                        <span style={{
                          fontSize: '0.8rem', fontWeight: 600, color: '#9B8AA5',
                          background: '#f0ebf4', padding: '2px 8px', borderRadius: '10px'
                        }}>
                          {difficultyLabels[difficulty - 1]}
                        </span>
                      </div>
                      <input
                        type="range" min={1} max={5} value={difficulty}
                        onChange={(e) => setDifficulty(parseInt(e.target.value))}
                        style={sliderInputStyle(difficulty, 5)}
                        aria-label="Session difficulty"
                      />
                    </div>

                    <button
                      onClick={handleComplete}
                      disabled={completing}
                      style={{ ...btnStyle('primary', completing), width: '100%', padding: '14px', marginTop: '8px' }}
                    >
                      {completing ? 'Saving...' : 'Submit & Complete'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- Protocol List View ----
  return (
    <div style={pageStyle}>
      <Navigation />
      <div style={containerStyle}>
        <h1 style={headerStyle}>Therapeutic Programs</h1>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9B8AA5' }}>
            Loading programs...
          </div>
        )}

        {error && (
          <div style={{
            ...cardStyle,
            background: '#E8A5A510',
            borderColor: '#E8A5A540',
            color: '#c0564e',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Enrolled Programs */}
        {enrolled.length > 0 && (
          <div style={{ marginBottom: 'var(--spacing-xl, 32px)' }}>
            <h2 style={{
              fontSize: 'var(--font-size-lg, 1.1rem)',
              fontWeight: 600,
              color: '#4A3F55',
              marginBottom: '12px'
            }}>
              Your Active Programs
            </h2>
            {enrolled.map((e) => {
              const sessionsCompleted = e.sessions_completed || 0;
              const totalSessions = e.total_sessions || 1;
              const percent = Math.round((sessionsCompleted / totalSessions) * 100);
              const adherence = e.adherence_percent ?? percent;

              return (
                <div key={e.id || e.enrollment_id || e.protocol_id} style={cardStyle}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#4A3F55', margin: '0 0 8px' }}>
                        {e.name || e.protocol_name || e.title}
                      </h3>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <span style={badgeStyle('Enrolled', '#7BC47B')}>Enrolled</span>
                        {e.current_week && (
                          <span style={badgeStyle(`Week ${e.current_week}`, '#9B8AA5')}>
                            Week {e.current_week}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div style={{ marginBottom: '6px' }}>
                        <div style={progressBarStyle(percent)}>
                          <div style={progressFillStyle(percent)} />
                        </div>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.75rem',
                        color: '#9B8AA5'
                      }}>
                        <span>{sessionsCompleted} / {totalSessions} sessions</span>
                        <span>{adherence}% adherence</span>
                      </div>
                    </div>
                    <button
                      onClick={() => loadSession(e.protocol_id || e.id)}
                      style={btnStyle('primary')}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Available Protocols */}
        {!loading && protocols.length > 0 && (
          <>
            <h2 style={{
              fontSize: 'var(--font-size-lg, 1.1rem)',
              fontWeight: 600,
              color: '#4A3F55',
              marginBottom: '12px'
            }}>
              Available Programs
            </h2>
            {protocols.map((p) => {
              const id = p.id || p.protocol_id;
              const modColor = modalityColors[p.modality] || modalityColors.default;
              const isEnrolled = enrolled.some(e => (e.protocol_id || e.id) === id);

              return (
                <div key={id} style={cardStyle}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#4A3F55', margin: '0 0 8px' }}>
                        {p.name || p.title}
                      </h3>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {p.modality && <span style={badgeStyle(p.modality, modColor)}>{p.modality}</span>}
                        {p.difficulty && <span style={badgeStyle(p.difficulty, '#F5C9B3')}>{p.difficulty}</span>}
                        {p.duration && <span style={badgeStyle(p.duration, '#9B8AA5')}>{p.duration}</span>}
                      </div>
                      {p.target_condition && (
                        <p style={{ fontSize: '0.8rem', color: '#6b5f7a', margin: '0 0 4px' }}>
                          For: {p.target_condition}
                        </p>
                      )}
                      {p.description && (
                        <p style={{
                          fontSize: 'var(--font-size-small, 0.85rem)',
                          color: '#6b5f7a',
                          margin: '6px 0 0',
                          lineHeight: 1.5
                        }}>
                          {p.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (isEnrolled) {
                          loadSession(id);
                        } else {
                          setSelectedProtocol(id);
                          setView('enroll-confirm');
                        }
                      }}
                      style={btnStyle('primary')}
                    >
                      {isEnrolled ? 'Continue' : 'Start Program'}
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {!loading && protocols.length === 0 && !error && (
          <div style={{ ...cardStyle, textAlign: 'center', color: '#9B8AA5' }}>
            No programs available yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default Protocols;

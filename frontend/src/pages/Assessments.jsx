import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import api, { insightsAPI } from '../services/api';

/**
 * Assessments - Clinical assessments page (PHQ9, GAD7, PSS4, ISI, WEMWBS)
 * Lists instruments, shows questions one-at-a-time, results with history chart
 */

const SCALE_CONFIG = {
  PHQ9: { min: 0, max: 3, labels: ['Not at all', 'Several days', 'More than half', 'Nearly every day'] },
  GAD7: { min: 0, max: 3, labels: ['Not at all', 'Several days', 'More than half', 'Nearly every day'] },
  PSS4: { min: 0, max: 4, labels: ['Never', 'Almost never', 'Sometimes', 'Fairly often', 'Very often'] },
  ISI:  { min: 0, max: 4, labels: ['None', 'Mild', 'Moderate', 'Severe', 'Very severe'] },
  WEMWBS: { min: 1, max: 5, labels: ['None of the time', 'Rarely', 'Some of the time', 'Often', 'All of the time'] }
};

const Assessments = () => {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active assessment state
  const [activeInstrument, setActiveInstrument] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Results state
  const [result, setResult] = useState(null);

  // History state
  const [historyInstrument, setHistoryInstrument] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/assessments');
      setAssessments(res.data?.assessments || res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load assessments');
    } finally {
      setLoading(false);
    }
  };

  const startAssessment = async (instrument) => {
    try {
      const res = await api.get(`/assessments/${instrument}`);
      const data = res.data || res;
      setQuestions(data.questions || []);
      setActiveInstrument(instrument);
      setCurrentQuestion(0);
      setAnswers({});
      setResult(null);
    } catch (err) {
      setError(err.message || 'Failed to load assessment');
    }
  };

  const handleAnswer = (questionIndex, value) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: value }));
    // Auto-advance after short delay
    if (questionIndex < questions.length - 1) {
      setTimeout(() => setCurrentQuestion(questionIndex + 1), 300);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/assessments/${activeInstrument}/submit`, {
        answers: Object.values(answers)
      });
      setResult(res.data || res);
    } catch (err) {
      setError(err.message || 'Failed to submit assessment');
    } finally {
      setSubmitting(false);
    }
  };

  const loadHistory = async (instrument) => {
    setHistoryLoading(true);
    setHistoryInstrument(instrument);
    try {
      const res = await api.get(`/assessments/${instrument}/history`);
      setHistory(res.data?.history || res.data || []);
    } catch (err) {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const resetAssessment = () => {
    setActiveInstrument(null);
    setQuestions([]);
    setCurrentQuestion(0);
    setAnswers({});
    setResult(null);
    loadAssessments();
  };

  // ---- Styles ----
  const pageStyle = {
    minHeight: '100vh',
    background: '#FFFBF8'
  };

  const containerStyle = {
    maxWidth: '720px',
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

  const badgeStyle = (variant) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: variant === 'due' ? '#E8A5A520' : '#B8A9C920',
    color: variant === 'due' ? '#c0564e' : '#9B8AA5',
    marginLeft: '8px'
  });

  const buttonStyle = (variant = 'primary') => ({
    padding: '10px 20px',
    border: 'none',
    borderRadius: 'var(--radius-md, 10px)',
    fontWeight: 600,
    fontSize: 'var(--font-size-small, 0.875rem)',
    cursor: 'pointer',
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

  const progressBarContainer = {
    width: '100%',
    height: '8px',
    background: '#f0ebf4',
    borderRadius: '4px',
    marginBottom: 'var(--spacing-lg, 24px)',
    overflow: 'hidden'
  };

  const scaleButtonStyle = (isSelected) => ({
    flex: 1,
    minWidth: '60px',
    padding: '12px 8px',
    border: isSelected ? '2px solid #9B8AA5' : '1px solid #e0d6e8',
    borderRadius: 'var(--radius-md, 10px)',
    background: isSelected ? 'linear-gradient(145deg, #9B8AA530, #B8A9C940)' : '#fff',
    color: '#4A3F55',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: '0.8rem',
    fontWeight: isSelected ? 600 : 400,
    textAlign: 'center',
    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
    boxShadow: isSelected ? '0 3px 12px rgba(155, 138, 165, 0.2)' : 'none'
  });

  // ---- Active Assessment View ----
  if (activeInstrument && !result) {
    const scale = SCALE_CONFIG[activeInstrument] || SCALE_CONFIG.PHQ9;
    const question = questions[currentQuestion];
    const progress = ((currentQuestion + (answers[currentQuestion] !== undefined ? 1 : 0)) / questions.length) * 100;
    const allAnswered = Object.keys(answers).length === questions.length;

    return (
      <div style={pageStyle}>
        <Navigation />
        <div style={containerStyle}>
          {/* Header with back */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--spacing-md, 16px)' }}>
            <button
              onClick={resetAssessment}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#9B8AA5' }}
              aria-label="Back to assessments"
            >
              &larr;
            </button>
            <h2 style={{ ...headerStyle, marginBottom: 0, fontSize: '1.25rem' }}>{activeInstrument}</h2>
            <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#9B8AA5', fontWeight: 500 }}>
              {currentQuestion + 1} / {questions.length}
            </span>
          </div>

          {/* Progress bar */}
          <div style={progressBarContainer}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #9B8AA5, #B8A9C9)',
              borderRadius: '4px',
              transition: 'width 0.3s ease'
            }} />
          </div>

          {/* Question card */}
          {question && (
            <div style={{ ...cardStyle, padding: 'var(--spacing-xl, 32px)' }}>
              <p style={{
                fontSize: 'var(--font-size-lg, 1.1rem)',
                color: '#4A3F55',
                fontWeight: 500,
                marginBottom: 'var(--spacing-lg, 24px)',
                lineHeight: 1.6
              }}>
                {question.text || question.question || question}
              </p>

              <div style={{
                display: 'flex',
                gap: 'var(--spacing-sm, 8px)',
                flexWrap: 'wrap'
              }}>
                {scale.labels.map((label, i) => {
                  const value = scale.min + i;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleAnswer(currentQuestion, value)}
                      style={scaleButtonStyle(answers[currentQuestion] === value)}
                      aria-pressed={answers[currentQuestion] === value}
                    >
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>{value}</div>
                      <div style={{ fontSize: '0.7rem', lineHeight: 1.2 }}>{label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 'var(--spacing-lg, 24px)',
            gap: '12px'
          }}>
            <button
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              style={{
                ...buttonStyle('secondary'),
                opacity: currentQuestion === 0 ? 0.4 : 1,
                cursor: currentQuestion === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              Previous
            </button>

            {currentQuestion < questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestion(currentQuestion + 1)}
                disabled={answers[currentQuestion] === undefined}
                style={{
                  ...buttonStyle('primary'),
                  opacity: answers[currentQuestion] === undefined ? 0.5 : 1,
                  cursor: answers[currentQuestion] === undefined ? 'not-allowed' : 'pointer'
                }}
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
                style={{
                  ...buttonStyle('primary'),
                  opacity: !allAnswered || submitting ? 0.5 : 1,
                  cursor: !allAnswered || submitting ? 'not-allowed' : 'pointer'
                }}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Results View ----
  if (result) {
    const severityColor = {
      minimal: '#7BC47B', mild: '#A8C5A8', moderate: '#F5D89A',
      'moderately severe': '#F5C9B3', severe: '#E8A5A5'
    };
    const color = severityColor[result.severity?.toLowerCase()] || '#B8A9C9';

    return (
      <div style={pageStyle}>
        <Navigation />
        <div style={containerStyle}>
          {/* Crisis banner — rendered ABOVE the score so it is the first
              thing the user sees when has_crisis_flag is true. Source of
              the resources + message is the backend (commit eab1987),
              which uses the same UK_CRISIS_RESOURCES table SafetyFilter
              shares with Luna, so the numbers match across surfaces.
              Trauma-informed copy: warm tone, not alarming; we never
              tell the user what they "should" do, only offer options. */}
          {result.has_crisis_flag && result.crisis_resources?.length > 0 && (
            <CrisisBanner
              message={result.crisis_message}
              resources={result.crisis_resources}
              alertId={result.crisis_alert_id}
            />
          )}

          <div style={{ ...cardStyle, textAlign: 'center', padding: 'var(--spacing-xl, 32px)' }}>
            <h2 style={{ ...headerStyle, marginBottom: '8px' }}>Results: {activeInstrument}</h2>

            {/* Score circle */}
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${color}60, ${color}90)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '20px auto',
              flexDirection: 'column'
            }}>
              <span style={{ fontSize: '2rem', fontWeight: 700, color: '#4A3F55' }}>
                {result.score ?? result.total_score}
              </span>
            </div>

            {/* Severity */}
            {result.severity && (
              <p style={{
                fontSize: 'var(--font-size-lg, 1.1rem)',
                fontWeight: 600,
                color: '#4A3F55',
                textTransform: 'capitalize',
                margin: '8px 0'
              }}>
                {result.severity}
              </p>
            )}

            {/* Change from last */}
            {result.change !== undefined && result.change !== null && (
              <p style={{
                fontSize: 'var(--font-size-small, 0.875rem)',
                color: result.change > 0 ? '#c0564e' : result.change < 0 ? '#5a9a5a' : '#9B8AA5',
                fontWeight: 500,
                margin: '12px 0'
              }}>
                {result.change > 0 ? '\u2191' : result.change < 0 ? '\u2193' : '\u2192'}{' '}
                {Math.abs(result.change)} points from last time
              </p>
            )}

            {/* Interpretation */}
            {result.interpretation && (
              <p style={{
                fontSize: 'var(--font-size-small, 0.875rem)',
                color: '#6b5f7a',
                lineHeight: 1.6,
                margin: '16px 0 24px'
              }}>
                {result.interpretation}
              </p>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => loadHistory(activeInstrument)} style={buttonStyle('secondary')}>
                View History
              </button>
              <button onClick={resetAssessment} style={buttonStyle('primary')}>
                Done
              </button>
            </div>
          </div>

          {/* Inline history chart */}
          {historyInstrument === activeInstrument && (
            <HistoryChart history={history} loading={historyLoading} instrument={activeInstrument} />
          )}
        </div>
      </div>
    );
  }

  // ---- Assessment List View ----
  return (
    <div style={pageStyle}>
      <Navigation />
      <div style={containerStyle}>
        <h1 style={headerStyle}>Assessments</h1>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9B8AA5' }}>
            Loading assessments...
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

        {!loading && assessments.length === 0 && !error && (
          <div style={{ ...cardStyle, textAlign: 'center', color: '#9B8AA5' }}>
            No assessments available yet.
          </div>
        )}

        {assessments.map((a) => (
          <div key={a.instrument || a.id || a.name} style={cardStyle}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                  <h3 style={{
                    fontSize: 'var(--font-size-lg, 1.1rem)',
                    fontWeight: 600,
                    color: '#4A3F55',
                    margin: 0
                  }}>
                    {a.name || a.instrument}
                  </h3>
                  {a.is_due && <span style={badgeStyle('due')}>Due</span>}
                </div>
                {a.description && (
                  <p style={{
                    fontSize: 'var(--font-size-small, 0.875rem)',
                    color: '#6b5f7a',
                    margin: '6px 0 0',
                    lineHeight: 1.5
                  }}>
                    {a.description}
                  </p>
                )}
                {a.last_score !== undefined && a.last_score !== null && (
                  <p style={{
                    fontSize: 'var(--font-size-small, 0.8rem)',
                    color: '#9B8AA5',
                    margin: '8px 0 0',
                    fontWeight: 500
                  }}>
                    Last score: {a.last_score}
                    {a.last_severity && ` (${a.last_severity})`}
                    {a.last_taken && ` \u2014 ${new Date(a.last_taken).toLocaleDateString()}`}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={() => loadHistory(a.instrument || a.id)}
                  style={buttonStyle('secondary')}
                >
                  History
                </button>
                <button
                  onClick={() => startAssessment(a.instrument || a.id)}
                  style={buttonStyle('primary')}
                >
                  {a.is_due ? 'Take Now' : 'Start'}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* History chart overlay */}
        {historyInstrument && !activeInstrument && (
          <div style={{ marginTop: 'var(--spacing-md, 16px)' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#4A3F55', margin: 0 }}>
                {historyInstrument} History
              </h3>
              <button
                onClick={() => { setHistoryInstrument(null); setHistory([]); }}
                style={{ background: 'none', border: 'none', color: '#9B8AA5', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                &times;
              </button>
            </div>
            <HistoryChart history={history} loading={historyLoading} instrument={historyInstrument} />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * CrisisBanner — rendered on the results screen when a validated
 * instrument fires its crisis flag (currently only PHQ-9 Q9 at value
 * >= 1; "thoughts you would be better off dead, or of hurting yourself").
 *
 * Visual goals:
 *   - Soft amber, NOT alarming red. Trauma-informed: a user who just
 *     endorsed Q9 does not need shock colour on top of the moment.
 *   - Clearly distinct from the score card so it cannot be missed by
 *     glancing over the page.
 *   - Each resource is tappable on mobile (tel: for phone-shaped
 *     contacts; plain text for SMS instructions like "text SHOUT to
 *     85258" since sms: deep-links are unreliable across platforms).
 *
 * Copy is locked to what the backend sends (`crisis_message`) so the
 * UI stays consistent with whatever SafetyFilter / future locale work
 * decides — no second source of truth.
 */
const CrisisBanner = ({ message, resources, alertId }) => {
  const looksLikePhone = (s) => /^\s*[\d\s+()-]+\s*$/.test(String(s));
  const telHref = (s) => `tel:${String(s).replace(/[^\d+]/g, '')}`;

  // 2026-06-18: acknowledge loop. Marks the safety_alerts row as
  // acknowledged so Luna's gentle session-open greeting (24h window)
  // returns to default for new sessions. Resources stay visible — the
  // user may still want them — but the call-to-action goes quiet.
  // If the alertId is missing (recordCrisisAlert failed on the server)
  // we hide the button entirely; the banner still shows resources.
  const [acked, setAcked] = React.useState(false);
  const [acking, setAcking] = React.useState(false);
  const [ackError, setAckError] = React.useState(null);

  const onAcknowledge = async () => {
    if (!alertId || acking) return;
    setAcking(true);
    setAckError(null);
    try {
      await insightsAPI.acknowledgeSafetyAlert(alertId, { actionTaken: 'reviewed_resources' });
      setAcked(true);
    } catch (e) {
      setAckError('Could not mark as acknowledged. The resources are still here whenever you need them.');
    } finally {
      setAcking(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Crisis support resources"
      style={{
        background: 'linear-gradient(180deg, #FFF8EC 0%, #FFEFD4 100%)',
        border: '1px solid #E0B173',
        borderLeft: '5px solid #C9821F',
        borderRadius: 'var(--radius-lg, 16px)',
        padding: 'var(--spacing-lg, 20px)',
        marginBottom: 'var(--spacing-md, 16px)',
        boxShadow: '0 2px 12px rgba(201, 130, 31, 0.10)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span aria-hidden="true" style={{ fontSize: '1.4rem', lineHeight: 1.2, marginTop: 2 }}>💛</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '1.05rem',
            fontWeight: 600,
            color: '#7B4A0E',
            marginBottom: '6px',
          }}>
            You are not alone in this.
          </div>
          {message && (
            <p style={{
              fontSize: '0.95rem',
              color: '#5A3A0E',
              lineHeight: 1.55,
              margin: '0 0 12px',
            }}>
              {message}
            </p>
          )}
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            {resources.map((r, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'baseline',
                  gap: '6px',
                  fontSize: '0.92rem',
                  color: '#4A3F55',
                }}
              >
                <strong style={{ color: '#4A3F55' }}>{r.name}</strong>
                <span aria-hidden="true">—</span>
                {looksLikePhone(r.contact) ? (
                  <a
                    href={telHref(r.contact)}
                    style={{
                      color: '#7B4A0E',
                      fontWeight: 600,
                      textDecoration: 'underline',
                    }}
                  >
                    {r.contact}
                  </a>
                ) : (
                  <span style={{ color: '#7B4A0E', fontWeight: 600 }}>{r.contact}</span>
                )}
                {r.note && (
                  <span style={{ color: '#6b5f7a', fontSize: '0.85rem' }}>({r.note})</span>
                )}
              </li>
            ))}
          </ul>
          {!acked ? (
            <>
              <p style={{
                marginTop: '12px',
                fontSize: '0.85rem',
                color: '#6b5f7a',
                fontStyle: 'italic',
              }}>
                Your score has been saved. You can choose to stay on this page or step away.
              </p>
              {alertId && (
                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={onAcknowledge}
                    disabled={acking}
                    style={{
                      padding: '6px 14px',
                      border: '1px solid #C9821F',
                      background: 'white',
                      color: '#7B4A0E',
                      borderRadius: 'var(--radius-md, 8px)',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      cursor: acking ? 'not-allowed' : 'pointer',
                      opacity: acking ? 0.6 : 1,
                    }}
                  >
                    {acking ? 'Saving…' : "I've noted these — thank you"}
                  </button>
                  {ackError && (
                    <span style={{ fontSize: '0.82rem', color: '#7B4A0E' }}>{ackError}</span>
                  )}
                </div>
              )}
            </>
          ) : (
            <p style={{
              marginTop: '12px',
              fontSize: '0.88rem',
              color: '#4B7B3E',
              fontWeight: 500,
            }}>
              ✓ Acknowledged. These numbers stay here whenever you want them.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * HistoryChart - Simple bar chart for assessment history using div heights
 */
const HistoryChart = ({ history, loading, instrument }) => {
  if (loading) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: 'var(--radius-lg, 16px)',
        padding: '24px',
        textAlign: 'center',
        color: '#9B8AA5',
        boxShadow: '0 2px 12px rgba(74, 63, 85, 0.06)'
      }}>
        Loading history...
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: 'var(--radius-lg, 16px)',
        padding: '24px',
        textAlign: 'center',
        color: '#9B8AA5',
        boxShadow: '0 2px 12px rgba(74, 63, 85, 0.06)'
      }}>
        No history yet for {instrument}.
      </div>
    );
  }

  const maxScore = Math.max(...history.map(h => h.score || h.total_score || 0), 1);
  const chartHeight = 160;

  const getBarColor = (severity) => {
    const s = (severity || '').toLowerCase();
    if (s === 'minimal' || s === 'normal') return '#7BC47B';
    if (s === 'mild') return '#A8C5A8';
    if (s === 'moderate') return '#F5D89A';
    if (s.includes('severe')) return '#E8A5A5';
    return '#B8A9C9';
  };

  // Reliable Change Index for the latest assessment vs the previous one (ADR-0011).
  // history is newest-first, so history[0].reliable_change is the latest change.
  const latestRC = history[0] && history[0].reliable_change;
  const rcStyles = {
    reliable_improvement:   { bg: '#E6F4EA', fg: '#1E7E34', icon: '✓', label: 'Reliable improvement since your last check' },
    reliable_deterioration: { bg: '#FCE8E6', fg: '#C5221F', icon: '▲', label: 'Reliable deterioration since your last check' },
    no_reliable_change:     { bg: '#F0EBF4', fg: '#6B5B73', icon: '≈', label: 'Change is within measurement noise' },
  };
  const rc = latestRC ? (rcStyles[latestRC.direction] || rcStyles.no_reliable_change) : null;

  return (
    <div style={{
      background: '#fff',
      borderRadius: 'var(--radius-lg, 16px)',
      padding: '24px',
      boxShadow: '0 2px 12px rgba(74, 63, 85, 0.06)'
    }}>
      {rc && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: rc.bg, color: rc.fg,
            borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
            fontSize: '0.9rem', fontWeight: 600
          }}
          title={`Reliable Change Index ${latestRC.rci} (a change counts as reliable when |RCI| ≥ ${latestRC.threshold}). Compares your two most recent ${instrument} scores against this instrument's measurement error.`}
        >
          <span aria-hidden="true">{rc.icon}</span>
          <span>{rc.label}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 500, opacity: 0.75, fontSize: '0.8rem' }}>
            RCI {latestRC.rci}
          </span>
        </div>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px',
        height: `${chartHeight}px`,
        borderBottom: '2px solid #f0ebf4',
        paddingBottom: '4px'
      }}>
        {history.slice(-12).map((entry, i) => {
          const score = entry.score || entry.total_score || 0;
          const height = Math.max(8, (score / maxScore) * (chartHeight - 24));
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-end',
                height: '100%'
              }}
            >
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                color: '#4A3F55',
                marginBottom: '4px'
              }}>
                {score}
              </span>
              <div
                style={{
                  width: '100%',
                  maxWidth: '36px',
                  height: `${height}px`,
                  background: `linear-gradient(180deg, ${getBarColor(entry.severity)}90, ${getBarColor(entry.severity)})`,
                  borderRadius: '6px 6px 0 0',
                  transition: 'height 0.3s ease'
                }}
                title={`${score} - ${entry.severity || 'N/A'}`}
              />
            </div>
          );
        })}
      </div>
      {/* Date labels */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
        {history.slice(-12).map((entry, i) => (
          <div key={i} style={{
            flex: 1,
            textAlign: 'center',
            fontSize: '0.6rem',
            color: '#9B8AA5'
          }}>
            {entry.date ? new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Assessments;

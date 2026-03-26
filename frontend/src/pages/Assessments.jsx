import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import api from '../services/api';

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

  return (
    <div style={{
      background: '#fff',
      borderRadius: 'var(--radius-lg, 16px)',
      padding: '24px',
      boxShadow: '0 2px 12px rgba(74, 63, 85, 0.06)'
    }}>
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

import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import api from '../services/api';

/**
 * Predictions - Mood predictions dashboard (v2 ML-based)
 * Shows today + next 3 days forecast, model info, and training controls
 */
const Predictions = () => {
  const [predictions, setPredictions] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insufficientData, setInsufficientData] = useState(null);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState(null);
  const [checkedActions, setCheckedActions] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setInsufficientData(null);

    try {
      const [forecastRes, modelRes] = await Promise.all([
        api.get('/predictions/v2', { params: { days: 3 } }),
        api.get('/predictions/v2/model').catch(() => null)
      ]);

      const forecastData = forecastRes.data || forecastRes;

      if (forecastData.status === 'insufficient_data' || forecastData.insufficient_data) {
        setInsufficientData({
          currentDays: forecastData.current_days || forecastData.currentEntries || 0,
          requiredDays: forecastData.required_days || 14,
          message: forecastData.message
        });
        setPredictions([]);
      } else {
        setPredictions(forecastData.predictions || forecastData || []);
      }

      if (modelRes) {
        setModelInfo(modelRes.data?.model || modelRes.data || modelRes);
      }
    } catch (err) {
      setError(err.message || 'Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    setTrainResult(null);
    try {
      const res = await api.post('/predictions/v2/train');
      setTrainResult(res.data || res);
      await loadData();
    } catch (err) {
      setTrainResult({ error: err.message || 'Training failed' });
    } finally {
      setTraining(false);
    }
  };

  const toggleAction = (predIndex, actionIndex) => {
    const key = `${predIndex}-${actionIndex}`;
    setCheckedActions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ---- Helpers ----
  const getMoodEmoji = (mood) => {
    if (mood >= 8) return '\u2600\uFE0F';  // sun
    if (mood >= 6) return '\u{1F60A}';      // smiling
    if (mood >= 4) return '\u{1F610}';      // neutral
    if (mood >= 3) return '\u{1F615}';      // confused
    return '\u{1F622}';                      // crying
  };

  const getMoodLabel = (mood) => {
    if (mood >= 8) return 'Great';
    if (mood >= 6) return 'Good';
    if (mood >= 4) return 'Okay';
    if (mood >= 3) return 'Low';
    return 'Difficult';
  };

  const getConfidenceColor = (confidence) => {
    const pct = typeof confidence === 'number' && confidence <= 1 ? confidence * 100 : confidence;
    if (pct > 70) return '#7BC47B';
    if (pct > 50) return '#F5D89A';
    return '#E8A5A5';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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

  const btnStyle = (variant = 'primary', disabled = false) => ({
    padding: '10px 20px',
    border: 'none',
    borderRadius: 'var(--radius-md, 10px)',
    fontWeight: 600,
    fontSize: 'var(--font-size-small, 0.875rem)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
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

  const pillStyle = {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: 500,
    background: '#f0ebf4',
    color: '#6b5f7a',
    marginRight: '6px',
    marginBottom: '4px'
  };

  // ---- Insufficient Data View ----
  if (!loading && insufficientData) {
    const daysLeft = Math.max(0, (insufficientData.requiredDays || 14) - (insufficientData.currentDays || 0));
    return (
      <div style={pageStyle}>
        <Navigation />
        <div style={containerStyle}>
          <h1 style={headerStyle}>Mood Predictions</h1>
          <div style={{ ...cardStyle, textAlign: 'center', padding: 'var(--spacing-xl, 40px)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
              <span role="img" aria-label="Crystal ball">{'\u{1F52E}'}</span>
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#4A3F55', marginBottom: '12px' }}>
              Predictions Coming Soon
            </h2>
            <p style={{ color: '#6b5f7a', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '16px' }}>
              {insufficientData.message || `Keep tracking for ${daysLeft} more day${daysLeft !== 1 ? 's' : ''} to unlock mood predictions.`}
            </p>
            <div style={{
              width: '100%',
              maxWidth: '300px',
              margin: '0 auto',
              height: '10px',
              background: '#f0ebf4',
              borderRadius: '5px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, ((insufficientData.currentDays || 0) / (insufficientData.requiredDays || 14)) * 100)}%`,
                background: 'linear-gradient(90deg, #9B8AA5, #B8A9C9)',
                borderRadius: '5px',
                transition: 'width 0.4s ease'
              }} />
            </div>
            <p style={{ fontSize: '0.8rem', color: '#9B8AA5', marginTop: '8px' }}>
              {insufficientData.currentDays || 0} / {insufficientData.requiredDays || 14} days tracked
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <Navigation />
      <div style={containerStyle}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: 'var(--spacing-lg, 24px)'
        }}>
          <h1 style={{ ...headerStyle, marginBottom: 0 }}>Mood Predictions</h1>
          <button
            onClick={handleTrain}
            disabled={training}
            style={btnStyle('secondary', training)}
          >
            {training ? 'Training...' : 'Train Model'}
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9B8AA5' }}>
            Loading predictions...
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

        {/* Training result toast */}
        {trainResult && (
          <div style={{
            ...cardStyle,
            background: trainResult.error ? '#E8A5A510' : '#A8C5A810',
            borderColor: trainResult.error ? '#E8A5A540' : '#A8C5A840',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{
              color: trainResult.error ? '#c0564e' : '#5a9a5a',
              fontSize: '0.875rem',
              fontWeight: 500
            }}>
              {trainResult.error || trainResult.message || 'Model trained successfully!'}
            </span>
            <button
              onClick={() => setTrainResult(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8AA5', fontSize: '1.1rem' }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Prediction Cards */}
        {!loading && predictions.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--spacing-md, 16px)',
            marginBottom: 'var(--spacing-xl, 32px)'
          }}>
            {predictions.map((pred, predIndex) => {
              const mood = pred.predicted_mood || pred.mood || 5;
              const confidence = pred.confidence || 0;
              const confPct = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
              const confColor = getConfidenceColor(confPct);
              const factors = pred.contributing_factors || pred.factors || [];
              const actions = pred.preventive_actions || pred.actions || [];

              return (
                <div key={predIndex} style={cardStyle}>
                  {/* Date header */}
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#9B8AA5',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {formatDate(pred.date)}
                  </div>

                  {/* Mood display */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px'
                  }}>
                    <span style={{ fontSize: '2.5rem' }} role="img" aria-label={getMoodLabel(mood)}>
                      {getMoodEmoji(mood)}
                    </span>
                    <div>
                      <div style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: '#4A3F55'
                      }}>
                        {typeof mood === 'number' ? mood.toFixed(1) : mood}
                      </div>
                      <div style={{
                        fontSize: '0.8rem',
                        color: '#6b5f7a',
                        fontWeight: 500
                      }}>
                        {getMoodLabel(mood)}
                      </div>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      color: '#9B8AA5',
                      marginBottom: '4px'
                    }}>
                      <span>Confidence</span>
                      <span style={{ fontWeight: 600, color: confColor }}>{confPct}%</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '6px',
                      background: '#f0ebf4',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${confPct}%`,
                        background: confColor,
                        borderRadius: '3px',
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>

                  {/* Contributing factors */}
                  {factors.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#4A3F55',
                        marginBottom: '6px'
                      }}>
                        Contributing Factors
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {factors.map((f, i) => (
                          <span key={i} style={pillStyle}>
                            {typeof f === 'string' ? f : f.name || f.factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preventive actions */}
                  {actions.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#4A3F55',
                        marginBottom: '6px'
                      }}>
                        Suggested Actions
                      </div>
                      {actions.map((action, actionIndex) => {
                        const key = `${predIndex}-${actionIndex}`;
                        const isChecked = checkedActions[key] || false;
                        const actionText = typeof action === 'string' ? action : action.text || action.action;
                        return (
                          <label
                            key={actionIndex}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '8px',
                              padding: '6px 0',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              color: isChecked ? '#9B8AA5' : '#4A3F55',
                              textDecoration: isChecked ? 'line-through' : 'none',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleAction(predIndex, actionIndex)}
                              style={{
                                width: '16px',
                                height: '16px',
                                accentColor: '#9B8AA5',
                                marginTop: '1px',
                                flexShrink: 0
                              }}
                            />
                            <span>{actionText}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Model Info Card */}
        {modelInfo && (
          <div style={cardStyle}>
            <h3 style={{
              fontSize: 'var(--font-size-lg, 1.1rem)',
              fontWeight: 600,
              color: '#4A3F55',
              marginBottom: '16px'
            }}>
              Model Information
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '16px'
            }}>
              {modelInfo.training_data_points !== undefined && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#9B8AA5', marginBottom: '4px' }}>
                    Training Data
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4A3F55' }}>
                    {modelInfo.training_data_points} entries
                  </div>
                </div>
              )}
              {modelInfo.accuracy !== undefined && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#9B8AA5', marginBottom: '4px' }}>
                    Accuracy
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4A3F55' }}>
                    {typeof modelInfo.accuracy === 'number' && modelInfo.accuracy <= 1
                      ? `${Math.round(modelInfo.accuracy * 100)}%`
                      : `${modelInfo.accuracy}%`
                    }
                  </div>
                </div>
              )}
              {(modelInfo.last_trained || modelInfo.last_trained_at) && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#9B8AA5', marginBottom: '4px' }}>
                    Last Trained
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#4A3F55' }}>
                    {new Date(modelInfo.last_trained || modelInfo.last_trained_at).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </div>
                </div>
              )}
              {modelInfo.algorithm && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#9B8AA5', marginBottom: '4px' }}>
                    Algorithm
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#4A3F55' }}>
                    {modelInfo.algorithm}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && predictions.length === 0 && !insufficientData && !error && (
          <div style={{ ...cardStyle, textAlign: 'center', color: '#9B8AA5', padding: '32px' }}>
            No predictions available. Try training the model first.
          </div>
        )}
      </div>
    </div>
  );
};

export default Predictions;

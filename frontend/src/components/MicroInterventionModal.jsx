import React, { useState, useEffect, useRef } from 'react';
import { interventionsAPI } from '../services/api';

/**
 * MicroInterventionModal - Full-screen intervention experience
 * Guides user through therapeutic exercises with timer and steps
 */
const MicroInterventionModal = ({ intervention, onComplete, onSkip, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(intervention?.duration || 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [rating, setRating] = useState(null);
  const timerRef = useRef(null);

  const content = intervention?.content || {};
  const steps = content.steps || [];
  const hasSteps = steps.length > 0;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  const startExercise = () => {
    setIsRunning(true);
  };

  const handleComplete = () => {
    setIsCompleted(true);
    setIsRunning(false);
  };

  const handleSubmitRating = async () => {
    try {
      await interventionsAPI.complete(intervention.interventionId, rating);
    } catch (err) {
      console.error('Failed to record completion:', err);
    }
    if (onComplete) {
      onComplete({ interventionId: intervention.interventionId, rating });
    }
  };

  const handleSkip = async () => {
    try {
      await interventionsAPI.skip(intervention.interventionId);
    } catch (err) {
      console.error('Failed to record skip:', err);
    }
    if (onSkip) {
      onSkip();
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 'var(--spacing-md)'
  };

  const modalStyle = {
    background: intervention?.color || 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-xl)',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    textAlign: 'center',
    boxShadow: 'var(--shadow-xl)',
    animation: 'scaleIn 0.3s ease'
  };

  const iconStyle = {
    fontSize: '4rem',
    marginBottom: 'var(--spacing-md)'
  };

  const titleStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-sm)'
  };

  const descriptionStyle = {
    fontSize: 'var(--font-size-base)',
    color: 'var(--text-secondary)',
    marginBottom: 'var(--spacing-lg)'
  };

  // Completed State with Rating
  if (isCompleted) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={iconStyle}>✨</div>
          <h2 style={titleStyle}>Well Done!</h2>
          <p style={descriptionStyle}>
            You completed the {intervention?.title}. How did it feel?
          </p>

          {/* Rating */}
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <p style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>
              Rate this exercise:
            </p>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 'var(--spacing-sm)'
            }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  style={{
                    fontSize: '2rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: rating && star <= rating ? 1 : 0.3,
                    transform: rating && star <= rating ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all var(--transition-base)'
                  }}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmitRating}
            style={{
              padding: 'var(--spacing-md) var(--spacing-xl)',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'var(--font-size-base)',
              width: '100%'
            }}
          >
            Done
          </button>
        </div>

        <style>{`
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    );
  }

  // Active Exercise State
  if (isRunning || currentStep > 0) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          {/* Timer */}
          <div style={{
            fontSize: '3rem',
            fontWeight: 700,
            color: 'var(--primary-color)',
            marginBottom: 'var(--spacing-lg)',
            fontFamily: 'monospace'
          }}>
            {formatTime(timeRemaining)}
          </div>

          {/* Progress */}
          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(0,0,0,0.1)',
            borderRadius: '4px',
            marginBottom: 'var(--spacing-xl)',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${((intervention?.duration - timeRemaining) / intervention?.duration) * 100}%`,
              height: '100%',
              background: 'var(--primary-color)',
              transition: 'width 1s linear'
            }} />
          </div>

          {/* Step Content */}
          {hasSteps ? (
            <div>
              <div style={{
                marginBottom: 'var(--spacing-md)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-size-small)'
              }}>
                Step {currentStep + 1} of {steps.length}
              </div>

              <div style={{
                fontSize: 'var(--font-size-xl)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--spacing-xl)',
                minHeight: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--spacing-md)'
              }}>
                {steps[currentStep]}
              </div>

              <div style={{
                display: 'flex',
                gap: 'var(--spacing-md)',
                justifyContent: 'center'
              }}>
                {currentStep > 0 && (
                  <button
                    onClick={prevStep}
                    style={{
                      padding: 'var(--spacing-sm) var(--spacing-lg)',
                      background: 'rgba(0,0,0,0.1)',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      color: 'var(--text-primary)'
                    }}
                  >
                    ← Back
                  </button>
                )}
                <button
                  onClick={nextStep}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-lg)',
                    background: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {currentStep < steps.length - 1 ? 'Next →' : 'Complete ✓'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{
                fontSize: 'var(--font-size-lg)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--spacing-md)'
              }}>
                {content.instruction || content.prompt || intervention?.description}
              </p>

              {content.follow_up && (
                <p style={{
                  fontSize: 'var(--font-size-base)',
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic'
                }}>
                  {content.follow_up}
                </p>
              )}

              <button
                onClick={handleComplete}
                style={{
                  marginTop: 'var(--spacing-xl)',
                  padding: 'var(--spacing-md) var(--spacing-xl)',
                  background: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                I'm Done
              </button>
            </div>
          )}

          {/* Skip Button */}
          <button
            onClick={handleSkip}
            style={{
              marginTop: 'var(--spacing-lg)',
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Skip for now
          </button>
        </div>

        <style>{`
          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    );
  }

  // Initial State - Show Intervention Intro
  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={iconStyle}>{intervention?.icon || '🧘'}</div>
        <h2 style={titleStyle}>{intervention?.title}</h2>
        <p style={descriptionStyle}>{intervention?.description}</p>

        {/* Duration Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          padding: 'var(--spacing-xs) var(--spacing-md)',
          background: 'rgba(0,0,0,0.05)',
          borderRadius: 'var(--radius-full)',
          marginBottom: 'var(--spacing-xl)',
          fontSize: 'var(--font-size-small)',
          color: 'var(--text-secondary)'
        }}>
          <span>⏱️</span>
          <span>{Math.ceil(intervention?.duration / 60)} min</span>
          <span>•</span>
          <span style={{ textTransform: 'capitalize' }}>{intervention?.effortLevel || 'low'} effort</span>
        </div>

        {/* Preview of steps if available */}
        {hasSteps && (
          <div style={{
            background: 'rgba(0,0,0,0.03)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-xl)',
            textAlign: 'left'
          }}>
            <p style={{
              fontSize: 'var(--font-size-small)',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--spacing-sm)'
            }}>
              What you'll do:
            </p>
            <ul style={{
              margin: 0,
              paddingLeft: 'var(--spacing-lg)',
              fontSize: 'var(--font-size-small)',
              color: 'var(--text-secondary)'
            }}>
              {steps.slice(0, 3).map((step, i) => (
                <li key={i} style={{ marginBottom: '4px' }}>{step}</li>
              ))}
              {steps.length > 3 && <li>...</li>}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)'
        }}>
          <button
            onClick={startExercise}
            style={{
              padding: 'var(--spacing-md) var(--spacing-xl)',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'var(--font-size-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--spacing-xs)'
            }}
          >
            <span>▶️</span> Start Exercise
          </button>

          <button
            onClick={handleSkip}
            style={{
              padding: 'var(--spacing-md)',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-small)'
            }}
          >
            Maybe Later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

/**
 * InterventionCard - Compact intervention suggestion
 */
export const InterventionCard = ({ intervention, onClick }) => {
  if (!intervention) return null;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-md)',
        background: intervention.color || 'var(--primary-light)',
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        transition: 'all var(--transition-base)'
      }}
    >
      <span style={{ fontSize: '2rem' }}>{intervention.icon || '🧘'}</span>
      <div style={{ flex: 1 }}>
        <p style={{
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: 0,
          marginBottom: '2px'
        }}>
          {intervention.title}
        </p>
        <p style={{
          fontSize: 'var(--font-size-small)',
          color: 'var(--text-secondary)',
          margin: 0
        }}>
          {Math.ceil(intervention.duration / 60)} min • {intervention.type}
        </p>
      </div>
      <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
        →
      </span>
    </div>
  );
};

export default MicroInterventionModal;

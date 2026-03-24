import React, { useState } from 'react';

/**
 * GroundingExercise - 5-4-3-2-1 Senses grounding technique
 * Helps bring users back to the present moment during anxiety or dissociation
 */
const GroundingExercise = ({ onComplete, onClose }) => {
  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState({});
  const [currentInput, setCurrentInput] = useState('');
  const [inputIndex, setInputIndex] = useState(0);

  const steps = [
    {
      sense: 'See',
      icon: '👁️',
      emoji: '👀',
      prompt: 'Name 5 things you can see right now',
      count: 5,
      color: '#9B8AA5',
      placeholder: 'I can see...'
    },
    {
      sense: 'Touch',
      icon: '🤚',
      emoji: '✋',
      prompt: 'Name 4 things you can physically feel',
      count: 4,
      color: '#F5C9B3',
      placeholder: 'I can feel...'
    },
    {
      sense: 'Hear',
      icon: '👂',
      emoji: '👂',
      prompt: 'Name 3 things you can hear',
      count: 3,
      color: '#A8C5A8',
      placeholder: 'I can hear...'
    },
    {
      sense: 'Smell',
      icon: '👃',
      emoji: '👃',
      prompt: 'Name 2 things you can smell',
      count: 2,
      color: '#F5D89A',
      placeholder: 'I can smell...'
    },
    {
      sense: 'Taste',
      icon: '👅',
      emoji: '👅',
      prompt: 'Name 1 thing you can taste',
      count: 1,
      color: '#E8A5A5',
      placeholder: 'I can taste...'
    }
  ];

  const currentStep = steps[step];
  const isComplete = step >= steps.length;

  const handleAddResponse = () => {
    if (!currentInput.trim()) return;

    const key = `${step}-${inputIndex}`;
    setResponses(prev => ({ ...prev, [key]: currentInput.trim() }));
    setCurrentInput('');

    if (inputIndex + 1 >= currentStep.count) {
      // Move to next step
      if (step + 1 >= steps.length) {
        // Exercise complete
        setStep(steps.length);
      } else {
        setStep(step + 1);
        setInputIndex(0);
      }
    } else {
      setInputIndex(inputIndex + 1);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddResponse();
    }
  };

  const handleComplete = () => {
    onComplete?.();
  };

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 'var(--spacing-xl)',
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    maxWidth: '500px',
    margin: '0 auto',
    position: 'relative'
  };

  const progressBarStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: 'var(--spacing-md)',
    marginBottom: 'var(--spacing-xl)',
    width: '100%'
  };

  const dotStyle = (index) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
    opacity: index <= step ? 1 : 0.4,
    transform: index === step ? 'scale(1.1)' : 'scale(1)',
    transition: 'all var(--transition-base)'
  });

  const dotCircleStyle = (index) => ({
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: index < step
      ? 'var(--success-color)'
      : index === step
        ? steps[index].color
        : 'var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
    boxShadow: index === step ? `0 0 15px ${steps[index].color}60` : 'none'
  });

  return (
    <div style={containerStyle}>
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 'var(--spacing-md)',
            right: 'var(--spacing-md)',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'var(--text-secondary)'
          }}
          aria-label="Close"
        >
          ×
        </button>
      )}

      {/* Title */}
      <h3 style={{
        fontSize: 'var(--font-size-xl)',
        fontWeight: 600,
        marginBottom: 'var(--spacing-xs)',
        color: 'var(--text-primary)'
      }}>
        5-4-3-2-1 Grounding
      </h3>
      <p style={{
        color: 'var(--text-secondary)',
        marginBottom: 'var(--spacing-lg)',
        textAlign: 'center'
      }}>
        Connect with your senses to return to the present moment
      </p>

      {/* Progress dots */}
      <div style={progressBarStyle}>
        {steps.map((s, i) => (
          <div key={i} style={dotStyle(i)}>
            <div style={dotCircleStyle(i)}>
              {i < step ? '✓' : s.icon}
            </div>
            <span style={{
              fontSize: '0.7rem',
              color: i === step ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}>
              {s.count}
            </span>
          </div>
        ))}
      </div>

      {/* Current Step */}
      {!isComplete && (
        <div style={{ width: '100%', textAlign: 'center' }}>
          {/* Step Card */}
          <div style={{
            background: `linear-gradient(135deg, ${currentStep.color}20, ${currentStep.color}10)`,
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-xl)',
            marginBottom: 'var(--spacing-lg)',
            border: `2px solid ${currentStep.color}40`
          }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 'var(--spacing-sm)' }}>
              {currentStep.emoji}
            </span>
            <h4 style={{
              fontSize: 'var(--font-size-large)',
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-xs)'
            }}>
              {currentStep.prompt}
            </h4>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-small)'
            }}>
              {inputIndex + 1} of {currentStep.count}
            </p>
          </div>

          {/* Collected responses for this step */}
          {Object.keys(responses)
            .filter(key => key.startsWith(`${step}-`))
            .length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--spacing-xs)',
              justifyContent: 'center',
              marginBottom: 'var(--spacing-md)'
            }}>
              {Object.entries(responses)
                .filter(([key]) => key.startsWith(`${step}-`))
                .map(([key, value]) => (
                  <span
                    key={key}
                    style={{
                      padding: 'var(--spacing-xs) var(--spacing-sm)',
                      background: currentStep.color,
                      color: 'white',
                      borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--font-size-small)'
                    }}
                  >
                    {value}
                  </span>
                ))}
            </div>
          )}

          {/* Input */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={currentStep.placeholder}
              autoFocus
              style={{
                flex: 1,
                padding: 'var(--spacing-md)',
                border: `2px solid ${currentStep.color}40`,
                borderRadius: 'var(--radius-lg)',
                fontSize: 'var(--font-size-base)',
                background: 'var(--background)',
                color: 'var(--text-primary)'
              }}
            />
            <button
              onClick={handleAddResponse}
              disabled={!currentInput.trim()}
              style={{
                padding: 'var(--spacing-md) var(--spacing-lg)',
                background: currentInput.trim()
                  ? `linear-gradient(135deg, ${currentStep.color}, ${currentStep.color}CC)`
                  : 'var(--border)',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                color: 'white',
                fontWeight: 600,
                cursor: currentInput.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              Add
            </button>
          </div>

          <p style={{
            fontSize: 'var(--font-size-small)',
            color: 'var(--text-secondary)',
            marginTop: 'var(--spacing-sm)'
          }}>
            Press Enter or tap Add
          </p>
        </div>
      )}

      {/* Completion */}
      {isComplete && (
        <div style={{ textAlign: 'center' }} className="animate-fade-in">
          <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>
            🌟
          </div>
          <h4 style={{
            fontSize: 'var(--font-size-xl)',
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-sm)'
          }}>
            Beautifully done!
          </h4>
          <p style={{
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-xl)'
          }}>
            You've reconnected with the present moment.
            Take a deep breath and notice how you feel now.
          </p>

          {/* Summary */}
          <div style={{
            background: 'var(--background)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-lg)',
            marginBottom: 'var(--spacing-xl)',
            textAlign: 'left'
          }}>
            <h5 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-primary)' }}>
              What you noticed:
            </h5>
            {steps.map((s, stepIndex) => (
              <div key={stepIndex} style={{ marginBottom: 'var(--spacing-sm)' }}>
                <span style={{ marginRight: 'var(--spacing-xs)' }}>{s.icon}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-small)' }}>
                  {Object.entries(responses)
                    .filter(([key]) => key.startsWith(`${stepIndex}-`))
                    .map(([_, value]) => value)
                    .join(', ')}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleComplete}
            style={{
              padding: 'var(--spacing-md) var(--spacing-xxl)',
              background: 'linear-gradient(135deg, var(--accent-color), var(--accent-hover))',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              color: 'white',
              fontSize: 'var(--font-size-base)',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(168, 197, 168, 0.4)'
            }}
          >
            I feel more grounded
          </button>
        </div>
      )}
    </div>
  );
};

export default GroundingExercise;

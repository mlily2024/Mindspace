import React, { useState, useEffect, useCallback } from 'react';

/**
 * BreathingExercise - Animated guided breathing component
 * Supports multiple techniques: 4-7-8, box breathing, calming breath
 */
const BreathingExercise = ({ technique = '4-7-8', onComplete, onClose }) => {
  const [phase, setPhase] = useState('ready'); // ready, inhale, hold, exhale, holdAfter, complete
  const [count, setCount] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const techniques = {
    '4-7-8': {
      name: '4-7-8 Breathing',
      description: 'Calming technique for anxiety and sleep',
      inhale: 4,
      hold: 7,
      exhale: 8,
      cycles: 4,
      color: '#9B8AA5'
    },
    'box': {
      name: 'Box Breathing',
      description: 'Grounding technique for stress',
      inhale: 4,
      hold: 4,
      exhale: 4,
      holdAfter: 4,
      cycles: 4,
      color: '#A8C5A8'
    },
    'calming': {
      name: 'Calming Breath',
      description: 'Simple technique for quick relief',
      inhale: 4,
      exhale: 6,
      cycles: 6,
      color: '#F5C9B3'
    }
  };

  const current = techniques[technique] || techniques['4-7-8'];

  // Reset when technique changes
  useEffect(() => {
    setPhase('ready');
    setCount(0);
    setCycle(0);
    setIsActive(false);
  }, [technique]);

  // Main timer logic
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setCount(prev => {
        const newCount = prev + 1;

        // Phase transitions based on current technique
        if (phase === 'inhale' && newCount >= current.inhale) {
          if (current.hold) {
            setPhase('hold');
          } else {
            setPhase('exhale');
          }
          return 0;
        }

        if (phase === 'hold' && newCount >= current.hold) {
          setPhase('exhale');
          return 0;
        }

        if (phase === 'exhale' && newCount >= current.exhale) {
          if (current.holdAfter) {
            setPhase('holdAfter');
            return 0;
          }

          // Check if cycles complete
          if (cycle + 1 >= current.cycles) {
            setPhase('complete');
            setIsActive(false);
            return 0;
          }

          setCycle(c => c + 1);
          setPhase('inhale');
          return 0;
        }

        if (phase === 'holdAfter' && newCount >= current.holdAfter) {
          if (cycle + 1 >= current.cycles) {
            setPhase('complete');
            setIsActive(false);
            return 0;
          }

          setCycle(c => c + 1);
          setPhase('inhale');
          return 0;
        }

        return newCount;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, phase, cycle, current]);

  const startExercise = useCallback(() => {
    setIsActive(true);
    setPhase('inhale');
    setCount(0);
    setCycle(0);
  }, []);

  const pauseExercise = useCallback(() => {
    setIsActive(false);
  }, []);

  const resetExercise = useCallback(() => {
    setIsActive(false);
    setPhase('ready');
    setCount(0);
    setCycle(0);
  }, []);

  const handleComplete = useCallback(() => {
    onComplete?.();
    resetExercise();
  }, [onComplete, resetExercise]);

  const getInstruction = () => {
    switch (phase) {
      case 'ready': return 'Tap to begin';
      case 'inhale': return 'Breathe in...';
      case 'hold': return 'Hold...';
      case 'exhale': return 'Breathe out...';
      case 'holdAfter': return 'Hold...';
      case 'complete': return 'Well done!';
      default: return '';
    }
  };

  const getPhaseTime = () => {
    switch (phase) {
      case 'inhale': return current.inhale;
      case 'hold': return current.hold;
      case 'exhale': return current.exhale;
      case 'holdAfter': return current.holdAfter;
      default: return 0;
    }
  };

  // Calculate circle scale based on phase
  const getCircleScale = () => {
    if (phase === 'inhale') return 1 + (count / current.inhale) * 0.3;
    if (phase === 'hold' || phase === 'holdAfter') return 1.3;
    if (phase === 'exhale') return 1.3 - (count / current.exhale) * 0.3;
    return 1;
  };

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 'var(--spacing-xl)',
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    maxWidth: '400px',
    margin: '0 auto',
    position: 'relative'
  };

  const circleContainerStyle = {
    position: 'relative',
    width: '220px',
    height: '220px',
    marginBottom: 'var(--spacing-xl)'
  };

  const circleStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${current.color} 0%, ${current.color}99 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    transform: `scale(${getCircleScale()})`,
    transition: 'transform 1s ease-in-out, box-shadow 0.5s ease',
    boxShadow: phase === 'complete'
      ? `0 0 60px ${current.color}80`
      : isActive
        ? `0 0 ${40 + count * 3}px ${current.color}60`
        : `0 0 30px ${current.color}40`
  };

  const innerStyle = {
    textAlign: 'center',
    color: 'white',
    textShadow: '0 2px 4px rgba(0,0,0,0.2)'
  };

  const instructionStyle = {
    display: 'block',
    fontSize: 'var(--font-size-xl)',
    fontWeight: 600,
    marginBottom: 'var(--spacing-xs)'
  };

  const countStyle = {
    display: 'block',
    fontSize: '2.5rem',
    fontWeight: 700
  };

  const progressStyle = {
    fontSize: 'var(--font-size-small)',
    color: 'var(--text-secondary)',
    marginBottom: 'var(--spacing-lg)'
  };

  const buttonStyle = {
    padding: 'var(--spacing-md) var(--spacing-xl)',
    background: `linear-gradient(135deg, ${current.color}, ${current.color}CC)`,
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    color: 'white',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: `0 4px 15px ${current.color}40`
  };

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
        {current.name}
      </h3>
      <p style={{
        color: 'var(--text-secondary)',
        marginBottom: 'var(--spacing-lg)',
        textAlign: 'center'
      }}>
        {current.description}
      </p>

      {/* Breathing Circle */}
      <div style={circleContainerStyle}>
        <div style={circleStyle}>
          <div style={innerStyle}>
            <span style={instructionStyle}>{getInstruction()}</span>
            {isActive && phase !== 'complete' && (
              <span style={countStyle}>{getPhaseTime() - count}</span>
            )}
            {phase === 'complete' && (
              <span style={{ fontSize: '3rem' }}>🌟</span>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      {isActive && phase !== 'complete' && (
        <div style={progressStyle}>
          Cycle {cycle + 1} of {current.cycles}
        </div>
      )}

      {/* Controls */}
      {phase === 'ready' && (
        <button style={buttonStyle} onClick={startExercise}>
          Start Breathing
        </button>
      )}

      {isActive && phase !== 'complete' && (
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          <button
            style={{ ...buttonStyle, background: 'var(--text-secondary)' }}
            onClick={pauseExercise}
          >
            Pause
          </button>
          <button
            style={{ ...buttonStyle, background: 'transparent', color: 'var(--text-secondary)', boxShadow: 'none' }}
            onClick={resetExercise}
          >
            Reset
          </button>
        </div>
      )}

      {!isActive && phase !== 'ready' && phase !== 'complete' && (
        <button style={buttonStyle} onClick={() => setIsActive(true)}>
          Resume
        </button>
      )}

      {phase === 'complete' && (
        <div style={{ textAlign: 'center' }}>
          <p style={{
            color: 'var(--text-primary)',
            marginBottom: 'var(--spacing-lg)',
            fontSize: 'var(--font-size-large)'
          }}>
            You did it! Take a moment to notice how you feel.
          </p>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center' }}>
            <button style={buttonStyle} onClick={startExercise}>
              Go Again
            </button>
            <button
              style={{ ...buttonStyle, background: 'var(--accent-color)' }}
              onClick={handleComplete}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Technique selector */}
      {phase === 'ready' && (
        <div style={{ marginTop: 'var(--spacing-xl)', width: '100%' }}>
          <p style={{
            fontSize: 'var(--font-size-small)',
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-sm)',
            textAlign: 'center'
          }}>
            Choose a technique:
          </p>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'center', flexWrap: 'wrap' }}>
            {Object.entries(techniques).map(([key, t]) => (
              <button
                key={key}
                onClick={() => {}}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-md)',
                  borderRadius: 'var(--radius-full)',
                  border: technique === key ? `2px solid ${t.color}` : '2px solid var(--border)',
                  background: technique === key ? `${t.color}20` : 'transparent',
                  color: technique === key ? t.color : 'var(--text-secondary)',
                  fontSize: 'var(--font-size-small)',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BreathingExercise;

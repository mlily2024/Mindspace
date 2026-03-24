import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import EmojiMoodPicker from '../components/EmojiMoodPicker';

/**
 * Journal - Guided journaling with therapeutic prompts
 * Supports gratitude, reflection, CBT, and self-compassion exercises
 * Fully responsive for mobile devices
 */
const Journal = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('mood'); // mood, prompt, followUp, moodAfter, complete
  const [prompt, setPrompt] = useState(null);
  const [entry, setEntry] = useState('');
  const [moodBefore, setMoodBefore] = useState(null);
  const [moodAfter, setMoodAfter] = useState(null);
  const [followUpIndex, setFollowUpIndex] = useState(0);
  const [followUpResponses, setFollowUpResponses] = useState([]);
  const [currentFollowUp, setCurrentFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);

  // Therapeutic prompts
  const prompts = [
    {
      id: 'gratitude',
      category: 'Gratitude',
      emoji: '🙏',
      color: '#A8C5A8',
      text: 'What are three things, big or small, that brought you a moment of peace today?',
      followUps: [
        'Why did each of these matter to you?',
        'How can you create more of these moments?'
      ]
    },
    {
      id: 'reflection',
      category: 'Reflection',
      emoji: '🪞',
      color: '#9B8AA5',
      text: 'What emotion has been most present for you today? Where do you feel it in your body?',
      followUps: [
        'What might this emotion be trying to tell you?',
        'What does this feeling need right now?'
      ]
    },
    {
      id: 'cbt',
      category: 'Thought Challenge',
      emoji: '💭',
      color: '#F5C9B3',
      text: 'What thought has been bothering you most today? Let\'s examine it together.',
      followUps: [
        'What evidence supports this thought?',
        'What evidence challenges it?',
        'What would you tell a friend with this thought?'
      ]
    },
    {
      id: 'self_compassion',
      category: 'Self-Compassion',
      emoji: '💜',
      color: '#E8A5A5',
      text: 'If your best friend was going through exactly what you\'re experiencing, what would you say to them?',
      followUps: [
        'Can you offer yourself the same kindness?',
        'What do you need to hear right now?'
      ]
    },
    {
      id: 'goals',
      category: 'Looking Ahead',
      emoji: '🌱',
      color: '#F5D89A',
      text: 'What\'s one small thing you could do tomorrow that future-you would thank you for?',
      followUps: [
        'What might get in the way?',
        'How will you overcome that?'
      ]
    }
  ];

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Select a random prompt or based on time of day
    const hour = new Date().getHours();
    let selectedPrompt;

    if (hour < 12) {
      // Morning - goals or gratitude
      selectedPrompt = prompts.find(p => p.id === 'goals' || p.id === 'gratitude');
    } else if (hour > 20) {
      // Evening - reflection or gratitude
      selectedPrompt = prompts.find(p => p.id === 'reflection' || p.id === 'gratitude');
    } else {
      // Random during the day
      selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    }

    setPrompt(selectedPrompt);
  }, []);

  const handleMoodSelect = (mood) => {
    setMoodBefore(mood);
    setStep('prompt');
  };

  const handleSubmitEntry = () => {
    if (prompt.followUps?.length > 0) {
      setStep('followUp');
    } else {
      setStep('moodAfter');
    }
  };

  const handleFollowUpSubmit = () => {
    if (currentFollowUp.trim()) {
      setFollowUpResponses([...followUpResponses, currentFollowUp]);
    }
    setCurrentFollowUp('');

    if (followUpIndex + 1 < prompt.followUps.length) {
      setFollowUpIndex(followUpIndex + 1);
    } else {
      setStep('moodAfter');
    }
  };

  const handleFinalMoodSelect = async (mood) => {
    setMoodAfter(mood);
    setSaving(true);

    // Would save to backend here
    // await journalAPI.saveEntry({ ... });

    setTimeout(() => {
      setSaving(false);
      setStep('complete');
    }, 1000);
  };

  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, var(--background) 0%, var(--primary-light) 100%)'
  };

  const containerStyle = {
    maxWidth: '600px',
    margin: '0 auto',
    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)'
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xl)'
  };

  const dateStyle = {
    color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-small)',
    marginBottom: 'var(--spacing-xs)'
  };

  const cardStyle = {
    background: 'var(--surface)',
    borderRadius: isMobile ? 'var(--radius-lg)' : 'var(--radius-xl)',
    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)',
    boxShadow: 'var(--shadow-md)'
  };

  const promptCardStyle = {
    background: prompt ? `linear-gradient(135deg, ${prompt.color}20, ${prompt.color}10)` : 'var(--surface)',
    border: prompt ? `2px solid ${prompt.color}40` : 'none',
    borderRadius: 'var(--radius-lg)',
    padding: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)',
    marginBottom: 'var(--spacing-lg)',
    textAlign: 'center'
  };

  const textareaStyle = {
    width: '100%',
    minHeight: isMobile ? '120px' : '150px',
    padding: 'var(--spacing-md)',
    border: '2px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    fontSize: '16px', // Prevents iOS zoom on focus
    fontFamily: 'var(--font-family-primary)',
    resize: 'vertical',
    background: 'var(--background)',
    color: 'var(--text-primary)'
  };

  const buttonStyle = {
    width: '100%',
    padding: 'var(--spacing-md) var(--spacing-xl)',
    background: prompt ? `linear-gradient(135deg, ${prompt.color}, ${prompt.color}CC)` : 'var(--primary-color)',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    color: 'white',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 'var(--spacing-lg)'
  };

  return (
    <div style={pageStyle}>
      <Navigation />
      <main id="main-content" style={containerStyle}>
        {/* Header */}
        <div style={headerStyle} className="animate-fade-in">
          <p style={dateStyle}>
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </p>
          <h1 style={{
            fontSize: 'var(--font-size-xxl)',
            fontFamily: 'var(--font-family-heading)',
            color: 'var(--text-primary)'
          }}>
            <span role="img" aria-hidden="true">📝</span> Daily Reflection
          </h1>
        </div>

        {/* Step: Initial Mood Check */}
        {step === 'mood' && (
          <div style={cardStyle} className="animate-fade-in-up">
            <h2 style={{ textAlign: 'center', marginBottom: 'var(--spacing-md)' }}>
              How are you feeling right now?
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
              Before we begin, let's check in with yourself.
            </p>
            <EmojiMoodPicker value={moodBefore} onChange={handleMoodSelect} showLabels />
          </div>
        )}

        {/* Step: Main Prompt */}
        {step === 'prompt' && prompt && (
          <div style={cardStyle} className="animate-fade-in-up">
            <div style={promptCardStyle}>
              <span style={{
                fontSize: 'var(--font-size-small)',
                color: prompt.color,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {prompt.category}
              </span>
              <div style={{ fontSize: '2.5rem', margin: 'var(--spacing-md) 0' }}>
                {prompt.emoji}
              </div>
              <h2 style={{
                fontSize: 'var(--font-size-xl)',
                color: 'var(--text-primary)',
                lineHeight: 1.4
              }}>
                {prompt.text}
              </h2>
            </div>

            <textarea
              style={textareaStyle}
              placeholder="Take your time... there's no right or wrong answer."
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              autoFocus
            />

            <button
              style={{
                ...buttonStyle,
                opacity: entry.trim().length < 10 ? 0.6 : 1,
                cursor: entry.trim().length < 10 ? 'not-allowed' : 'pointer'
              }}
              onClick={handleSubmitEntry}
              disabled={entry.trim().length < 10}
            >
              Continue
            </button>

            <p style={{
              textAlign: 'center',
              fontSize: 'var(--font-size-small)',
              color: 'var(--text-secondary)',
              marginTop: 'var(--spacing-sm)'
            }}>
              Write at least a few words to continue
            </p>
          </div>
        )}

        {/* Step: Follow-up Prompts */}
        {step === 'followUp' && prompt && (
          <div style={cardStyle} className="animate-fade-in-up">
            <div style={{
              ...promptCardStyle,
              background: 'var(--background)',
              border: '2px solid var(--border)'
            }}>
              <span style={{
                fontSize: 'var(--font-size-small)',
                color: 'var(--text-secondary)',
                fontWeight: 600
              }}>
                Deeper Reflection ({followUpIndex + 1}/{prompt.followUps.length})
              </span>
              <h2 style={{
                fontSize: 'var(--font-size-large)',
                color: 'var(--text-primary)',
                marginTop: 'var(--spacing-md)'
              }}>
                {prompt.followUps[followUpIndex]}
              </h2>
            </div>

            {/* Previous responses */}
            {followUpResponses.length > 0 && (
              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                {followUpResponses.map((response, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      background: 'var(--background)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: 'var(--spacing-xs)',
                      fontSize: 'var(--font-size-small)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {response}
                  </div>
                ))}
              </div>
            )}

            <textarea
              style={{ ...textareaStyle, minHeight: '100px' }}
              placeholder="Explore this thought..."
              value={currentFollowUp}
              onChange={(e) => setCurrentFollowUp(e.target.value)}
              autoFocus
            />

            <button style={buttonStyle} onClick={handleFollowUpSubmit}>
              {followUpIndex + 1 < prompt.followUps.length ? 'Next' : 'Almost done...'}
            </button>

            <button
              onClick={() => setStep('moodAfter')}
              style={{
                width: '100%',
                padding: 'var(--spacing-sm)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                marginTop: 'var(--spacing-sm)'
              }}
            >
              Skip remaining
            </button>
          </div>
        )}

        {/* Step: Mood After */}
        {step === 'moodAfter' && (
          <div style={cardStyle} className="animate-fade-in-up">
            <h2 style={{ textAlign: 'center', marginBottom: 'var(--spacing-md)' }}>
              How are you feeling now?
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-lg)' }}>
              Has anything shifted since we started?
            </p>
            {saving ? (
              <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
                <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--spacing-md)' }}>
                  Saving your reflection...
                </p>
              </div>
            ) : (
              <EmojiMoodPicker value={moodAfter} onChange={handleFinalMoodSelect} showLabels />
            )}
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <div style={cardStyle} className="animate-fade-in-up">
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-md)' }}>
                ✨
              </div>
              <h2 style={{
                fontSize: 'var(--font-size-xxl)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--spacing-sm)'
              }}>
                Beautiful reflection!
              </h2>
              <p style={{
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-xl)'
              }}>
                You've taken meaningful time for yourself today.
              </p>

              {/* Mood shift indicator */}
              {moodAfter !== moodBefore && (
                <div style={{
                  padding: 'var(--spacing-md)',
                  background: moodAfter > moodBefore
                    ? 'linear-gradient(135deg, #E8F5E8, #D4EDD4)'
                    : 'var(--background)',
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: 'var(--spacing-xl)'
                }}>
                  {moodAfter > moodBefore ? (
                    <p style={{ color: '#2D5A2D', fontWeight: 600 }}>
                      <span role="img" aria-hidden="true">📈</span> Your mood lifted during this reflection!
                    </p>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Sometimes reflecting brings up difficult feelings. That's okay - awareness is the first step.
                    </p>
                  )}
                </div>
              )}

              {/* Stats */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 'var(--spacing-xl)',
                marginBottom: 'var(--spacing-xl)'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xxl)', fontWeight: 700, color: 'var(--primary-color)' }}>
                    {entry.split(/\s+/).filter(w => w.length > 0).length}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                    Words Written
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xxl)', fontWeight: 700, color: 'var(--primary-color)' }}>
                    {followUpResponses.length + 1}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>
                    Reflections
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  ...buttonStyle,
                  background: 'linear-gradient(135deg, var(--accent-color), var(--accent-hover))'
                }}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Journal;

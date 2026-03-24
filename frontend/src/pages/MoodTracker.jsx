import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import EmojiMoodPicker, { EmojiEnergyPicker, QuickMoodSlider } from '../components/EmojiMoodPicker';
import VoiceCheckIn from '../components/VoiceCheckIn';
import EnhancedFeedback from '../components/EnhancedFeedback';
import MicroInterventionModal, { InterventionCard } from '../components/MicroInterventionModal';
import { moodAPI } from '../services/api';

const MoodTracker = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);

  // Phase 1: Voice and Feedback states
  const [showVoiceCheckIn, setShowVoiceCheckIn] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [intervention, setIntervention] = useState(null);
  const [showIntervention, setShowIntervention] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [formData, setFormData] = useState({
    moodScore: null,
    energyLevel: 5,
    stressLevel: 5,
    anxietyLevel: 5,
    sleepQuality: 5,
    sleepHours: 7,
    socialInteractionQuality: 5,
    notes: '',
    activities: [],
    triggers: []
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleMoodSelect = (value) => {
    setFormData({ ...formData, moodScore: value });
  };

  const handleEnergySelect = (value) => {
    setFormData({ ...formData, energyLevel: value });
  };

  // Phase 1: Handle voice analysis result
  const handleVoiceAnalysis = (analysis) => {
    setShowVoiceCheckIn(false);
    if (analysis) {
      setFormData(prev => ({
        ...prev,
        moodScore: analysis.suggestedMood,
        energyLevel: analysis.suggestedEnergy || prev.energyLevel,
        stressLevel: analysis.suggestedStress || prev.stressLevel
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.moodScore) {
      return;
    }

    setLoading(true);

    try {
      const response = await moodAPI.create(formData);
      setSuccess(true);

      // Phase 1: Capture enhanced feedback and intervention from response
      if (response.data?.feedback) {
        setFeedback(response.data.feedback);
      }
      if (response.data?.intervention) {
        setIntervention(response.data.intervention);
        // Show intervention after a short delay
        setTimeout(() => setShowIntervention(true), 500);
      }

      // Don't auto-navigate if we have feedback to show
      if (!response.data?.feedback) {
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (error) {
      alert('Failed to save mood entry. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Phase 1: Handle feedback dismiss
  const handleFeedbackDismiss = () => {
    setFeedback(null);
    if (intervention) {
      setShowIntervention(true);
    } else {
      navigate('/dashboard');
    }
  };

  // Phase 1: Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    if (suggestion.action === 'chat') {
      navigate('/chatbot');
    } else if (suggestion.action === 'breathing' || suggestion.action === 'grounding') {
      // Show intervention if we have one, or navigate to recommendations
      if (intervention) {
        setShowIntervention(true);
      } else {
        navigate('/recommendations');
      }
    } else if (suggestion.action === 'journal') {
      navigate('/insights');
    } else {
      navigate('/recommendations');
    }
  };

  // Phase 1: Handle intervention complete
  const handleInterventionComplete = () => {
    setShowIntervention(false);
    setIntervention(null);
    navigate('/dashboard');
  };

  const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, var(--background) 0%, var(--primary-light) 100%)',
    paddingBottom: isMobile ? 'var(--spacing-xl)' : 'var(--spacing-xxl)'
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: isMobile ? 'var(--spacing-lg)' : 'var(--spacing-xl)'
  };

  const greetingStyle = {
    fontSize: isMobile ? 'var(--font-size-xl)' : 'var(--font-size-xxxl)',
    fontFamily: 'var(--font-family-heading)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 'var(--spacing-sm)'
  };

  const subtitleStyle = {
    fontSize: isMobile ? 'var(--font-size-base)' : 'var(--font-size-large)',
    color: 'var(--text-secondary)',
    fontWeight: 500
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { greeting: 'Good morning', emoji: '🌅' };
    if (hour < 17) return { greeting: 'Good afternoon', emoji: '☀️' };
    if (hour < 21) return { greeting: 'Good evening', emoji: '🌆' };
    return { greeting: 'Good night', emoji: '🌙' };
  };

  const { greeting, emoji } = getTimeOfDay();

  return (
    <div style={pageStyle}>
      <Navigation />
      <main id="main-content" className="container" style={{ maxWidth: '700px', paddingTop: isMobile ? 'var(--spacing-md)' : 'var(--spacing-xl)', padding: isMobile ? 'var(--spacing-sm)' : 'var(--spacing-lg)' }}>

        {/* Phase 1: Enhanced Feedback after check-in */}
        {success && feedback && (
          <div className="animate-bounce-in">
            <EnhancedFeedback
              feedback={feedback}
              onSuggestionClick={handleSuggestionClick}
              onDismiss={handleFeedbackDismiss}
            />
          </div>
        )}

        {/* Phase 1: Micro-Intervention Modal */}
        {showIntervention && intervention && (
          <MicroInterventionModal
            intervention={intervention}
            onComplete={handleInterventionComplete}
            onSkip={handleInterventionComplete}
          />
        )}

        {/* Fallback Success Message (if no enhanced feedback) */}
        {success && !feedback && (
          <div
            className="animate-bounce-in"
            style={{
              background: 'linear-gradient(135deg, #7BC47B, #6AB46A)',
              color: 'white',
              padding: 'var(--spacing-xl)',
              borderRadius: 'var(--radius-xl)',
              textAlign: 'center',
              marginBottom: 'var(--spacing-xl)',
              boxShadow: '0 4px 20px rgba(123, 196, 123, 0.4)'
            }}
            role="alert"
          >
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: 'var(--spacing-sm)' }}>
              {formData.moodScore >= 7 ? '🎉' : formData.moodScore >= 5 ? '💜' : '💚'}
            </span>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>Check-in saved!</h2>
            <p style={{ margin: 'var(--spacing-sm) 0 0', opacity: 0.9 }}>
              Taking time to reflect is a wonderful habit.
            </p>
          </div>
        )}

        {/* Header */}
        {!success && (
          <>
            <div style={headerStyle} className="animate-fade-in">
              <h1 style={greetingStyle}>
                <span role="img" aria-hidden="true">{emoji}</span> {greeting}
              </h1>
              <p style={subtitleStyle}>
                Let's take a moment to check in with yourself
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Phase 1: Voice Check-In Option */}
              {showVoiceCheckIn ? (
                <div className="animate-fade-in-up" style={{ marginBottom: 'var(--spacing-xl)' }}>
                  <VoiceCheckIn
                    onAnalysisComplete={handleVoiceAnalysis}
                    onCancel={() => setShowVoiceCheckIn(false)}
                  />
                </div>
              ) : (
                <>
                  {/* Voice Check-In Prompt (before mood selection) */}
                  {!formData.moodScore && (
                    <div
                      className="animate-fade-in"
                      style={{
                        textAlign: 'center',
                        marginBottom: 'var(--spacing-lg)'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setShowVoiceCheckIn(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 'var(--spacing-sm)',
                          padding: 'var(--spacing-md) var(--spacing-lg)',
                          background: 'linear-gradient(135deg, var(--secondary-color), #F5D89A)',
                          border: 'none',
                          borderRadius: 'var(--radius-full)',
                          cursor: 'pointer',
                          fontSize: 'var(--font-size-base)',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          boxShadow: 'var(--shadow-sm)',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>🎙️</span>
                        Try voice check-in
                      </button>
                      <p style={{
                        marginTop: 'var(--spacing-sm)',
                        fontSize: 'var(--font-size-small)',
                        color: 'var(--text-tertiary)'
                      }}>
                        Or select an emoji below
                      </p>
                    </div>
                  )}

                  {/* Main Mood Picker */}
                  <div className="animate-fade-in-up" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <EmojiMoodPicker
                      value={formData.moodScore}
                      onChange={handleMoodSelect}
                      label="How are you feeling right now?"
                    />
                  </div>
                </>
              )}

              {/* Energy Level - Show after mood is selected */}
              {formData.moodScore && (
                <div
                  className="animate-fade-in-up"
                  style={{ marginBottom: 'var(--spacing-xl)' }}
                >
                  <EmojiEnergyPicker
                    value={formData.energyLevel}
                    onChange={handleEnergySelect}
                    label="How's your energy?"
                  />
                </div>
              )}

              {/* Optional Notes */}
              {formData.moodScore && (
                <div
                  className="animate-fade-in-up"
                  style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--spacing-lg)',
                    marginBottom: 'var(--spacing-lg)'
                  }}
                >
                  <label
                    htmlFor="notes"
                    style={{
                      display: 'block',
                      fontSize: 'var(--font-size-large)',
                      fontWeight: 600,
                      marginBottom: 'var(--spacing-sm)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <span role="img" aria-hidden="true">📝</span> Anything on your mind?
                    <span style={{
                      fontSize: 'var(--font-size-small)',
                      fontWeight: 400,
                      color: 'var(--text-secondary)',
                      marginLeft: 'var(--spacing-sm)'
                    }}>
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="What made you feel this way? Your thoughts are private..."
                    style={{
                      width: '100%',
                      minHeight: '100px',
                      padding: 'var(--spacing-md)',
                      border: '2px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontFamily: 'var(--font-family-primary)',
                      fontSize: 'var(--font-size-base)',
                      resize: 'vertical',
                      background: 'var(--background)',
                      color: 'var(--text-primary)',
                      transition: 'border-color var(--transition-fast)'
                    }}
                  />
                </div>
              )}

              {/* More Details Toggle */}
              {formData.moodScore && (
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--spacing-sm)',
                    width: '100%',
                    padding: 'var(--spacing-md)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginBottom: 'var(--spacing-md)'
                  }}
                >
                  <span>{showDetails ? 'Hide' : 'Add more'} details</span>
                  <span style={{
                    transition: 'transform var(--transition-fast)',
                    transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                    ▼
                  </span>
                </button>
              )}

              {/* Detailed Sliders - Collapsible */}
              {formData.moodScore && showDetails && (
                <div
                  className="animate-fade-in"
                  style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--spacing-lg)',
                    marginBottom: 'var(--spacing-xl)',
                    display: 'grid',
                    gap: 'var(--spacing-md)'
                  }}
                >
                  <QuickMoodSlider
                    label="Stress Level"
                    value={formData.stressLevel}
                    onChange={(v) => setFormData({ ...formData, stressLevel: v })}
                    lowLabel="Calm"
                    highLabel="Stressed"
                  />

                  <QuickMoodSlider
                    label="Anxiety"
                    value={formData.anxietyLevel}
                    onChange={(v) => setFormData({ ...formData, anxietyLevel: v })}
                    lowLabel="Relaxed"
                    highLabel="Anxious"
                  />

                  <QuickMoodSlider
                    label="Sleep Quality"
                    value={formData.sleepQuality}
                    onChange={(v) => setFormData({ ...formData, sleepQuality: v })}
                    lowLabel="Poor"
                    highLabel="Great"
                  />

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-md)',
                    padding: 'var(--spacing-md)',
                    background: 'var(--background)',
                    borderRadius: 'var(--radius-md)'
                  }}>
                    <label style={{
                      fontSize: 'var(--font-size-small)',
                      fontWeight: 500,
                      color: 'var(--text-secondary)',
                      flex: 1
                    }}>
                      Hours of Sleep
                    </label>
                    <input
                      type="number"
                      value={formData.sleepHours}
                      onChange={(e) => setFormData({ ...formData, sleepHours: parseFloat(e.target.value) || 0 })}
                      min="0"
                      max="24"
                      step="0.5"
                      style={{
                        width: '80px',
                        padding: 'var(--spacing-sm)',
                        border: '2px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'center',
                        fontWeight: 600,
                        fontSize: 'var(--font-size-base)'
                      }}
                    />
                  </div>

                  <QuickMoodSlider
                    label="Social Connection"
                    value={formData.socialInteractionQuality}
                    onChange={(v) => setFormData({ ...formData, socialInteractionQuality: v })}
                    lowLabel="Isolated"
                    highLabel="Connected"
                  />
                </div>
              )}

              {/* Submit Button */}
              {formData.moodScore && (
                <div
                  className="animate-fade-in-up"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-md)',
                    alignItems: 'center'
                  }}
                >
                  <button
                    type="submit"
                    disabled={loading || !formData.moodScore}
                    style={{
                      width: '100%',
                      maxWidth: '300px',
                      padding: 'var(--spacing-lg) var(--spacing-xl)',
                      background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-xl)',
                      fontSize: 'var(--font-size-large)',
                      fontWeight: 600,
                      cursor: loading ? 'wait' : 'pointer',
                      boxShadow: '0 4px 20px rgba(155, 138, 165, 0.4)',
                      transition: 'all var(--transition-fast)',
                      opacity: loading ? 0.7 : 1,
                      transform: loading ? 'scale(0.98)' : 'scale(1)'
                    }}
                  >
                    {loading ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-sm)' }}>
                        <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }}></span>
                        Saving...
                      </span>
                    ) : (
                      <>Save Check-in</>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: 'var(--spacing-sm)'
                    }}
                  >
                    Skip for now
                  </button>
                </div>
              )}

              {/* Encouragement when no mood selected (hidden during voice check-in) */}
              {!formData.moodScore && !showVoiceCheckIn && (
                <p
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    marginTop: 'var(--spacing-lg)'
                  }}
                >
                  Tap on an emoji above to get started
                </p>
              )}
            </form>
          </>
        )}
      </main>
    </div>
  );
};

export default MoodTracker;

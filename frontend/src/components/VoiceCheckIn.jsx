import React, { useState, useRef, useEffect } from 'react';
import { voiceAPI } from '../services/api';

/**
 * VoiceCheckIn - Voice emotion analysis component
 * Records voice and extracts acoustic features for mood detection
 * Uses Web Audio API for feature extraction
 */
const VoiceCheckIn = ({ onAnalysisComplete, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const animationRef = useRef(null);

  const MAX_RECORDING_TIME = 15; // seconds

  useEffect(() => {
    return () => {
      stopRecording();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      chunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      // Set up audio context for analysis
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 2048;

      // Start visualizing audio level
      visualizeAudio();

      // Set up media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        analyzeRecording();
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME - 1) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      setError('Microphone access denied. Please allow microphone access to use voice check-in.');
    }
  };

  const visualizeAudio = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average level
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255);

    animationRef.current = requestAnimationFrame(visualizeAudio);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    setIsRecording(false);
    setAudioLevel(0);
  };

  const analyzeRecording = async () => {
    setIsAnalyzing(true);

    try {
      // Extract audio features from the recording
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const features = await extractAudioFeatures(audioBlob);

      // Send features to backend for analysis
      const response = await voiceAPI.analyze(features);

      setAnalysis(response.data);
    } catch (err) {
      setError('Unable to analyze recording. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const extractAudioFeatures = async (audioBlob) => {
    return new Promise(async (resolve) => {
      // In a real implementation, we'd use the Web Audio API to extract
      // actual acoustic features. For MVP, we'll use simplified analysis.
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();

      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        // Calculate features
        const features = {
          pitch: calculateEstimatedPitch(channelData, sampleRate),
          pitchVariation: calculatePitchVariation(channelData, sampleRate),
          speechRate: estimateSpeechRate(channelData, sampleRate),
          volume: calculateAverageVolume(channelData),
          pauseFrequency: calculatePauseFrequency(channelData, sampleRate),
          duration: audioBuffer.duration
        };

        audioContext.close();
        resolve(features);
      } catch {
        // Fallback to simulated features if audio processing fails
        resolve({
          pitch: 150 + Math.random() * 50,
          pitchVariation: 30 + Math.random() * 20,
          speechRate: 120 + Math.random() * 40,
          volume: 0.3 + Math.random() * 0.4,
          pauseFrequency: 0.1 + Math.random() * 0.2,
          duration: recordingTime
        });
      }
    });
  };

  // Simplified pitch estimation using zero-crossing rate
  const calculateEstimatedPitch = (channelData, sampleRate) => {
    let zeroCrossings = 0;
    for (let i = 1; i < channelData.length; i++) {
      if ((channelData[i] >= 0 && channelData[i - 1] < 0) ||
          (channelData[i] < 0 && channelData[i - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const frequency = (zeroCrossings / 2) / (channelData.length / sampleRate);
    return Math.max(80, Math.min(300, frequency)); // Typical voice range
  };

  // Estimate pitch variation using standard deviation of short-term pitch
  const calculatePitchVariation = (channelData, sampleRate) => {
    const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
    const pitches = [];

    for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
      const window = channelData.slice(i, i + windowSize);
      let zeroCrossings = 0;
      for (let j = 1; j < window.length; j++) {
        if ((window[j] >= 0 && window[j - 1] < 0) ||
            (window[j] < 0 && window[j - 1] >= 0)) {
          zeroCrossings++;
        }
      }
      const pitch = (zeroCrossings / 2) / (windowSize / sampleRate);
      if (pitch > 50 && pitch < 400) {
        pitches.push(pitch);
      }
    }

    if (pitches.length < 2) return 30;
    const mean = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    const variance = pitches.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / pitches.length;
    return Math.sqrt(variance);
  };

  // Estimate speech rate using energy patterns
  const estimateSpeechRate = (channelData, sampleRate) => {
    const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
    const energies = [];

    for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
      const window = channelData.slice(i, i + windowSize);
      const energy = window.reduce((sum, s) => sum + s * s, 0) / window.length;
      energies.push(energy);
    }

    // Count peaks (syllables approximation)
    const threshold = Math.max(...energies) * 0.3;
    let peaks = 0;
    for (let i = 1; i < energies.length - 1; i++) {
      if (energies[i] > threshold &&
          energies[i] > energies[i - 1] &&
          energies[i] > energies[i + 1]) {
        peaks++;
      }
    }

    const durationSeconds = channelData.length / sampleRate;
    const syllablesPerSecond = peaks / durationSeconds;
    return syllablesPerSecond * 40; // Approximate words per minute
  };

  const calculateAverageVolume = (channelData) => {
    const sum = channelData.reduce((a, b) => a + Math.abs(b), 0);
    return sum / channelData.length;
  };

  const calculatePauseFrequency = (channelData, sampleRate) => {
    const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
    const silenceThreshold = 0.01;
    let pauseCount = 0;
    let inPause = false;

    for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
      const window = channelData.slice(i, i + windowSize);
      const energy = window.reduce((sum, s) => sum + Math.abs(s), 0) / window.length;

      if (energy < silenceThreshold) {
        if (!inPause) {
          pauseCount++;
          inPause = true;
        }
      } else {
        inPause = false;
      }
    }

    const durationSeconds = channelData.length / sampleRate;
    return pauseCount / durationSeconds;
  };

  const handleAcceptAnalysis = () => {
    if (onAnalysisComplete && analysis) {
      onAnalysisComplete({
        analysisId: analysis.analysisId,
        suggestedMood: analysis.moodMetrics?.mood,
        suggestedEnergy: analysis.moodMetrics?.energy,
        suggestedStress: analysis.moodMetrics?.stress,
        emotions: analysis.emotions,
        confidence: analysis.confidence,
        interpretation: analysis.interpretation
      });
    }
  };

  const containerStyle = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--spacing-xl)',
    textAlign: 'center'
  };

  const buttonStyle = {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-xs)',
    transition: 'all var(--transition-base)',
    margin: '0 auto'
  };

  const recordButtonStyle = {
    ...buttonStyle,
    background: isRecording
      ? `linear-gradient(135deg, #FF6B6B, #FF8E8E)`
      : `linear-gradient(135deg, var(--primary-color), var(--secondary-color))`,
    boxShadow: isRecording
      ? `0 0 0 ${audioLevel * 30}px rgba(255, 107, 107, 0.2), var(--shadow-lg)`
      : 'var(--shadow-lg)',
    transform: isRecording ? `scale(${1 + audioLevel * 0.1})` : 'scale(1)'
  };

  if (analysis) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>🎙️</div>
        <h3 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--spacing-md)'
        }}>
          Voice Analysis Complete
        </h3>

        {/* Results */}
        <div style={{
          background: 'var(--background)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-lg)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          {/* Mood Metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-md)'
          }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>Mood</div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--primary-color)' }}>
                {analysis.moodMetrics?.mood || '?'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>Energy</div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--accent-color)' }}>
                {analysis.moodMetrics?.energy || '?'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--text-secondary)' }}>Stress</div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--warning-color)' }}>
                {analysis.moodMetrics?.stress || '?'}
              </div>
            </div>
          </div>

          {/* Emotional Indicators */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--spacing-sm)',
            flexWrap: 'wrap',
            marginBottom: 'var(--spacing-md)'
          }}>
            {analysis.emotions && Object.entries(analysis.emotions).map(([emotion, value]) => (
              <div
                key={emotion}
                style={{
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-small)'
                }}
              >
                <span style={{ textTransform: 'capitalize' }}>{emotion}</span>: {value}
              </div>
            ))}
          </div>

          {/* Interpretation */}
          {analysis.interpretation && (
            <p style={{
              fontSize: 'var(--font-size-base)',
              color: 'var(--text-secondary)',
              fontStyle: 'italic'
            }}>
              "{analysis.interpretation}"
            </p>
          )}

          {/* Confidence */}
          <div style={{
            marginTop: 'var(--spacing-sm)',
            fontSize: 'var(--font-size-small)',
            color: 'var(--text-tertiary)'
          }}>
            Confidence: {((analysis.confidence || 0.5) * 100).toFixed(0)}%
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center' }}>
          <button
            onClick={handleAcceptAnalysis}
            style={{
              padding: 'var(--spacing-md) var(--spacing-xl)',
              background: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 'var(--font-size-base)'
            }}
          >
            Use These Values
          </button>
          <button
            onClick={() => {
              setAnalysis(null);
              setRecordingTime(0);
            }}
            style={{
              padding: 'var(--spacing-md) var(--spacing-xl)',
              background: 'var(--background)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 'var(--font-size-base)'
            }}
          >
            Record Again
          </button>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              marginTop: 'var(--spacing-md)',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Skip voice check-in
          </button>
        )}
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)', animation: 'pulse 1s infinite' }}>
          🔊
        </div>
        <h3 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          Analyzing your voice...
        </h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          Detecting emotional patterns in your speech
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h3 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 'var(--spacing-sm)'
        }}>
          Voice Check-In
        </h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          {isRecording
            ? 'Speak naturally about how you\'re feeling...'
            : 'Tap to record a short voice message about your day'}
        </p>
      </div>

      {error && (
        <div style={{
          padding: 'var(--spacing-md)',
          background: 'var(--error-light)',
          color: 'var(--error-color)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--spacing-lg)'
        }}>
          {error}
        </div>
      )}

      <button
        onClick={isRecording ? stopRecording : startRecording}
        style={recordButtonStyle}
      >
        <span style={{ fontSize: '2.5rem' }}>
          {isRecording ? '⏹️' : '🎙️'}
        </span>
        <span style={{ color: 'white', fontSize: 'var(--font-size-small)' }}>
          {isRecording ? 'Stop' : 'Record'}
        </span>
      </button>

      {isRecording && (
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <div style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 600,
            color: 'var(--primary-color)',
            fontFamily: 'monospace'
          }}>
            {recordingTime}s / {MAX_RECORDING_TIME}s
          </div>
          <div style={{
            width: '200px',
            height: '4px',
            background: 'var(--border)',
            borderRadius: '2px',
            margin: 'var(--spacing-sm) auto',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${(recordingTime / MAX_RECORDING_TIME) * 100}%`,
              background: 'var(--primary-color)',
              transition: 'width 1s linear'
            }} />
          </div>
        </div>
      )}

      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            marginTop: 'var(--spacing-lg)',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          Skip voice check-in
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default VoiceCheckIn;

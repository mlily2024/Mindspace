/**
 * voiceFeatures — on-device acoustic feature extraction (E.1, ADR-0017).
 *
 * Pure DSP over a mono Float32Array (or number array) + sampleRate. No browser or
 * React globals, so it is unit-testable with synthetic waveforms.
 *
 * Replaces the previous zero-crossing-rate estimates (noise- and harmonic-sensitive)
 * with autocorrelation pitch + real jitter (cycle-to-cycle F0 perturbation) and
 * shimmer (cycle-to-cycle amplitude perturbation). Critically, it NEVER fabricates:
 * extractFeatures throws on unusable audio (too short / silent / unvoiced) instead of
 * returning random numbers, because the result feeds a mental-health mood baseline.
 *
 * Privacy: features are derived here; only the derived numbers leave the device,
 * mirroring the on-device sentiment contract (ADR-0006).
 */

const PITCH_MIN_HZ = 70;
const PITCH_MAX_HZ = 400; // human speaking-voice F0 range
const FRAME_MS = 40;
const HOP_MS = 20;
const VOICED_RMS = 0.01; // min frame RMS to be considered voiced
const VOICED_CLARITY = 0.3; // min normalised autocorrelation peak to accept a pitch
const MIN_DURATION_S = 0.3;

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function std(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

function median(xs) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function rms(frame, start, len) {
  let sum = 0;
  for (let i = start; i < start + len; i += 1) sum += frame[i] * frame[i];
  return Math.sqrt(sum / len);
}

function peakAbs(frame, start, len) {
  let peak = 0;
  for (let i = start; i < start + len; i += 1) {
    const a = Math.abs(frame[i]);
    if (a > peak) peak = a;
  }
  return peak;
}

/**
 * Autocorrelation pitch for one frame. Returns F0 in Hz, or null if the frame is
 * silent or unvoiced (no sufficiently clear periodic peak in the voice range).
 */
function estimatePitchHz(samples, start, len, sampleRate) {
  if (rms(samples, start, len) < VOICED_RMS) return null;

  const minLag = Math.floor(sampleRate / PITCH_MAX_HZ);
  const maxLag = Math.min(Math.floor(sampleRate / PITCH_MIN_HZ), len - 1);
  if (maxLag <= minLag) return null;

  // Energy at lag 0 for normalisation.
  let r0 = 0;
  for (let i = 0; i < len; i += 1) r0 += samples[start + i] * samples[start + i];
  if (r0 <= 0) return null;

  let bestLag = -1;
  let bestVal = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i < len - lag; i += 1) sum += samples[start + i] * samples[start + i + lag];
    const norm = sum / r0;
    if (norm > bestVal) {
      bestVal = norm;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestVal < VOICED_CLARITY) return null;

  // Parabolic interpolation around the peak lag for sub-sample precision.
  const acf = (lag) => {
    let sum = 0;
    for (let i = 0; i < len - lag; i += 1) sum += samples[start + i] * samples[start + i + lag];
    return sum / r0;
  };
  let refinedLag = bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const yl = acf(bestLag - 1);
    const yc = bestVal;
    const yr = acf(bestLag + 1);
    const denom = yl - 2 * yc + yr;
    if (Math.abs(denom) > 1e-9) refinedLag = bestLag + (0.5 * (yl - yr)) / denom;
  }

  const f0 = sampleRate / refinedLag;
  if (f0 < PITCH_MIN_HZ || f0 > PITCH_MAX_HZ) return null;
  return f0;
}

/** Per-voiced-frame F0 + peak amplitude track. */
function analyzeVoicedFrames(samples, sampleRate) {
  const frameLen = Math.max(2, Math.floor((FRAME_MS / 1000) * sampleRate));
  const hop = Math.max(1, Math.floor((HOP_MS / 1000) * sampleRate));
  const f0s = [];
  const amps = [];
  for (let start = 0; start + frameLen <= samples.length; start += hop) {
    const f0 = estimatePitchHz(samples, start, frameLen, sampleRate);
    if (f0 !== null) {
      f0s.push(f0);
      amps.push(peakAbs(samples, start, frameLen));
    }
  }
  return { f0s, amps };
}

/** Local jitter: mean absolute cycle-to-cycle period difference / mean period (a fraction). */
function jitterLocal(f0s) {
  if (f0s.length < 3) return 0;
  const periods = f0s.map((f) => 1 / f);
  let diffSum = 0;
  for (let i = 1; i < periods.length; i += 1) diffSum += Math.abs(periods[i] - periods[i - 1]);
  const avgPeriod = mean(periods);
  return avgPeriod > 0 ? diffSum / (periods.length - 1) / avgPeriod : 0;
}

/** Local shimmer: mean absolute cycle-to-cycle amplitude difference / mean amplitude (a fraction). */
function shimmerLocal(amps) {
  if (amps.length < 3) return 0;
  let diffSum = 0;
  for (let i = 1; i < amps.length; i += 1) diffSum += Math.abs(amps[i] - amps[i - 1]);
  const avgAmp = mean(amps);
  return avgAmp > 0 ? diffSum / (amps.length - 1) / avgAmp : 0;
}

/** Mean absolute amplitude over the whole signal (0..1), the prior `volume` semantics. */
function averageVolume(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += Math.abs(samples[i]);
  return samples.length ? sum / samples.length : 0;
}

/** Syllable-peak estimate of speech rate, approximate words per minute. */
function speechRate(samples, sampleRate) {
  const win = Math.max(1, Math.floor(0.05 * sampleRate));
  const energies = [];
  for (let i = 0; i + win <= samples.length; i += win) {
    let e = 0;
    for (let j = 0; j < win; j += 1) e += samples[i + j] * samples[i + j];
    energies.push(e / win);
  }
  if (energies.length < 3) return 0;
  const threshold = Math.max(...energies) * 0.3;
  let peaks = 0;
  for (let i = 1; i < energies.length - 1; i += 1) {
    if (energies[i] > threshold && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) peaks += 1;
  }
  const seconds = samples.length / sampleRate;
  return seconds > 0 ? (peaks / seconds) * 40 : 0;
}

/** Pauses (silence stretches) per second. */
function pauseFrequency(samples, sampleRate) {
  const win = Math.max(1, Math.floor(0.1 * sampleRate));
  const silence = 0.01;
  let pauses = 0;
  let inPause = false;
  for (let i = 0; i + win <= samples.length; i += win) {
    let e = 0;
    for (let j = 0; j < win; j += 1) e += Math.abs(samples[i + j]);
    e /= win;
    if (e < silence) {
      if (!inPause) {
        pauses += 1;
        inPause = true;
      }
    } else {
      inPause = false;
    }
  }
  const seconds = samples.length / sampleRate;
  return seconds > 0 ? pauses / seconds : 0;
}

/**
 * Extract the full acoustic feature set. Throws (never fabricates) when the audio
 * is unusable, so callers surface an error rather than persisting fake biometrics.
 *
 * @param {Float32Array|number[]} samples mono PCM in [-1, 1]
 * @param {number} sampleRate
 * @param {number} durationSeconds
 * @returns {{pitch, pitchVariation, speechRate, volume, pauseFrequency, jitter, volumeVariability, duration}}
 */
function extractFeatures(samples, sampleRate, durationSeconds) {
  if (!samples || samples.length === 0 || !(sampleRate > 0)) {
    throw new Error('No audio to analyse.');
  }
  if (samples.length / sampleRate < MIN_DURATION_S) {
    throw new Error('Recording too short to analyse.');
  }
  if (averageVolume(samples) < VOICED_RMS / 2) {
    throw new Error('No speech detected in the recording.');
  }

  const { f0s, amps } = analyzeVoicedFrames(samples, sampleRate);
  if (f0s.length < 2) {
    throw new Error('No voiced speech detected in the recording.');
  }

  return {
    pitch: median(f0s),
    pitchVariation: std(f0s),
    speechRate: speechRate(samples, sampleRate),
    volume: averageVolume(samples),
    pauseFrequency: pauseFrequency(samples, sampleRate),
    jitter: jitterLocal(f0s),
    volumeVariability: shimmerLocal(amps),
    duration: durationSeconds,
  };
}

export {
  extractFeatures,
  estimatePitchHz,
  analyzeVoicedFrames,
  jitterLocal,
  shimmerLocal,
  averageVolume,
  speechRate,
  pauseFrequency,
  PITCH_MIN_HZ,
  PITCH_MAX_HZ,
};

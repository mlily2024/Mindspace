/**
 * Tests for voiceFeatures (E.1, ADR-0017) — the on-device acoustic DSP.
 * Synthetic waveforms with known properties pin pitch accuracy, jitter/shimmer
 * behaviour, the variation signal, and (critically) the no-fabrication contract:
 * unusable audio throws rather than returning numbers.
 */
import { describe, it, expect } from 'vitest';
import {
  extractFeatures,
  estimatePitchHz,
  jitterLocal,
  shimmerLocal,
} from './voiceFeatures';

const SR = 16000;

/** Pure tone of `freq` Hz, `dur` s, constant amplitude. */
function sine(freq, dur, amp = 0.5) {
  const n = Math.floor(SR * dur);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i += 1) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return x;
}

/** Two concatenated tones — a deliberate F0 change for the variation test. */
function twoTones(f1, f2, dur) {
  const a = sine(f1, dur / 2);
  const b = sine(f2, dur / 2);
  const x = new Float32Array(a.length + b.length);
  x.set(a, 0);
  x.set(b, a.length);
  return x;
}

/** 150 Hz carrier under a slow amplitude envelope -> non-trivial shimmer. */
function amSignal(freq, dur) {
  const n = Math.floor(SR * dur);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const env = 0.3 + 0.25 * Math.sin((2 * Math.PI * 3 * i) / SR); // 3 Hz envelope
    x[i] = env * Math.sin((2 * Math.PI * freq * i) / SR);
  }
  return x;
}

describe('estimatePitchHz', () => {
  it('recovers the frequency of a pure tone', () => {
    const x = sine(150, 0.1);
    const f0 = estimatePitchHz(x, 0, x.length, SR);
    expect(f0).toBeGreaterThan(142);
    expect(f0).toBeLessThan(158);
  });

  it('returns null on silence', () => {
    const x = new Float32Array(1600); // zeros
    expect(estimatePitchHz(x, 0, x.length, SR)).toBeNull();
  });
});

describe('extractFeatures', () => {
  it('estimates pitch close to the true F0, with low jitter/shimmer on a pure tone', () => {
    const f = extractFeatures(sine(150, 1.0), SR, 1.0);
    expect(f.pitch).toBeGreaterThan(143);
    expect(f.pitch).toBeLessThan(157);
    expect(f.jitter).toBeLessThan(0.02); // steady period
    expect(f.volumeVariability).toBeLessThan(0.05); // steady amplitude
    expect(f).toHaveProperty('speechRate');
    expect(f).toHaveProperty('pauseFrequency');
  });

  it('detects amplitude variation as shimmer (volumeVariability)', () => {
    const steady = extractFeatures(sine(150, 1.0), SR, 1.0).volumeVariability;
    const am = extractFeatures(amSignal(150, 1.0), SR, 1.0).volumeVariability;
    expect(am).toBeGreaterThan(steady);
    expect(am).toBeGreaterThan(0.02);
  });

  it('detects an F0 change as pitch variation', () => {
    const steady = extractFeatures(sine(150, 1.0), SR, 1.0).pitchVariation;
    const changing = extractFeatures(twoTones(150, 220, 1.0), SR, 1.0).pitchVariation;
    expect(changing).toBeGreaterThan(steady);
    expect(changing).toBeGreaterThan(5);
  });

  it('THROWS (never fabricates) on silence', () => {
    expect(() => extractFeatures(new Float32Array(SR), SR, 1.0)).toThrow(/no speech|voiced/i);
  });

  it('THROWS on too-short audio', () => {
    expect(() => extractFeatures(sine(150, 0.1), SR, 0.1)).toThrow(/too short/i);
  });

  it('THROWS on empty / invalid input', () => {
    expect(() => extractFeatures(new Float32Array(0), SR, 0)).toThrow();
    expect(() => extractFeatures(sine(150, 1.0), 0, 1.0)).toThrow();
  });
});

describe('jitterLocal / shimmerLocal', () => {
  it('are zero for fewer than 3 cycles', () => {
    expect(jitterLocal([150, 150])).toBe(0);
    expect(shimmerLocal([0.5, 0.5])).toBe(0);
  });

  it('jitter is ~0 for a constant period and positive for a perturbed one', () => {
    expect(jitterLocal([150, 150, 150, 150])).toBeCloseTo(0, 6);
    expect(jitterLocal([150, 160, 150, 160])).toBeGreaterThan(0);
  });

  it('shimmer is ~0 for constant amplitude and positive for a varying one', () => {
    expect(shimmerLocal([0.5, 0.5, 0.5, 0.5])).toBeCloseTo(0, 6);
    expect(shimmerLocal([0.5, 0.3, 0.5, 0.3])).toBeGreaterThan(0);
  });
});

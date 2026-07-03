/**
 * Tests for LPC formant estimation (E.1 follow-on, ADR-0026).
 *
 * The load-bearing test synthesises a vowel with KNOWN formants — an impulse
 * train (glottal source) cascaded through two 2-pole resonators — and checks the
 * LPC estimator recovers F1/F2. This validates autocorrelation + Levinson-Durbin
 * + spectral peak-picking end to end.
 */
import { describe, it, expect } from 'vitest';
import {
  estimateFormants,
  levinsonDurbin,
  lpcFormantPeaks,
  extractFeatures,
} from './voiceFeatures';

/** Impulse train at f0 cascaded through 2-pole resonators at the given formants. */
function synthVowel(sampleRate, seconds, f0, formants, bandwidths) {
  const n = Math.floor(sampleRate * seconds);
  let sig = new Float32Array(n);
  const period = Math.round(sampleRate / f0);
  for (let i = 0; i < n; i += period) sig[i] = 1; // glottal impulse train
  formants.forEach((f, idx) => {
    const r = Math.exp((-Math.PI * bandwidths[idx]) / sampleRate);
    const theta = (2 * Math.PI * f) / sampleRate;
    const a1 = 2 * r * Math.cos(theta);
    const a2 = -r * r;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      out[i] = sig[i] + a1 * (i >= 1 ? out[i - 1] : 0) + a2 * (i >= 2 ? out[i - 2] : 0);
    }
    sig = out;
  });
  let max = 0;
  for (let i = 0; i < n; i += 1) max = Math.max(max, Math.abs(sig[i]));
  if (max > 0) for (let i = 0; i < n; i += 1) sig[i] /= max;
  return sig;
}

describe('levinsonDurbin', () => {
  it('returns a monic filter of the right length', () => {
    const r = [4, 2, 1, 0.5];
    const { a, error } = levinsonDurbin(r, 3);
    expect(a).toHaveLength(4);
    expect(a[0]).toBe(1);
    expect(error).toBeGreaterThan(0);
    expect(error).toBeLessThanOrEqual(r[0]); // residual never exceeds signal power
  });

  it('degrades gracefully on a zero-power signal', () => {
    expect(levinsonDurbin([0, 0, 0], 2).error).toBe(0);
  });
});

describe('lpcFormantPeaks', () => {
  it('finds a resonance where the LPC envelope peaks', () => {
    // a[0..2] for a single resonator near 1000 Hz at 16 kHz
    const sr = 16000;
    const r = Math.exp((-Math.PI * 100) / sr);
    const theta = (2 * Math.PI * 1000) / sr;
    const a = [1, -2 * r * Math.cos(theta), r * r]; // A(z) with a pole pair at 1 kHz
    const peaks = lpcFormantPeaks(a, sr);
    expect(peaks.length).toBeGreaterThanOrEqual(1);
    expect(Math.min(...peaks.map((p) => Math.abs(p - 1000)))).toBeLessThan(60);
  });
});

describe('estimateFormants', () => {
  const sr = 16000;

  it('recovers known formants from a synthetic vowel', () => {
    const sig = synthVowel(sr, 0.5, 120, [700, 1800], [80, 100]);
    const f = estimateFormants(sig, sr);
    expect(f.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(f[0] - 700)).toBeLessThan(150);
    expect(Math.abs(f[1] - 1800)).toBeLessThan(150);
  });

  it('returns [] on silence (never fabricates)', () => {
    expect(estimateFormants(new Float32Array(8000), sr)).toEqual([]);
  });
});

describe('extractFeatures integration', () => {
  it('includes a formants array', () => {
    const sr = 16000;
    const sig = synthVowel(sr, 0.6, 130, [650, 1700], [90, 110]);
    const out = extractFeatures(sig, sr, 0.6);
    expect(Array.isArray(out.formants)).toBe(true);
    expect(out.formants.length).toBeGreaterThanOrEqual(2);
  });
});

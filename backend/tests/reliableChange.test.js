/**
 * Tests for the Reliable Change Index (RCI) module.
 *
 * These tests are the executable specification of ADR-0011: the RCI maths,
 * the ±1.96 threshold, the per-instrument S_diff constants, and — critically —
 * the polarity handling (WEMWBS is the only instrument where higher = better).
 */

const {
  computeRCI,
  normaliseInstrument,
  SDIFF,
  HIGHER_IS_WORSE,
  RCI_THRESHOLD,
  DIRECTION,
} = require('../src/utils/reliableChange');

describe('reliableChange', () => {
  describe('constants', () => {
    it('uses the 95% two-tailed threshold of 1.96', () => {
      expect(RCI_THRESHOLD).toBe(1.96);
    });

    it('has the literature-anchored S_diff for all five instruments', () => {
      expect(SDIFF).toEqual({
        PHQ9: 2.43,
        GAD7: 2.33,
        PSS4: 1.70,
        ISI: 3.39,
        WEMWBS: 4.67,
      });
    });

    it('treats higher = worse for all instruments except WEMWBS', () => {
      expect(HIGHER_IS_WORSE.PHQ9).toBe(true);
      expect(HIGHER_IS_WORSE.GAD7).toBe(true);
      expect(HIGHER_IS_WORSE.PSS4).toBe(true);
      expect(HIGHER_IS_WORSE.ISI).toBe(true);
      expect(HIGHER_IS_WORSE.WEMWBS).toBe(false);
    });
  });

  describe('normaliseInstrument()', () => {
    it('canonicalises hyphen/case variants', () => {
      expect(normaliseInstrument('PHQ-9')).toBe('PHQ9');
      expect(normaliseInstrument('phq9')).toBe('PHQ9');
      expect(normaliseInstrument('Gad-7')).toBe('GAD7');
      expect(normaliseInstrument('wemwbs')).toBe('WEMWBS');
    });

    it('returns null for nullish input', () => {
      expect(normaliseInstrument(null)).toBeNull();
      expect(normaliseInstrument(undefined)).toBeNull();
    });
  });

  describe('computeRCI() — symptom-burden instruments (higher = worse)', () => {
    it('flags a reliable improvement when symptoms drop beyond noise (PHQ-9 12 -> 7)', () => {
      const r = computeRCI('PHQ9', 12, 7); // delta -5; -5/2.43 = -2.06
      expect(r.delta).toBe(-5);
      expect(r.rci).toBe(-2.06);
      expect(r.is_reliable).toBe(true);
      expect(r.direction).toBe(DIRECTION.IMPROVEMENT);
      expect(r.sdiff).toBe(2.43);
    });

    it('reports "within noise" when the drop is too small (PHQ-9 12 -> 9)', () => {
      const r = computeRCI('PHQ9', 12, 9); // delta -3; -3/2.43 = -1.23
      expect(r.rci).toBe(-1.23);
      expect(r.is_reliable).toBe(false);
      expect(r.direction).toBe(DIRECTION.NONE);
    });

    it('flags a reliable deterioration when symptoms rise beyond noise (PHQ-9 5 -> 11)', () => {
      const r = computeRCI('PHQ9', 5, 11); // delta +6; 6/2.43 = 2.47
      expect(r.rci).toBe(2.47);
      expect(r.is_reliable).toBe(true);
      expect(r.direction).toBe(DIRECTION.DETERIORATION);
    });

    it('works for GAD-7 (improvement)', () => {
      const r = computeRCI('GAD-7', 15, 10); // delta -5; -5/2.33 = -2.15
      expect(r.rci).toBe(-2.15);
      expect(r.is_reliable).toBe(true);
      expect(r.direction).toBe(DIRECTION.IMPROVEMENT);
    });
  });

  describe('computeRCI() — WEMWBS (higher = better wellbeing, reversed polarity)', () => {
    it('flags a reliable improvement when wellbeing RISES beyond noise (40 -> 52)', () => {
      const r = computeRCI('WEMWBS', 40, 52); // delta +12; 12/4.67 = 2.57
      expect(r.delta).toBe(12);
      expect(r.rci).toBe(2.57);
      expect(r.is_reliable).toBe(true);
      expect(r.direction).toBe(DIRECTION.IMPROVEMENT); // rising wellbeing = improvement
    });

    it('flags a reliable deterioration when wellbeing FALLS beyond noise (52 -> 40)', () => {
      const r = computeRCI('WEMWBS', 52, 40); // delta -12
      expect(r.is_reliable).toBe(true);
      expect(r.direction).toBe(DIRECTION.DETERIORATION);
    });
  });

  describe('computeRCI() — threshold boundary', () => {
    it('counts exactly |RCI| = 1.96 as reliable (inclusive)', () => {
      const recent = RCI_THRESHOLD * SDIFF.PHQ9; // 1.96 * 2.43 = 4.7628
      const r = computeRCI('PHQ9', 0, recent);
      expect(r.rci).toBe(1.96);
      expect(r.is_reliable).toBe(true);
    });

    it('counts just below 1.96 as not reliable', () => {
      const r = computeRCI('PHQ9', 0, 4.7); // 4.7/2.43 = 1.9342
      expect(r.is_reliable).toBe(false);
      expect(r.direction).toBe(DIRECTION.NONE);
    });
  });

  describe('computeRCI() — normalisation + invalid input', () => {
    it('gives the same result regardless of instrument spelling', () => {
      expect(computeRCI('phq-9', 12, 7)).toEqual(computeRCI('PHQ9', 12, 7));
    });

    it('returns null for an unknown instrument', () => {
      expect(computeRCI('XYZ', 5, 3)).toBeNull();
      expect(computeRCI(null, 5, 3)).toBeNull();
    });

    it('returns null when either score is missing or non-finite', () => {
      expect(computeRCI('PHQ9', null, 5)).toBeNull();
      expect(computeRCI('PHQ9', 5, undefined)).toBeNull();
      expect(computeRCI('PHQ9', NaN, 5)).toBeNull();
      expect(computeRCI('PHQ9', 5, Infinity)).toBeNull();
    });

    it('handles no change (delta 0) as within noise', () => {
      const r = computeRCI('PHQ9', 8, 8);
      expect(r.delta).toBe(0);
      expect(r.rci).toBe(0);
      expect(r.is_reliable).toBe(false);
      expect(r.direction).toBe(DIRECTION.NONE);
    });
  });
});

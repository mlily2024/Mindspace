/**
 * Tests for banditContext (C.1, ADR-0018) — the context vector builder.
 */
const { buildContextVector, CONTEXT_DIM, norm10 } = require('../src/utils/banditContext');

describe('norm10', () => {
  it('maps the 1..10 scale to [0,1] and defaults missing to neutral', () => {
    expect(norm10(1)).toBeCloseTo(0, 9);
    expect(norm10(10)).toBeCloseTo(1, 9);
    expect(norm10(5.5)).toBeCloseTo(0.5, 9);
    expect(norm10(undefined)).toBe(0.5);
    expect(norm10('nope')).toBe(0.5);
  });
});

describe('buildContextVector', () => {
  it('has the fixed dimension with a leading bias term', () => {
    const v = buildContextVector({ mood_score: 5, stress_level: 5, anxiety_level: 5, energy_level: 5 }, null, 12);
    expect(v).toHaveLength(CONTEXT_DIM);
    expect(v[0]).toBe(1);
  });

  it('encodes hour-of-day cyclically (0 == 24; 6h -> sin 1, cos 0)', () => {
    const v0 = buildContextVector({}, null, 0);
    const v24 = buildContextVector({}, null, 24);
    expect(v0[5]).toBeCloseTo(v24[5], 9);
    expect(v0[6]).toBeCloseTo(v24[6], 9);

    const v6 = buildContextVector({}, null, 6);
    expect(v6[5]).toBeCloseTo(1, 9); // sin(pi/2)
    expect(v6[6]).toBeCloseTo(0, 9); // cos(pi/2)
  });

  it('places normalised mood features in [0,1]', () => {
    const v = buildContextVector({ mood_score: 10, stress_level: 1, anxiety_level: 1, energy_level: 10 }, null, 12);
    expect(v[1]).toBeCloseTo(1, 9); // mood 10
    expect(v[2]).toBeCloseTo(0, 9); // stress 1
    expect(v[4]).toBeCloseTo(1, 9); // energy 10
  });
});

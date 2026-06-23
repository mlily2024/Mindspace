/**
 * Tests for contextualBandit (C.1, ADR-0018) — the pure LinUCB core.
 */
const { createBandit, recommend, update, invert } = require('../src/services/contextualBandit');

describe('invert', () => {
  it('inverts the identity to itself', () => {
    expect(invert([[1, 0], [0, 1]])).toEqual([[1, 0], [0, 1]]);
  });

  it('inverts a known 2x2 matrix', () => {
    // [[4,7],[2,6]]^-1 = [[0.6,-0.7],[-0.2,0.4]]
    const inv = invert([[4, 7], [2, 6]]);
    expect(inv[0][0]).toBeCloseTo(0.6, 6);
    expect(inv[0][1]).toBeCloseTo(-0.7, 6);
    expect(inv[1][0]).toBeCloseTo(-0.2, 6);
    expect(inv[1][1]).toBeCloseTo(0.4, 6);
  });

  it('throws on a singular matrix', () => {
    expect(() => invert([[1, 2], [2, 4]])).toThrow(/singular/);
  });
});

describe('contextualBandit', () => {
  it('recommends among the given arms and returns a score per arm', () => {
    const b = createBandit(2, { alpha: 1 });
    const { arm, scores } = recommend(b, ['x', 'y'], [1, 0]);
    expect(['x', 'y']).toContain(arm);
    expect(Object.keys(scores).sort()).toEqual(['x', 'y']);
  });

  it('learns to prefer the higher-reward arm under a fixed context', () => {
    const b = createBandit(2, { alpha: 0.5 });
    const x = [1, 0];
    for (let i = 0; i < 15; i += 1) {
      update(b, 'good', x, 1);
      update(b, 'bad', x, 0);
    }
    expect(recommend(b, ['good', 'bad'], x).arm).toBe('good');
  });

  it('uses context: the best arm flips with the context feature', () => {
    const b = createBandit(2, { alpha: 0.3 });
    // Train: when feature=+1 arm A pays; when feature=-1 arm B pays.
    for (let i = 0; i < 30; i += 1) {
      update(b, 'A', [1, 1], 1);
      update(b, 'A', [1, -1], 0);
      update(b, 'B', [1, 1], 0);
      update(b, 'B', [1, -1], 1);
    }
    expect(recommend(b, ['A', 'B'], [1, 1]).arm).toBe('A');
    expect(recommend(b, ['A', 'B'], [1, -1]).arm).toBe('B');
  });

  it('throws when asked to recommend with no arms', () => {
    expect(() => recommend(createBandit(2), [], [1, 0])).toThrow(/no arms/);
  });
});

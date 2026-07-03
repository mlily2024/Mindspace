/**
 * Tests for patternEmbedding (A.3, ADR-0024) — the contrastive encoder.
 *
 * The load-bearing test is the numerical gradient check: it proves the analytic
 * triplet-loss back-propagation matches finite differences, so "loss decreases"
 * later is trustworthy rather than coincidental.
 */
const {
  trainContrastive,
  embed,
  forward,
  initWeights,
  mulberry32,
  _internal: { sub, dot, zeroGrad, tripletStep },
} = require('../src/services/patternEmbedding');

const clone = (w) => JSON.parse(JSON.stringify(w));
const sqDist = (a, b) => dot(sub(a, b), sub(a, b));

/** Scalar triplet loss for a weight set (squared distances, hinge at 0). */
function tripletLoss(w, xa, xp, xn, margin) {
  const ea = embed(xa, w);
  const ep = embed(xp, w);
  const en = embed(xn, w);
  return Math.max(0, margin + sqDist(ea, ep) - sqDist(ea, en));
}

/** Synthetic cohort: nGroups prototypes + gaussian noise, deterministic. */
function makeCohort(nGroups, perGroup, dim, seed) {
  const rng = mulberry32(seed);
  const gauss = () => {
    let s = 0;
    for (let i = 0; i < 6; i += 1) s += rng();
    return (s - 3) / 1.5; // ~N(0,1)-ish
  };
  const protos = [];
  for (let g = 0; g < nGroups; g += 1) protos.push(Array.from({ length: dim }, () => gauss()));
  const data = [];
  for (let g = 0; g < nGroups; g += 1) {
    for (let k = 0; k < perGroup; k += 1) {
      data.push({ group: g, features: protos[g].map((v) => v + 0.25 * gauss()) });
    }
  }
  return data;
}

describe('encoder forward', () => {
  const w = initWeights(6, 8, 4, mulberry32(1));

  it('produces an L2-normalised embedding of the right dimension', () => {
    const e = embed([0.1, -0.2, 0.3, 0.0, 0.5, -0.4], w);
    expect(e).toHaveLength(4);
    expect(Math.sqrt(e.reduce((s, v) => s + v * v, 0))).toBeCloseTo(1, 6);
  });

  it('is deterministic for the same weights and input', () => {
    const x = [0.2, 0.2, -0.1, 0.4, -0.3, 0.1];
    expect(embed(x, w)).toEqual(embed(x, w));
  });
});

describe('analytic gradient matches finite differences', () => {
  const w = initWeights(5, 6, 3, mulberry32(7));
  const xa = [0.3, -0.1, 0.2, 0.4, -0.2];
  const xp = [0.1, 0.5, -0.3, 0.2, 0.1];
  const xn = [-0.4, 0.2, 0.3, -0.1, 0.5];
  // Squared distances of unit vectors are in [0,4], so a margin of 5 forces the
  // hinge open (loss >= 1) for ANY inputs — the check then genuinely exercises
  // the back-prop. The gradient is margin-independent while the triplet is active.
  const margin = 5.0;

  it('the triplet is active (non-zero loss)', () => {
    expect(tripletLoss(w, xa, xp, xn, margin)).toBeGreaterThan(0);
  });

  it('analytic W2/W1/b gradients equal central differences', () => {
    const g = zeroGrad(w);
    tripletStep(forward(xa, w), forward(xp, w), forward(xn, w), margin, w, g);

    const eps = 1e-5;
    const numGrad = (get, set) => {
      const wp = clone(w);
      set(wp, get(w) + eps);
      const lp = tripletLoss(wp, xa, xp, xn, margin);
      set(wp, get(w) - eps);
      const lm = tripletLoss(wp, xa, xp, xn, margin);
      return (lp - lm) / (2 * eps);
    };

    // check a spread of W2, W1 and bias entries
    const checks = [
      [() => w.W2[0][0], (ww, v) => { ww.W2[0][0] = v; }, g.W2[0][0]],
      [() => w.W2[2][4], (ww, v) => { ww.W2[2][4] = v; }, g.W2[2][4]],
      [() => w.W1[1][3], (ww, v) => { ww.W1[1][3] = v; }, g.W1[1][3]],
      [() => w.W1[5][0], (ww, v) => { ww.W1[5][0] = v; }, g.W1[5][0]],
      [() => w.b2[1], (ww, v) => { ww.b2[1] = v; }, g.b2[1]],
      [() => w.b1[2], (ww, v) => { ww.b1[2] = v; }, g.b1[2]],
    ];
    checks.forEach(([get, set, analytic]) => {
      expect(analytic).toBeCloseTo(numGrad(get, set), 5);
    });
  });
});

describe('training', () => {
  const data = makeCohort(4, 25, 6, 123);

  it('decreases the triplet loss over epochs', () => {
    const { history } = trainContrastive(data, { epochs: 80, lr: 0.15, seed: 3 });
    const first = history.slice(0, 5).reduce((s, v) => s + v, 0) / 5;
    const last = history.slice(-5).reduce((s, v) => s + v, 0) / 5;
    expect(last).toBeLessThan(first);
  });

  it('embeds same-group patterns closer than different-group after training', () => {
    const { weights } = trainContrastive(data, { epochs: 120, lr: 0.15, seed: 3 });
    const emb = data.map((d) => ({ group: d.group, e: embed(d.features, weights) }));
    let same = 0;
    let sameN = 0;
    let diff = 0;
    let diffN = 0;
    for (let i = 0; i < emb.length; i += 1) {
      for (let j = i + 1; j < emb.length; j += 1) {
        const d = Math.sqrt(sqDist(emb[i].e, emb[j].e));
        if (emb[i].group === emb[j].group) { same += d; sameN += 1; } else { diff += d; diffN += 1; }
      }
    }
    expect(same / sameN).toBeLessThan(diff / diffN);
  });

  it('is deterministic given a seed', () => {
    const a = trainContrastive(data, { epochs: 10, seed: 9 }).weights;
    const b = trainContrastive(data, { epochs: 10, seed: 9 }).weights;
    expect(a).toEqual(b);
  });

  it('rejects a single-group dataset', () => {
    expect(() => trainContrastive([{ features: [0, 0], group: 0 }], { epochs: 1 })).toThrow(/2 groups/);
  });
});

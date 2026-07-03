/**
 * patternEmbedding — a small contrastive-embedding encoder for peer-similarity
 * matching (A.3, ADR-0024). Pure and dependency-free.
 *
 * Motivation (from the A.3 note): the live peer matcher buckets users into 5
 * rule-based clusters, which is coarse. This module learns a low-dimensional
 * EMBEDDING of a user's mood-pattern feature vector (from patternFeatures.js)
 * such that users with similar rhythms land close together — a continuous
 * space rather than 5 fixed bins.
 *
 * Architecture: a 1-hidden-layer MLP encoder
 *   h = tanh(W1 x + b1)      (dimHidden)
 *   z = W2 h + b2            (dimEmb)
 *   e = z / ||z||            (L2-normalised embedding)
 *
 * Trained with a triplet margin loss (Schroff et al. 2015, "FaceNet"):
 *   L = max(0, margin + ||e_a - e_p||^2 - ||e_a - e_n||^2)
 * pulling same-group patterns together and pushing different-group apart,
 * optimised by SGD with analytic back-propagation. Deterministic given a seed
 * (mulberry32 RNG), so training and tests are reproducible.
 *
 * This is the OFFLINE engine only — like the C.1 bandit and D.1 crisis models,
 * it is built and evaluated against synthetic data and wired as an opt-in path;
 * the live rule-based matcher stays the default until there are enough users
 * (>=200) to train on real data.
 */

const DEFAULT_HIDDEN = 16;
const DEFAULT_EMB = 8;

/** Deterministic PRNG (mulberry32). Returns a function producing [0,1). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- small linear-algebra helpers (vectors are plain arrays) ----------------
const matVec = (W, x) => W.map((row) => row.reduce((s, w, j) => s + w * x[j], 0));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const l2 = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0));

function randMatrix(rows, cols, rng, scale) {
  const M = [];
  for (let i = 0; i < rows; i += 1) {
    const row = new Array(cols);
    for (let j = 0; j < cols; j += 1) row[j] = (rng() * 2 - 1) * scale;
    M.push(row);
  }
  return M;
}

/** Initialise encoder weights for the given dims (Xavier-ish). */
function initWeights(dimIn, dimHidden, dimEmb, rng) {
  return {
    dims: { in: dimIn, hidden: dimHidden, emb: dimEmb },
    W1: randMatrix(dimHidden, dimIn, rng, Math.sqrt(1 / dimIn)),
    b1: new Array(dimHidden).fill(0),
    W2: randMatrix(dimEmb, dimHidden, rng, Math.sqrt(1 / dimHidden)),
    b2: new Array(dimEmb).fill(0),
  };
}

const EPS = 1e-8;

/** Forward pass keeping intermediates needed for back-prop. */
function forward(x, w) {
  const u = matVec(w.W1, x).map((v, i) => v + w.b1[i]);
  const h = u.map(Math.tanh);
  const z = matVec(w.W2, h).map((v, i) => v + w.b2[i]);
  const nz = Math.sqrt(dot(z, z) + EPS);
  const e = z.map((v) => v / nz);
  return { x, h, z, nz, e };
}

/** Public: the L2-normalised embedding of a feature vector. */
function embed(x, w) {
  return forward(x, w).e;
}

/** Euclidean distance between two embeddings. */
const distance = (e1, e2) => l2(sub(e1, e2));

/** Zero gradient accumulator matching the weight shapes. */
function zeroGrad(w) {
  return {
    W1: w.W1.map((row) => row.map(() => 0)),
    b1: w.b1.map(() => 0),
    W2: w.W2.map((row) => row.map(() => 0)),
    b2: w.b2.map(() => 0),
  };
}

/**
 * Back-propagate dL/de through one forward pass, accumulating into `g`.
 * Handles the L2-normalisation Jacobian, W2/b2, tanh, W1/b1.
 */
function backprop(fw, gE, w, g) {
  const { x, h, z, nz, e } = fw;
  // through e = z / nz :  dz = (gE - (gE.e) e) / nz
  const gDotE = dot(gE, e);
  const gZ = z.map((_, i) => (gE[i] - gDotE * e[i]) / nz);
  // through z = W2 h + b2
  for (let i = 0; i < w.dims.emb; i += 1) {
    g.b2[i] += gZ[i];
    for (let j = 0; j < w.dims.hidden; j += 1) g.W2[i][j] += gZ[i] * h[j];
  }
  // dh = W2^T gZ
  const gH = new Array(w.dims.hidden).fill(0);
  for (let j = 0; j < w.dims.hidden; j += 1) {
    let s = 0;
    for (let i = 0; i < w.dims.emb; i += 1) s += w.W2[i][j] * gZ[i];
    gH[j] = s;
  }
  // through h = tanh(u) :  du = gH * (1 - h^2)
  const gU = gH.map((v, j) => v * (1 - h[j] * h[j]));
  // through u = W1 x + b1
  for (let j = 0; j < w.dims.hidden; j += 1) {
    g.b1[j] += gU[j];
    for (let k = 0; k < w.dims.in; k += 1) g.W1[j][k] += gU[j] * x[k];
  }
}

/** Triplet loss + gradient accumulation for one (anchor, pos, neg) triple. */
function tripletStep(fa, fp, fn, margin, w, g) {
  const dAP = dot(sub(fa.e, fp.e), sub(fa.e, fp.e));
  const dAN = dot(sub(fa.e, fn.e), sub(fa.e, fn.e));
  const loss = margin + dAP - dAN;
  if (loss <= 0) return 0; // inactive triplet, no gradient
  // dL/de_a = 2(e_n - e_p); dL/de_p = 2(e_p - e_a); dL/de_n = 2(e_a - e_n)
  backprop(fa, sub(fn.e, fp.e).map((v) => 2 * v), w, g);
  backprop(fp, sub(fp.e, fa.e).map((v) => 2 * v), w, g);
  backprop(fn, sub(fa.e, fn.e).map((v) => 2 * v), w, g);
  return loss;
}

/** Apply an averaged gradient step with optional L2 weight decay. */
function applyGrad(w, g, lr, n, decay) {
  const step = (W, G) => {
    for (let i = 0; i < W.length; i += 1) {
      for (let j = 0; j < W[i].length; j += 1) W[i][j] -= lr * (G[i][j] / n + decay * W[i][j]);
    }
  };
  const stepV = (v, gv) => {
    for (let i = 0; i < v.length; i += 1) v[i] -= lr * (gv[i] / n);
  };
  step(w.W1, g.W1);
  step(w.W2, g.W2);
  stepV(w.b1, g.b1);
  stepV(w.b2, g.b2);
}

/**
 * Train the encoder with triplet loss over a labelled dataset.
 *
 * @param {Array<{features:number[], group:(number|string)}>} dataset
 * @param {object} [opts]
 * @returns {{weights:object, history:number[]}} trained weights + per-epoch loss
 */
function trainContrastive(dataset, opts = {}) {
  const {
    epochs = 60,
    lr = 0.1,
    margin = 0.5,
    dimHidden = DEFAULT_HIDDEN,
    dimEmb = DEFAULT_EMB,
    decay = 1e-4,
    seed = 42,
  } = opts;
  if (!dataset.length) throw new Error('trainContrastive: empty dataset');
  const rng = mulberry32(seed);
  const dimIn = dataset[0].features.length;
  const w = initWeights(dimIn, dimHidden, dimEmb, rng);

  // group -> member indices, for positive/negative sampling
  const byGroup = new Map();
  dataset.forEach((d, i) => {
    if (!byGroup.has(d.group)) byGroup.set(d.group, []);
    byGroup.get(d.group).push(i);
  });
  const groups = [...byGroup.keys()];
  if (groups.length < 2) throw new Error('trainContrastive: need >= 2 groups');

  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const history = [];

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const g = zeroGrad(w);
    let total = 0;
    let active = 0;
    for (let a = 0; a < dataset.length; a += 1) {
      const anchor = dataset[a];
      const sameGroup = byGroup.get(anchor.group);
      if (sameGroup.length < 2) continue; // need a distinct positive
      let p = pick(sameGroup);
      while (p === a) p = pick(sameGroup);
      let ng = pick(groups);
      while (ng === anchor.group) ng = pick(groups);
      const n = pick(byGroup.get(ng));

      const fa = forward(anchor.features, w);
      const fp = forward(dataset[p].features, w);
      const fn = forward(dataset[n].features, w);
      const loss = tripletStep(fa, fp, fn, margin, w, g);
      total += loss;
      active += 1;
    }
    if (active > 0) applyGrad(w, g, lr, active, decay);
    history.push(active > 0 ? total / active : 0);
  }
  return { weights: w, history };
}

module.exports = {
  trainContrastive,
  embed,
  forward,
  distance,
  initWeights,
  mulberry32,
  DEFAULT_HIDDEN,
  DEFAULT_EMB,
  _internal: { matVec, dot, sub, l2, backprop, tripletStep, zeroGrad },
};

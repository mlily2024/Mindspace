/**
 * embeddingEvalService — offline evaluation of the A.3 contrastive embedding
 * against the live rule-based 5-cluster matcher (ADR-0024). Pure; no I/O.
 *
 * Like the C.1 bandit and D.1 crisis harnesses, this is the rigorous,
 * reproducible part: it synthesises a labelled cohort with KNOWN latent pattern
 * groups, trains the encoder on a train split, then measures how well each
 * matcher separates same-group from different-group pairs on a held-out split,
 * scored by pairwise ROC-AUC ("given a same-group pair and a different-group
 * pair, how often is the same-group pair ranked more similar?").
 *
 * The cohort deliberately includes groups that COLLAPSE under the rule-based
 * scheme (e.g. two flat mid-level rhythms that differ only in their weekly
 * cycle both land in the same cluster) so the eval shows the embedding's finer,
 * continuous resolution. Seeded throughout for determinism.
 */

const { extractFeatures } = require('./patternFeatures');
const { trainContrastive, embed, distance, mulberry32 } = require('./patternEmbedding');

// Rule-based classifier — mirrors enhancedPeerService.classifyPattern (the live
// baseline). Kept inline so this offline harness pulls in no DB-coupled module.
function classifyPattern(avgMood, variability, trendSlope) {
  if (variability > 2.0) return 2; // volatile
  if (trendSlope < -0.05) return 3; // declining
  if (trendSlope > 0.05) return 4; // improving
  if (avgMood >= 6) return 0; // stable-high (unreachable on a 1..5 scale — as in prod)
  return 1; // stable-low
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const std = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length);
};
function ols(a) {
  const n = a.length;
  const xm = (n - 1) / 2;
  const ym = mean(a);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (i - xm) * (a[i] - ym);
    den += (i - xm) * (i - xm);
  }
  return den === 0 ? 0 : num / den;
}

// Latent group prototypes: {level, amp, period, trend}. The rule-based scheme
// genuinely separates the two clear-trend groups (declining -> cluster 3,
// improving -> cluster 4) but COLLAPSES the three flat groups (0, 1, 4) into
// one cluster even though they differ in weekly-cycle amplitude / rhythm. The
// embedding is expected to recover the rhythm distinctions the clusters lose.
const DEFAULT_PROTOS = [
  { level: 3.0, amp: 0.2, period: 7, trend: 0.0 }, // flat, faint cycle
  { level: 3.0, amp: 1.2, period: 7, trend: 0.0 }, // flat, strong weekly cycle
  { level: 3.6, amp: 0.4, period: 7, trend: -0.09 }, // clearly declining -> cluster 3
  { level: 2.4, amp: 0.4, period: 7, trend: 0.09 }, // clearly improving -> cluster 4
  { level: 3.0, amp: 1.7, period: 3, trend: 0.0 }, // fast oscillation (sub-threshold)
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Build a synthetic cohort of users with known latent groups. */
function makeCohort({ perGroup = 40, days = 30, seed = 1, noise = 0.4, protos = DEFAULT_PROTOS } = {}) {
  const rng = mulberry32(seed);
  const gauss = () => {
    let s = 0;
    for (let i = 0; i < 6; i += 1) s += rng();
    return (s - 3) / 1.5;
  };
  const users = [];
  for (let g = 0; g < protos.length; g += 1) {
    const p = protos[g];
    for (let k = 0; k < perGroup; k += 1) {
      const phase = rng() * Math.PI * 2;
      const moods = [];
      for (let t = 0; t < days; t += 1) {
        const cyc = p.amp * Math.sin((2 * Math.PI * t) / p.period + phase);
        const val = p.level + cyc + p.trend * t + noise * gauss();
        moods.push(clamp(val, 1, 5));
      }
      const features = extractFeatures(moods);
      if (!features) continue;
      users.push({
        group: g,
        features,
        cluster: classifyPattern(mean(moods), std(moods), ols(moods)),
      });
    }
  }
  return users;
}

/** ROC-AUC via average-rank (Mann-Whitney), tie-safe. label 1 = positive. */
function auc(labels, scores) {
  const n = labels.length;
  const order = scores.map((s, i) => ({ s, y: labels[i] })).sort((a, b) => a.s - b.s);
  // average ranks (1-based) for ties
  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && order[j].s === order[i].s) j += 1;
    const avg = (i + 1 + j) / 2; // average of ranks [i+1 .. j]
    for (let k = i; k < j; k += 1) ranks[k] = avg;
    i = j;
  }
  let sumPos = 0;
  let nPos = 0;
  for (let k = 0; k < n; k += 1) {
    if (order[k].y) {
      sumPos += ranks[k];
      nPos += 1;
    }
  }
  const nNeg = n - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;
  return (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

/** Deterministic Fisher-Yates using a seeded rng. */
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Run the offline eval: train the embedding on a split, then compare embedding
 * vs rule-based same-group separation (pairwise AUC) on the held-out split.
 *
 * @returns {{nUsers,nGroups,nTest,embAUC,ruleAUC,improvement,history}}
 */
function runEval(opts = {}) {
  const { perGroup = 40, days = 30, seed = 1, trainFrac = 0.7, trainOpts = {} } = opts;
  const cohort = makeCohort({ perGroup, days, seed });
  const rng = mulberry32(seed + 1);
  const shuffled = shuffle(cohort, rng);
  const nTrain = Math.floor(shuffled.length * trainFrac);
  const train = shuffled.slice(0, nTrain);
  const test = shuffled.slice(nTrain);

  const { weights, history } = trainContrastive(train, { epochs: 120, lr: 0.15, seed, ...trainOpts });

  const emb = test.map((u) => ({ group: u.group, cluster: u.cluster, e: embed(u.features, weights) }));

  const labels = [];
  const embScores = [];
  const ruleScores = [];
  for (let a = 0; a < emb.length; a += 1) {
    for (let b = a + 1; b < emb.length; b += 1) {
      labels.push(emb[a].group === emb[b].group ? 1 : 0);
      embScores.push(-distance(emb[a].e, emb[b].e)); // closer = more similar
      ruleScores.push(emb[a].cluster === emb[b].cluster ? 1 : 0);
    }
  }
  const embAUC = auc(labels, embScores);
  const ruleAUC = auc(labels, ruleScores);
  return {
    nUsers: cohort.length,
    nGroups: DEFAULT_PROTOS.length,
    nTest: test.length,
    embAUC,
    ruleAUC,
    improvement: embAUC - ruleAUC,
    finalLoss: history[history.length - 1],
    history,
  };
}

module.exports = {
  runEval,
  makeCohort,
  auc,
  _internal: { classifyPattern, mean, std, ols, shuffle, DEFAULT_PROTOS },
};

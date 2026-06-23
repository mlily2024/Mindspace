/**
 * crisisEvalService — offline evaluation for the crisis early-warning model
 * (D.1, ADR-0019).
 *
 * Generates synthetic labelled mood trajectories (deteriorating vs stable), trains
 * the model on a split, and reports classification metrics with the FALSE-NEGATIVE
 * rate foregrounded — for a crisis screen a missed case is the dangerous error, so
 * recall is the safety metric, not accuracy.
 *
 * Honesty: real evaluation needs real labelled crisis episodes (rare, hard to
 * label) and clinical sign-off. This synthetic harness demonstrates the mechanism
 * and the metric emphasis; it is NOT a validation on real users. Pure: no I/O.
 */

const { extractFeatures } = require('../utils/crisisFeatures');
const { train, predictRisk } = require('./crisisEarlyWarning');

/** One synthetic window. label 1 = heading toward crisis (deteriorating/unstable). */
function makeWindow(label, windowLen, rng) {
  const w = [];
  if (label === 1) {
    let level = 5 + rng() * 2; // starts mid
    const decline = 0.25 + rng() * 0.4; // per-step deterioration
    for (let i = 0; i < windowLen; i += 1) {
      level -= decline;
      const noise = (rng() - 0.5) * 2.5; // instability
      w.push(Math.min(10, Math.max(1, level + noise)));
    }
  } else {
    const base = 4 + rng() * 4; // stable somewhere 4..8
    for (let i = 0; i < windowLen; i += 1) {
      const noise = (rng() - 0.5) * 1.5;
      w.push(Math.min(10, Math.max(1, base + noise)));
    }
  }
  return w;
}

function generateLabelled({ n, windowLen, rng }) {
  const windows = [];
  const labels = [];
  for (let i = 0; i < n; i += 1) {
    const label = rng() < 0.5 ? 1 : 0;
    windows.push(makeWindow(label, windowLen, rng));
    labels.push(label);
  }
  return { windows, labels };
}

/** Threshold-free AUC via the Mann-Whitney statistic. */
function auc(scores, labels) {
  const pos = [];
  const neg = [];
  scores.forEach((s, i) => (labels[i] === 1 ? pos : neg).push(s));
  if (pos.length === 0 || neg.length === 0) return null;
  const order = scores.map((s, i) => ({ s, y: labels[i] })).sort((a, b) => a.s - b.s);
  let rankSum = 0;
  for (let i = 0; i < order.length; i += 1) {
    if (order[i].y === 1) rankSum += i + 1; // ranks are 1-based
  }
  return (rankSum - (pos.length * (pos.length + 1)) / 2) / (pos.length * neg.length);
}

/**
 * @param {object} cfg
 * @param {number} [cfg.n] total examples
 * @param {number} [cfg.windowLen]
 * @param {number} [cfg.trainFrac]
 * @param {number} [cfg.threshold] decision threshold for the binary metrics
 * @param {()=>number} [cfg.rng]
 */
function runSyntheticEval({ n = 600, windowLen = 14, trainFrac = 0.7, threshold = 0.5, rng = Math.random } = {}) {
  const { windows, labels } = generateLabelled({ n, windowLen, rng });
  const X = windows.map(extractFeatures);
  const y = labels;

  const cut = Math.floor(n * trainFrac);
  const model = train(X.slice(0, cut), y.slice(0, cut), { epochs: 400, lr: 0.3 });

  const Xte = X.slice(cut);
  const yte = y.slice(cut);
  const scores = Xte.map((x) => predictRisk(model, x));

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  scores.forEach((s, i) => {
    const pred = s >= threshold ? 1 : 0;
    if (pred === 1 && yte[i] === 1) tp += 1;
    else if (pred === 1 && yte[i] === 0) fp += 1;
    else if (pred === 0 && yte[i] === 0) tn += 1;
    else fn += 1;
  });

  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision && recall ? (2 * precision * recall) / (precision + recall) : null;

  return {
    n,
    test: yte.length,
    threshold,
    confusion: { tp, fp, tn, fn },
    precision,
    recall,
    f1,
    accuracy: (tp + tn) / yte.length,
    falseNegativeRate: tp + fn ? fn / (tp + fn) : null,
    auc: auc(scores, yte),
    note:
      'ADJUNCT screen, synthetic data. Recall / false-negative rate are the safety ' +
      'metrics. Augments, never replaces, the SafetyFilter. Real validation needs ' +
      'labelled crisis episodes + clinical sign-off; not wired into any live path.',
  };
}

module.exports = { runSyntheticEval, generateLabelled, auc, makeWindow };

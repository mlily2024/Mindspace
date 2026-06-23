#!/usr/bin/env node
/**
 * Offline evaluation for the crisis-trajectory early-warning model (D.1, ADR-0019).
 *
 * Trains the adjunct logistic-regression risk model on synthetic labelled mood
 * trajectories and reports classification metrics, foregrounding RECALL and the
 * FALSE-NEGATIVE rate — for a crisis screen a missed case is the dangerous error.
 *
 * IMPORTANT: this is an ADJUNCT screen. It AUGMENTS, never replaces, the keyword
 * SafetyFilter (ADR-0003), it is OFFLINE and NOT wired into any live alerting path,
 * and real validation needs labelled crisis episodes + clinical sign-off. The
 * synthetic numbers demonstrate the mechanism, not real-user performance.
 *
 * Usage:
 *   node backend/scripts/crisis-earlywarning-eval.js [--n N] [--window W] [--threshold T] [--out path]
 */
/* eslint-disable no-console */

const path = require('path');
const fs = require('fs');
const { runSyntheticEval } = require('../src/services/crisisEvalService');

function parseArgs(argv) {
  const a = { n: 800, window: 14, threshold: 0.5, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const [k, v] = argv[i].split('=');
    const next = () => v ?? argv[(i += 1)];
    if (k === '--n') a.n = parseInt(next(), 10);
    else if (k === '--window') a.window = parseInt(next(), 10);
    else if (k === '--threshold') a.threshold = parseFloat(next());
    else if (k === '--out') a.out = next();
  }
  return a;
}

const pct = (v) => (v == null ? '  n/a' : (v * 100).toFixed(1) + '%');

const args = parseArgs(process.argv);
const r = runSyntheticEval({ n: args.n, windowLen: args.window, threshold: args.threshold });

console.log(`\nCrisis early-warning — synthetic evaluation (ADJUNCT, offline)`);
console.log(`Test set: ${r.test} windows, decision threshold ${r.threshold}\n`);
console.log(`  AUC (threshold-free) : ${r.auc == null ? 'n/a' : r.auc.toFixed(3)}`);
console.log(`  Recall (safety)      : ${pct(r.recall)}   <- the metric that matters most`);
console.log(`  False-negative rate  : ${pct(r.falseNegativeRate)}   <- missed cases (dangerous)`);
console.log(`  Precision            : ${pct(r.precision)}`);
console.log(`  F1                   : ${pct(r.f1)}`);
console.log(`  Accuracy             : ${pct(r.accuracy)}`);
console.log(`  Confusion (tp/fp/tn/fn): ${r.confusion.tp}/${r.confusion.fp}/${r.confusion.tn}/${r.confusion.fn}`);
console.log(`\n${r.note}`);

const outPath = args.out || path.resolve(__dirname, '..', 'data', 'crisis_earlywarning_report.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(r, null, 2), 'utf8');
console.log(`\nReport written to ${outPath}`);

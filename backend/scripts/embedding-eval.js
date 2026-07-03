#!/usr/bin/env node
/**
 * Offline evaluation for the peer-similarity contrastive embedding (A.3, ADR-0024).
 *
 * Synthesises a labelled cohort with KNOWN latent mood-pattern groups, trains the
 * encoder on a split, and compares how well the learned embedding vs the live
 * rule-based 5-cluster scheme separate same-group from different-group pairs
 * (pairwise ROC-AUC) on the held-out split.
 *
 * Illustrative — exercises the engine on synthetic data; the near-perfect
 * embedding AUC is mechanism-demonstration, NOT a claim about real users. The
 * live rule-based matcher (enhancedPeerService.findPatternMatches) is NOT
 * touched; wiring the embedding in as an opt-in matcher is the activation step
 * once there are >= 200 users with >= 30 days of data.
 *
 * Usage:
 *   node backend/scripts/embedding-eval.js [--seed N] [--perGroup N] [--epochs N]
 */
/* eslint-disable no-console */

const { runEval } = require('../src/services/embeddingEvalService');

function parseArgs(argv) {
  const a = { seed: 1, perGroup: 40, epochs: 120 };
  for (let i = 2; i < argv.length; i += 1) {
    const [k, v] = argv[i].split('=');
    const next = () => v ?? argv[(i += 1)];
    if (k === '--seed') a.seed = parseInt(next(), 10);
    else if (k === '--perGroup') a.perGroup = parseInt(next(), 10);
    else if (k === '--epochs') a.epochs = parseInt(next(), 10);
  }
  return a;
}

function main() {
  const args = parseArgs(process.argv);
  const r = runEval({ seed: args.seed, perGroup: args.perGroup, trainOpts: { epochs: args.epochs } });

  console.log('=== Peer-similarity embedding — offline eval (A.3) ===');
  console.log(`  cohort         : ${r.nUsers} users across ${r.nGroups} latent groups`);
  console.log(`  held-out test  : ${r.nTest} users`);
  console.log(`  final loss     : ${r.finalLoss.toFixed(4)}`);
  console.log('');
  console.log('  same-group separation (pairwise ROC-AUC, higher is better):');
  console.log(`    rule-based 5-cluster : ${r.ruleAUC.toFixed(4)}`);
  console.log(`    learned embedding    : ${r.embAUC.toFixed(4)}`);
  console.log(`    improvement          : ${(r.improvement >= 0 ? '+' : '') + r.improvement.toFixed(4)}`);
  console.log('');
  const verdict =
    r.embAUC > r.ruleAUC
      ? 'Embedding recovers rhythm structure the rule-based clusters collapse.'
      : 'No improvement on this configuration.';
  console.log(`  ${verdict}`);
  console.log('  (Synthetic mechanism-demo. Activate on real data at >= 200 users.)');
}

main();

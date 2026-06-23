#!/usr/bin/env node
/**
 * Offline evaluation for the micro-intervention contextual bandit (C.1, ADR-0018).
 *
 * `--source synthetic` (default): runs the bandit against a controlled environment
 *   with a known oracle, comparing it to the current rules baseline and random.
 *   Illustrative — exercises the engine; not a claim about real users.
 * `--source db`: offline replay over logged user_interventions outcomes (approximate;
 *   see banditEvalService.replayLoggedData for the bias caveat).
 *
 * The live rules selector (microInterventionService.selectIntervention) is NOT
 * touched; wiring the bandit in as a selector behind a flag is the activation step
 * once there is enough logged data.
 *
 * Usage:
 *   node backend/scripts/bandit-eval.js [--source synthetic|db] [--rounds N] [--alpha A]
 */
/* eslint-disable no-console */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { pool } = require('../src/config/database');
const { runSyntheticEval, replayLoggedData } = require('../src/services/banditEvalService');
const { CONTEXT_DIM } = require('../src/utils/banditContext');

const ARMS = ['breathing', 'grounding', 'behavioral_activation', 'gratitude', 'cognitive_reframe'];

function parseArgs(argv) {
  const a = { source: 'synthetic', rounds: 3000, alpha: 0.4, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const [k, v] = argv[i].split('=');
    const next = () => v ?? argv[(i += 1)];
    if (k === '--source') a.source = next();
    else if (k === '--rounds') a.rounds = parseInt(next(), 10);
    else if (k === '--alpha') a.alpha = parseFloat(next());
    else if (k === '--out') a.out = next();
  }
  return a;
}

// context x = [bias, mood, stress, anxiety, energy, sinH, cosH]
const contextGen = (rng) => {
  const hour = Math.floor(rng() * 24);
  const angle = (2 * Math.PI * hour) / 24;
  return [1, rng(), rng(), rng(), rng(), Math.sin(angle), Math.cos(angle)];
};
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Each intervention is best in a different region of mood/stress/anxiety/energy.
function rewardFn(x, arm) {
  const [, mood, stress, anxiety, energy] = x;
  switch (arm) {
    case 'breathing': return clamp01(0.5 * stress + 0.5 * anxiety);
    case 'grounding': return clamp01(anxiety);
    case 'behavioral_activation': return clamp01(0.5 * (1 - mood) + 0.5 * (1 - energy));
    case 'gratitude': return clamp01(1 - 2 * Math.abs(mood - 0.5));
    case 'cognitive_reframe': return clamp01(0.6 * (1 - mood) + 0.4 * energy);
    default: return 0;
  }
}

// One-size-fits-all rule, mirroring microInterventionService's threshold scoring.
function rulesPolicy(x) {
  const [, mood, stress, anxiety, energy] = x;
  if (anxiety >= 0.7) return 'grounding';
  if (stress >= 0.7) return 'breathing';
  if (mood <= 0.4 && energy <= 0.4) return 'behavioral_activation';
  if (mood <= 0.4) return 'cognitive_reframe';
  return 'gratitude';
}

async function loadLoggedTuples() {
  // Approximate: pair each delivered intervention with the user's nearest mood entry
  // for context. Reward = completed ? rating/5 : 0.
  const r = await pool.query(
    `SELECT mi.intervention_code AS arm,
            ui.was_completed, ui.user_rating, ui.triggered_at,
            me.mood_score, me.stress_level, me.anxiety_level, me.energy_level
       FROM user_interventions ui
       JOIN micro_interventions mi ON mi.intervention_id = ui.intervention_id
       LEFT JOIN LATERAL (
         SELECT mood_score, stress_level, anxiety_level, energy_level
           FROM mood_entries m
          WHERE m.user_id = ui.user_id AND m.created_at <= ui.triggered_at
          ORDER BY m.created_at DESC LIMIT 1
       ) me ON true
      WHERE ui.was_shown = TRUE`
  );
  const n10 = (v) => (Number.isFinite(Number(v)) ? (Number(v) - 1) / 9 : 0.5);
  return r.rows
    .filter((row) => ARMS.includes(row.arm))
    .map((row) => {
      const hour = new Date(row.triggered_at).getHours();
      const angle = (2 * Math.PI * hour) / 24;
      return {
        x: [1, n10(row.mood_score), n10(row.stress_level), n10(row.anxiety_level), n10(row.energy_level), Math.sin(angle), Math.cos(angle)],
        arm: row.arm,
        reward: row.was_completed ? (Number(row.user_rating) || 0) / 5 : 0,
      };
    });
}

function printSynthetic(r) {
  console.log(`\nRounds: ${r.rounds}`);
  console.log('\n  policy      avg reward    avg regret');
  console.log('  ----------  ----------    ----------');
  const row = (name, rew, reg) =>
    console.log(`  ${name.padEnd(10)}  ${rew.toFixed(3).padStart(8)}    ${reg === null ? '     -' : reg.toFixed(3).padStart(8)}`);
  row('oracle', r.avgReward.oracle, null);
  row('bandit', r.avgReward.bandit, r.avgRegret.bandit);
  row('rules', r.avgReward.rules, r.avgRegret.rules);
  row('random', r.avgReward.random, r.avgRegret.random);
  console.log('\n(higher reward / lower regret is better; illustrative synthetic environment)');
}

const main = async () => {
  const args = parseArgs(process.argv);
  try {
    let report;
    if (args.source === 'db') {
      const tuples = await loadLoggedTuples();
      console.log(`Loaded ${tuples.length} logged intervention outcomes.`);
      report = { source: 'db', ...replayLoggedData(tuples, { arms: ARMS, dim: CONTEXT_DIM, alpha: args.alpha }) };
      console.log(report);
      if (tuples.length === 0) console.log('No logged data yet — run once interventions have been delivered.');
    } else {
      const result = runSyntheticEval({
        arms: ARMS, dim: CONTEXT_DIM, rounds: args.rounds, alpha: args.alpha,
        rewardFn, rulesPolicy, contextGen, noise: 0.1,
      });
      report = { source: 'synthetic', ...result };
      printSynthetic(result);
    }

    const outPath = args.out || path.resolve(__dirname, '..', 'data', 'bandit_eval_report.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nReport written to ${outPath}`);
  } catch (err) {
    console.error('Bandit eval failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

main();

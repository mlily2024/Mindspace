/**
 * banditEvalService — offline evaluation for the contextual bandit (C.1, ADR-0018).
 *
 * Two modes:
 *  - runSyntheticEval: a controlled environment with a known reward function and
 *    oracle, so we can show the bandit's average regret falls below random and
 *    approaches the oracle, and compare it to the rules baseline. This is the
 *    rigorous, reproducible part (inject a seeded rng in tests).
 *  - replayLoggedData: offline replay over real logged (context, arm, reward)
 *    tuples (Li et al. 2011 rejection sampling). UNBIASED ONLY IF the logging
 *    policy was uniform over arms; the production rules policy is not, so the db
 *    estimate is explicitly flagged approximate.
 *
 * Pure orchestration: no DB, no I/O. The script wires in real data.
 */

const { createBandit, recommend, update } = require('./contextualBandit');

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * @param {object} cfg
 * @param {string[]} cfg.arms
 * @param {number} cfg.dim
 * @param {number} [cfg.rounds]
 * @param {number} [cfg.alpha]
 * @param {(x:number[], arm:string)=>number} cfg.rewardFn   expected reward in [0,1]
 * @param {(x:number[])=>string} [cfg.rulesPolicy]          baseline policy
 * @param {(rng:()=>number)=>number[]} cfg.contextGen
 * @param {()=>number} [cfg.rng]
 * @param {number} [cfg.noise]   observation noise amplitude
 */
function runSyntheticEval({
  arms,
  dim,
  rounds = 2000,
  alpha = 1.0,
  rewardFn,
  rulesPolicy = null,
  contextGen,
  rng = Math.random,
  noise = 0.1,
}) {
  const bandit = createBandit(dim, { alpha });
  const cum = { bandit: 0, rules: 0, random: 0, oracle: 0 };

  for (let t = 0; t < rounds; t += 1) {
    const x = contextGen(rng);

    // Expected reward per arm + the oracle.
    let oracleArm = arms[0];
    let oracleR = -Infinity;
    const exp = {};
    for (const a of arms) {
      const r = rewardFn(x, a);
      exp[a] = r;
      if (r > oracleR) {
        oracleR = r;
        oracleArm = a;
      }
    }
    void oracleArm;

    const banditArm = recommend(bandit, arms, x).arm;
    const observed = clamp01(exp[banditArm] + (rng() * 2 - 1) * noise);
    update(bandit, banditArm, x, observed);

    const rulesArm = rulesPolicy ? rulesPolicy(x) : arms[Math.floor(rng() * arms.length)];
    const randomArm = arms[Math.floor(rng() * arms.length)];

    cum.bandit += exp[banditArm];
    cum.rules += exp[rulesArm];
    cum.random += exp[randomArm];
    cum.oracle += oracleR;
  }

  const avg = (k) => cum[k] / rounds;
  const regret = (k) => (cum.oracle - cum[k]) / rounds;
  return {
    rounds,
    avgReward: { bandit: avg('bandit'), rules: avg('rules'), random: avg('random'), oracle: avg('oracle') },
    avgRegret: { bandit: regret('bandit'), rules: regret('rules'), random: regret('random') },
  };
}

/**
 * Offline replay over logged tuples.
 * @param {Array<{x:number[], arm:string, reward:number}>} tuples
 */
function replayLoggedData(tuples, { arms, dim, alpha = 1.0 }) {
  const bandit = createBandit(dim, { alpha });
  let matched = 0;
  let rewardSum = 0;
  let loggedSum = 0;

  for (const { x, arm, reward } of tuples) {
    loggedSum += reward;
    const chosen = recommend(bandit, arms, x).arm;
    if (chosen === arm) {
      matched += 1;
      rewardSum += reward;
      update(bandit, arm, x, reward);
    }
  }

  return {
    total: tuples.length,
    matched,
    estimatedAvgReward: matched ? rewardSum / matched : null,
    loggedAvgReward: tuples.length ? loggedSum / tuples.length : null,
    note:
      'Replay is unbiased only under uniform-random logging; the production rules ' +
      'policy is not uniform, so this db estimate is approximate. Randomise (epsilon) ' +
      'logging for a sound off-policy estimate.',
  };
}

module.exports = { runSyntheticEval, replayLoggedData };

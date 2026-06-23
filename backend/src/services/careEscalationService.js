/**
 * Care escalation evaluator (ADR-0013).
 *
 * Maps a user's recent validated assessments to a tier (crisis | elevated |
 * monitor) with step-up routing. AUGMENTS — never replaces — the keyword
 * SafetyFilter (ADR-0003) and the PHQ-9 item-9 crisis pathway. Persists
 * crisis/elevated outcomes to care_escalations with a per-(user,tier) cooldown.
 *
 * This is screening-derived signposting, NOT a diagnosis or a triage decision.
 */
const db = require('../config/database');
const logger = require('../config/logger');
const ValidatedAssessment = require('../models/ValidatedAssessment');
const { computeRCI } = require('../utils/reliableChange');
const carePathways = require('./carePathways');

const TIER = Object.freeze({ CRISIS: 'crisis', ELEVATED: 'elevated', MONITOR: 'monitor' });
const INSTRUMENTS = ['PHQ9', 'GAD7', 'PSS4', 'ISI', 'WEMWBS'];

// Severity ordering shared across instruments (severity_tier string -> rank).
const SEVERITY_RANK = Object.freeze({
  minimal: 0, none: 0, normal: 0,
  mild: 1,
  moderate: 2,
  moderately_severe: 3,
  severe: 4,
});
const rankOf = (tier) => SEVERITY_RANK[String(tier || '').toLowerCase()] ?? 0;

const COOLDOWN_HOURS = 24;

/**
 * Evaluate the user's current escalation tier from their latest assessments.
 * Pure read — does not persist.
 * @returns {Promise<{tier, severity, crisis, reasons:string[], pathways:object[], signals:object[]}>}
 */
async function evaluate(userId) {
  // Latest two per instrument (two are needed for the RCI deterioration check).
  const perInstrument = {};
  for (const inst of INSTRUMENTS) {
    /* eslint-disable no-await-in-loop */
    const rows = await ValidatedAssessment.getUserAssessments(userId, { instrument: inst, limit: 2 });
    /* eslint-enable no-await-in-loop */
    if (rows.length) perInstrument[inst] = rows;
  }

  const signals = [];
  let crisis = false;
  let mildOrWorseCount = 0; // instruments at mild+ — for the batched "several yellow flags" case
  let anyReliableDeterioration = false;
  let maxRank = 0;

  for (const inst of Object.keys(perInstrument)) {
    const [latest, previous] = perInstrument[inst];
    const rank = rankOf(latest.severity_tier);
    maxRank = Math.max(maxRank, rank);
    if (rank >= 1) mildOrWorseCount += 1;

    if (latest.has_crisis_flag) {
      crisis = true;
      signals.push({ instrument: inst, kind: 'crisis_flag' });
    }
    if (rank >= 4) { // severe
      crisis = true;
      signals.push({ instrument: inst, kind: 'severe', tier: latest.severity_tier });
    }

    if (previous) {
      const rci = computeRCI(inst, previous.total_score, latest.total_score);
      if (rci && rci.direction === 'reliable_deterioration') {
        anyReliableDeterioration = true;
        signals.push({ instrument: inst, kind: 'reliable_deterioration', rci: rci.rci });
      }
    }
  }

  // Tier rules — biased toward catching (under-triggering is the dangerous failure).
  // crisis: a crisis flag or any severe score.
  // elevated: any single moderate-or-worse, OR a reliable deterioration, OR the
  //           batched case (>=2 instruments mildly elevated with none moderate).
  let tier = TIER.MONITOR;
  const reasons = [];
  if (crisis) {
    tier = TIER.CRISIS;
    reasons.push('A recent screening result indicates possible crisis-level risk.');
  } else if (maxRank >= 2 || anyReliableDeterioration || mildOrWorseCount >= 2) {
    tier = TIER.ELEVATED;
    if (maxRank >= 3) reasons.push('A recent score is in the moderately-severe range.');
    else if (maxRank >= 2) reasons.push('A recent score is in the moderate range.');
    if (anyReliableDeterioration) reasons.push('A recent score has reliably worsened since last time.');
    if (maxRank < 2 && mildOrWorseCount >= 2) reasons.push('Several recent scores are mildly elevated.');
  }

  const pathways = tier === TIER.CRISIS
    ? carePathways.crisisResources()
    : tier === TIER.ELEVATED
      ? carePathways.stepUpPathways()
      : carePathways.selfCarePathways();

  return { tier, severity: maxRank, crisis, reasons, pathways, signals };
}

/**
 * Persist a crisis/elevated outcome to care_escalations, respecting a
 * per-(user,tier) cooldown so re-taking a questionnaire doesn't duplicate.
 * Never throws — escalation persistence must not break the assessment flow.
 * @returns {Promise<string|null>} escalation_id or null
 */
async function recordIfNeeded(userId, evaluation) {
  if (!evaluation || (evaluation.tier !== TIER.CRISIS && evaluation.tier !== TIER.ELEVATED)) {
    return null;
  }
  try {
    const recent = await db.query(
      `SELECT 1 FROM care_escalations
        WHERE user_id = $1 AND trigger_type = $2
          AND created_at > NOW() - INTERVAL '${COOLDOWN_HOURS} hours'
        LIMIT 1`,
      [userId, evaluation.tier]
    );
    if (recent.rows.length) return null; // within cooldown

    const result = await db.query(
      `INSERT INTO care_escalations (user_id, trigger_type, trigger_details, severity, recommended_action)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING escalation_id`,
      [
        userId,
        evaluation.tier,
        JSON.stringify({ reasons: evaluation.reasons, signals: evaluation.signals }),
        evaluation.tier === TIER.CRISIS ? 'critical' : 'elevated',
        evaluation.reasons.join(' '),
      ]
    );
    logger.warn('Care escalation recorded', {
      userId, tier: evaluation.tier, escalation_id: result.rows[0].escalation_id,
    });
    return result.rows[0].escalation_id;
  } catch (e) {
    logger.error('Failed to record care escalation', { userId, error: e.message });
    return null;
  }
}

module.exports = { evaluate, recordIfNeeded, TIER, SEVERITY_RANK };

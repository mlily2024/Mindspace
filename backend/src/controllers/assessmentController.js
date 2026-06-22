const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const ValidatedAssessment = require('../models/ValidatedAssessment');
const {
  INSTRUMENTS,
  getInstrument,
  listInstrumentSummaries,
} = require('../data/screeningInstruments');
const { UK_CRISIS_RESOURCES } = require('../services/safetyFilter');
const { computeRCI } = require('../utils/reliableChange');

/**
 * Assessment controller — wires the /api/assessments routes onto
 * ValidatedAssessment + screeningInstruments.
 *
 * Replaces the TODO stubs that shipped with bd1ab09 (which only built
 * the model + schema + scoring). The Assessments.jsx page has been
 * waiting on these real implementations.
 *
 * Crisis-flag handling (PHQ-9 Q9 → SafetyFilter / safety_alerts) is
 * intentionally NOT in this commit — it ships separately so the
 * "wire the controller" change reads cleanly in history. This file
 * does already PROPAGATE has_crisis_flag in the submit response so
 * the follow-up commit only needs to add the alert-row insert + the
 * resources payload.
 */

// Human-readable interpretation per severity tier. Wording is chosen
// to be neutral and validated-instrument-faithful — we never tell a
// user what their score "means clinically", only what band it falls
// in by published scoring rules. Citations live in INSTRUMENTS.
const SEVERITY_INTERPRETATIONS = Object.freeze({
  PHQ9: {
    minimal:           'Your score falls in the minimal range for depressive symptoms.',
    mild:              'Your score suggests mild depressive symptoms. Watchful waiting and self-care are reasonable next steps.',
    moderate:          'Your score suggests moderate depressive symptoms. Speaking with a clinician or counsellor is often helpful at this level.',
    moderately_severe: 'Your score suggests moderately severe depressive symptoms. Clinical support is typically recommended.',
    severe:            'Your score suggests severe depressive symptoms. Please consider reaching out to a mental health professional.',
  },
  GAD7: {
    minimal:  'Your score falls in the minimal range for anxiety symptoms.',
    mild:     'Your score suggests mild anxiety symptoms.',
    moderate: 'Your score suggests moderate anxiety. Clinical support can be helpful at this level.',
    severe:   'Your score suggests severe anxiety. Please consider reaching out to a mental health professional.',
  },
  PSS4: {
    low:      'Your score suggests a lower perceived-stress band.',
    moderate: 'Your score suggests a moderate perceived-stress band.',
    high:     'Your score suggests a higher perceived-stress band.',
  },
  ISI: {
    absent:       'Your score falls below the threshold for clinically significant insomnia.',
    subthreshold: 'Your score suggests subthreshold insomnia.',
    moderate:     'Your score suggests moderate clinical insomnia.',
    severe:       'Your score suggests severe clinical insomnia.',
  },
  WEMWBS: {
    low_wellbeing:     'Your score falls in the lower mental-wellbeing band.',
    average_wellbeing: 'Your score falls in the average mental-wellbeing band.',
    high_wellbeing:    'Your score falls in the higher mental-wellbeing band.',
  },
});

const interpretationFor = (instrument, tier) =>
  SEVERITY_INTERPRETATIONS[instrument]?.[tier] || null;

/**
 * Insert a row in safety_alerts when an instrument fires its crisis flag.
 * Currently only PHQ-9 has a crisisIndex (Q9, "thoughts you would be better
 * off dead or of hurting yourself") — any value >= 1 fires.
 *
 * Mirrors insightsEngine.createSafetyAlert (services/insightsEngine.js:263)
 * so a single safety_alerts dashboard surfaces crises from both the mood
 * pipeline and the screening pipeline.
 *
 * Failures here MUST NOT block the assessment response — the user already
 * answered the questionnaire; a logging failure should not look like the
 * submission failed. We log and swallow.
 */
const recordCrisisAlert = async (userId, instrument, created) => {
  try {
    const inst = getInstrument(instrument);
    const alertData = {
      source:          'validated_assessment',
      instrument,
      assessment_id:   created.assessment_id,
      total_score:     created.total_score,
      severity_tier:   created.severity_tier,
      crisis_index:    inst?.crisisIndex,
      message:         'Suicidal-ideation item endorsed during a validated screening assessment.',
    };
    const alertId = uuidv4();
    await db.query(
      `INSERT INTO safety_alerts (alert_id, user_id, alert_type, severity, alert_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [alertId, userId, 'crisis_indicator', 'critical', JSON.stringify(alertData)]
    );
    logger.warn('Crisis safety alert created from assessment', {
      userId,
      instrument,
      assessment_id: created.assessment_id,
      alert_id: alertId,
    });
    // 2026-06-18: return the alert_id so submitResponse can include it
    // in the response payload. The frontend CrisisBanner uses it to call
    // PUT /api/insights/safety-alerts/:alertId/acknowledge, which clears
    // the gentle-greeting branch in Luna's session-open path within 24h.
    return alertId;
  } catch (e) {
    logger.error('Failed to persist crisis safety alert (assessment response still returned)', {
      userId,
      instrument,
      error: e.message,
    });
    return null;
  }
};

/**
 * Build the crisis-resources payload returned alongside a flagged
 * assessment response. Uses the SAME UK_CRISIS_RESOURCES table that
 * SafetyFilter exposes to Luna so the user sees consistent numbers
 * (Samaritans 116 123, Shout 85258, NHS 111, Papyrus 0800 068 4141,
 * 999) regardless of which surface raised the flag.
 *
 * Returned as a plain array of {name, contact, note} so the frontend
 * can render it without knowing the resource keys.
 */
const buildCrisisResourcesPayload = () => {
  const R = UK_CRISIS_RESOURCES;
  return [
    { name: R.samaritans.name, contact: R.samaritans.phone, note: R.samaritans.note },
    { name: R.shout.name,      contact: R.shout.sms,        note: '24/7, free' },
    { name: R.nhs.name,        contact: R.nhs.phone,        note: R.nhs.note },
    { name: R.papyrus.name,    contact: R.papyrus.phone,    note: R.papyrus.note },
    { name: R.emergency.name,  contact: R.emergency.phone,  note: R.emergency.note },
  ];
};

// Days since a date string / Date — null if no input
const daysSince = (when) => {
  if (!when) return null;
  const then = when instanceof Date ? when : new Date(when);
  const ms = Date.now() - then.getTime();
  return Math.floor(ms / 86_400_000);
};

/**
 * GET /api/assessments
 * Returns the catalogue joined with the user's most recent score per
 * instrument and an is_due flag based on recommendedFrequencyDays.
 */
const getAvailableAssessments = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const summaries = listInstrumentSummaries();
    const latest = await ValidatedAssessment.getLatestPerInstrument(userId);
    const lookup = new Map(latest.map(r => [r.instrument, r]));

    const assessments = summaries.map(s => {
      const last = lookup.get(s.code);
      const dSince = last ? daysSince(last.completed_at) : null;
      const is_due = !last || (dSince !== null && dSince >= s.recommendedFrequencyDays);
      return {
        instrument:    s.code,
        name:          s.name,
        full_name:     s.fullName,
        description:   s.description,
        question_count: s.questionCount,
        recommended_frequency_days: s.recommendedFrequencyDays,
        citation:      s.citation,
        is_due,
        last_score:    last?.total_score ?? null,
        last_severity: last?.severity_tier ?? null,
        last_taken:    last?.completed_at ?? null,
      };
    });

    res.json({ success: true, data: { assessments } });
  } catch (error) {
    logger.error('Error fetching available assessments', { error: error.message });
    next(error);
  }
};

/**
 * GET /api/assessments/:instrument
 * Returns the question set + scoring metadata for one instrument.
 * The questions are sent each time so the frontend never hard-codes
 * the wording — if we ever translate or revise an instrument we
 * change one server file, not 5 frontend bundles.
 */
const getAssessment = async (req, res, next) => {
  try {
    const { instrument } = req.params;
    const inst = getInstrument(instrument);
    if (!inst) {
      return res.status(404).json({ success: false, message: 'Unknown instrument' });
    }

    res.json({
      success: true,
      data: {
        instrument,
        name:           inst.name,
        full_name:      inst.fullName,
        description:    inst.description,
        questions:      inst.questions.map((text, index) => ({ index, text })),
        response_labels: inst.responseLabels,
        response_range: inst.responseRange,
        score_range:    inst.scoreRange,
        citation:       inst.citation,
      },
    });
  } catch (error) {
    logger.error('Error fetching assessment', { error: error.message });
    next(error);
  }
};

/**
 * POST /api/assessments/:instrument/submit
 * Persists a response set and returns the computed score + interpretation.
 *
 * Body: { answers: number[] }  (NOT assessmentId — the server generates it)
 *
 * The has_crisis_flag bit is propagated in the response so the
 * follow-up Q9 → safety_alert commit can attach resources without
 * changing this signature.
 */
const submitResponse = async (req, res, next) => {
  try {
    const { instrument } = req.params;
    const { answers, note } = req.body;
    const userId = req.user.userId;

    if (!getInstrument(instrument)) {
      return res.status(404).json({ success: false, message: 'Unknown instrument' });
    }

    // For the change-since-last calculation, grab the previous score
    // BEFORE the new row lands.
    const latest = await ValidatedAssessment.getLatestPerInstrument(userId);
    const prior = latest.find(r => r.instrument === instrument);
    const priorScore = prior ? prior.total_score : null;

    let created;
    try {
      created = await ValidatedAssessment.create(userId, {
        instrument,
        responses: answers,
        note: note || null,
      });
    } catch (e) {
      // scoreResponses throws on length/range mismatches — surface 400
      // not 500 so the frontend can show a useful message.
      return res.status(400).json({ success: false, message: e.message });
    }

    logger.info('Assessment submitted', {
      userId,
      instrument,
      score: created.total_score,
      severity: created.severity_tier,
      crisis: created.has_crisis_flag,
    });

    // Crisis path. recordCrisisAlert swallows its own errors so a
    // failed audit-row insert never causes the user's submission to
    // appear failed. We DO still surface the crisis_resources in the
    // response so the UI shows them even if the alert insert failed.
    // alertId is null when the insert failed; the banner just won't
    // be acknowledgeable in that case (resources still render).
    let crisisAlertId = null;
    if (created.has_crisis_flag) {
      crisisAlertId = await recordCrisisAlert(userId, instrument, created);
    }

    res.status(201).json({
      success: true,
      data: {
        assessment_id:    created.assessment_id,
        instrument,
        score:            created.total_score,
        total_score:      created.total_score,
        severity:         created.severity_tier,
        has_crisis_flag:  created.has_crisis_flag,
        interpretation:   interpretationFor(instrument, created.severity_tier),
        change:           priorScore !== null ? created.total_score - priorScore : null,
        completed_at:     created.completed_at,
        crisis_resources: created.has_crisis_flag ? buildCrisisResourcesPayload() : null,
        crisis_alert_id:  crisisAlertId,
        crisis_message:   created.has_crisis_flag
          ? "Thank you for sharing that with us. You marked an item about thoughts of being better off dead or hurting yourself. Please consider reaching out to one of the UK services below — they have people trained to help."
          : null,
      },
    });
  } catch (error) {
    logger.error('Error submitting assessment response', { error: error.message });
    next(error);
  }
};

/**
 * GET /api/assessments/:instrument/history
 * Returns the user's past assessments for one instrument, most recent first.
 */
const getHistory = async (req, res, next) => {
  try {
    const { instrument } = req.params;
    const { limit = 30 } = req.query;
    const userId = req.user.userId;

    if (!getInstrument(instrument)) {
      return res.status(404).json({ success: false, message: 'Unknown instrument' });
    }

    const rows = await ValidatedAssessment.getUserAssessments(userId, {
      instrument,
      limit: Number(limit),
    });

    const history = rows.map(r => ({
      assessment_id: r.assessment_id,
      instrument:    r.instrument,
      score:         r.total_score,
      total_score:   r.total_score,
      severity:      r.severity_tier,
      severity_tier: r.severity_tier,
      completed_at:  r.completed_at,
    }));

    // Attach Reliable Change Index vs the next-older same-instrument assessment.
    // rows are newest-first, so history[i+1] is the previous assessment in time.
    // Pure computation from the scores we already hold — no schema change. (ADR-0011)
    history.forEach((h, i) => {
      const previous = history[i + 1];
      h.reliable_change = previous
        ? computeRCI(instrument, previous.total_score, h.total_score)
        : null;
    });

    res.json({ success: true, data: { instrument, history } });
  } catch (error) {
    logger.error('Error fetching assessment history', { error: error.message });
    next(error);
  }
};

/**
 * GET /api/assessments/scores
 * Most recent score per instrument, used by Dashboard/Insights summaries.
 */
const getLatestScores = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const rows = await ValidatedAssessment.getLatestPerInstrument(userId);
    const scores = rows.map(r => ({
      instrument:    r.instrument,
      score:         r.total_score,
      severity:      r.severity_tier,
      completed_at:  r.completed_at,
    }));
    res.json({ success: true, data: { scores } });
  } catch (error) {
    logger.error('Error fetching latest scores', { error: error.message });
    next(error);
  }
};

/**
 * GET /api/assessments/due
 * Subset of the catalogue where is_due is true. Cheaper than
 * getAvailableAssessments() when a caller only needs the count
 * (e.g. a Dashboard pill).
 */
const checkDue = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const latest = await ValidatedAssessment.getLatestPerInstrument(userId);
    const lookup = new Map(latest.map(r => [r.instrument, r]));

    const due = Object.entries(INSTRUMENTS).reduce((acc, [code, def]) => {
      const last = lookup.get(code);
      const dSince = last ? daysSince(last.completed_at) : null;
      const is_due = !last || (dSince !== null && dSince >= def.recommendedFrequencyDays);
      if (is_due) {
        acc.push({
          instrument: code,
          name:       def.name,
          days_since_last: dSince,
          recommended_frequency_days: def.recommendedFrequencyDays,
        });
      }
      return acc;
    }, []);

    res.json({ success: true, data: { due, count: due.length } });
  } catch (error) {
    logger.error('Error checking due assessments', { error: error.message });
    next(error);
  }
};

module.exports = {
  getAvailableAssessments,
  getAssessment,
  submitResponse,
  getHistory,
  getLatestScores,
  checkDue,
};

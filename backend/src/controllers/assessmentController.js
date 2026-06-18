const logger = require('../config/logger');
const ValidatedAssessment = require('../models/ValidatedAssessment');
const {
  INSTRUMENTS,
  getInstrument,
  listInstrumentSummaries,
} = require('../data/screeningInstruments');

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

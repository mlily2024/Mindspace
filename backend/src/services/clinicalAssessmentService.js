const db = require('../config/database');

// ── Instrument Definitions ──────────────────────────────────────────────────

const INSTRUMENTS = {
  'PHQ-9': {
    name: 'PHQ-9',
    full_name: 'Patient Health Questionnaire-9',
    category: 'Depression',
    frequency_days: 14,
    min_score: 0,
    max_score: 27,
    items: [
      { position: 1, text: 'Little interest or pleasure in doing things' },
      { position: 2, text: 'Feeling down, depressed, or hopeless' },
      { position: 3, text: 'Trouble falling or staying asleep, or sleeping too much' },
      { position: 4, text: 'Feeling tired or having little energy' },
      { position: 5, text: 'Poor appetite or overeating' },
      { position: 6, text: 'Feeling bad about yourself, or that you are a failure, or have let yourself or your family down' },
      { position: 7, text: 'Trouble concentrating on things, such as reading the newspaper or watching television' },
      { position: 8, text: 'Moving or speaking so slowly that other people could have noticed, or the opposite — being so fidgety or restless that you have been moving around a lot more than usual' },
      { position: 9, text: 'Thoughts that you would be better off dead, or of hurting yourself', is_critical: true }
    ],
    options: [
      { value: 0, label: 'Not at all' },
      { value: 1, label: 'Several days' },
      { value: 2, label: 'More than half the days' },
      { value: 3, label: 'Nearly every day' }
    ],
    reverse_items: [],
    severity_ranges: [
      { min: 0, max: 4, label: 'Minimal' },
      { min: 5, max: 9, label: 'Mild' },
      { min: 10, max: 14, label: 'Moderate' },
      { min: 15, max: 19, label: 'Moderately Severe' },
      { min: 20, max: 27, label: 'Severe' }
    ]
  },
  'GAD-7': {
    name: 'GAD-7',
    full_name: 'Generalized Anxiety Disorder-7',
    category: 'Anxiety',
    frequency_days: 14,
    min_score: 0,
    max_score: 21,
    items: [
      { position: 1, text: 'Feeling nervous, anxious, or on edge' },
      { position: 2, text: 'Not being able to stop or control worrying' },
      { position: 3, text: 'Worrying too much about different things' },
      { position: 4, text: 'Trouble relaxing' },
      { position: 5, text: 'Being so restless that it is hard to sit still' },
      { position: 6, text: 'Becoming easily annoyed or irritable' },
      { position: 7, text: 'Feeling afraid, as if something awful might happen' }
    ],
    options: [
      { value: 0, label: 'Not at all' },
      { value: 1, label: 'Several days' },
      { value: 2, label: 'More than half the days' },
      { value: 3, label: 'Nearly every day' }
    ],
    reverse_items: [],
    severity_ranges: [
      { min: 0, max: 4, label: 'Minimal' },
      { min: 5, max: 9, label: 'Mild' },
      { min: 10, max: 14, label: 'Moderate' },
      { min: 15, max: 21, label: 'Severe' }
    ]
  },
  'PSS-4': {
    name: 'PSS-4',
    full_name: 'Perceived Stress Scale-4',
    category: 'Stress',
    frequency_days: 7,
    min_score: 0,
    max_score: 16,
    items: [
      { position: 1, text: 'How often have you felt that you were unable to control the important things in your life?' },
      { position: 2, text: 'How often have you felt confident about your ability to handle your personal problems?', is_reverse: true },
      { position: 3, text: 'How often have you felt that things were going your way?', is_reverse: true },
      { position: 4, text: 'How often have you felt difficulties were piling up so high that you could not overcome them?' }
    ],
    options: [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Almost never' },
      { value: 2, label: 'Sometimes' },
      { value: 3, label: 'Fairly often' },
      { value: 4, label: 'Very often' }
    ],
    reverse_items: [2, 3],
    severity_ranges: [
      { min: 0, max: 4, label: 'Low' },
      { min: 5, max: 8, label: 'Moderate' },
      { min: 9, max: 12, label: 'High' },
      { min: 13, max: 16, label: 'Very High' }
    ]
  },
  'WEMWBS': {
    name: 'WEMWBS',
    full_name: 'Warwick-Edinburgh Mental Wellbeing Scale',
    category: 'Wellbeing',
    frequency_days: 30,
    min_score: 14,
    max_score: 70,
    items: [
      { position: 1, text: "I've been feeling optimistic about the future" },
      { position: 2, text: "I've been feeling useful" },
      { position: 3, text: "I've been feeling relaxed" },
      { position: 4, text: "I've been feeling interested in other people" },
      { position: 5, text: "I've had energy to spare" },
      { position: 6, text: "I've been dealing with problems well" },
      { position: 7, text: "I've been thinking clearly" },
      { position: 8, text: "I've been feeling good about myself" },
      { position: 9, text: "I've been feeling close to other people" },
      { position: 10, text: "I've been feeling confident" },
      { position: 11, text: "I've been able to make up my own mind about things" },
      { position: 12, text: "I've been feeling loved" },
      { position: 13, text: "I've been interested in new things" },
      { position: 14, text: "I've been feeling cheerful" }
    ],
    options: [
      { value: 1, label: 'None of the time' },
      { value: 2, label: 'Rarely' },
      { value: 3, label: 'Some of the time' },
      { value: 4, label: 'Often' },
      { value: 5, label: 'All of the time' }
    ],
    reverse_items: [],
    severity_ranges: [
      { min: 14, max: 32, label: 'Low' },
      { min: 33, max: 44, label: 'Below Average' },
      { min: 45, max: 59, label: 'Average' },
      { min: 60, max: 70, label: 'High' }
    ]
  },
  'ISI': {
    name: 'ISI',
    full_name: 'Insomnia Severity Index',
    category: 'Sleep',
    frequency_days: 30,
    min_score: 0,
    max_score: 28,
    items: [
      { position: 1, text: 'Difficulty falling asleep' },
      { position: 2, text: 'Difficulty staying asleep' },
      { position: 3, text: 'Problems waking up too early' },
      { position: 4, text: 'How satisfied/dissatisfied are you with your current sleep pattern?' },
      { position: 5, text: 'How noticeable to others do you think your sleep problem is in terms of impairing the quality of your life?' },
      { position: 6, text: 'How worried/distressed are you about your current sleep problem?' },
      { position: 7, text: 'To what extent do you consider your sleep problem to currently interfere with your daily functioning?' }
    ],
    options: [
      { value: 0, label: '0' },
      { value: 1, label: '1' },
      { value: 2, label: '2' },
      { value: 3, label: '3' },
      { value: 4, label: '4' }
    ],
    reverse_items: [],
    severity_ranges: [
      { min: 0, max: 7, label: 'None' },
      { min: 8, max: 14, label: 'Subthreshold' },
      { min: 15, max: 21, label: 'Moderate' },
      { min: 22, max: 28, label: 'Severe' }
    ]
  }
};

// ── Helper Functions ────────────────────────────────────────────────────────

function calculateScore(instrument, answers) {
  const def = INSTRUMENTS[instrument];
  if (!def) throw new Error(`Unknown instrument: ${instrument}`);

  let total = 0;
  const flags = [];

  for (const item of def.items) {
    const raw = answers[item.position];
    if (raw === undefined || raw === null) {
      throw new Error(`Missing answer for item ${item.position}`);
    }

    let score = Number(raw);
    if (def.reverse_items.includes(item.position)) {
      const maxOption = Math.max(...def.options.map(o => o.value));
      score = maxOption - score;
    }

    total += score;

    if (item.is_critical && score >= 1) {
      flags.push({
        item_position: item.position,
        item_text: item.text,
        score,
        flag_type: 'safety_alert'
      });
    }
  }

  return { total, flags };
}

function getSeverity(instrument, score) {
  const def = INSTRUMENTS[instrument];
  if (!def) return 'Unknown';

  for (const range of def.severity_ranges) {
    if (score >= range.min && score <= range.max) {
      return range.label;
    }
  }
  return 'Unknown';
}

// ── Service ─────────────────────────────────────────────────────────────────

const clinicalAssessmentService = {
  /**
   * Seeds all 5 standardised assessments with their items and scoring rules.
   */
  async seedAssessments() {
    for (const key of Object.keys(INSTRUMENTS)) {
      const inst = INSTRUMENTS[key];

      const existing = await db.get(
        'SELECT id FROM clinical_assessments WHERE name = ?',
        [inst.name]
      );
      if (existing) continue;

      const result = await db.run(
        `INSERT INTO clinical_assessments (name, full_name, category, frequency_days, min_score, max_score, severity_ranges, options)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inst.name,
          inst.full_name,
          inst.category,
          inst.frequency_days,
          inst.min_score,
          inst.max_score,
          JSON.stringify(inst.severity_ranges),
          JSON.stringify(inst.options)
        ]
      );

      const assessmentId = result.lastID;

      for (const item of inst.items) {
        await db.run(
          `INSERT INTO clinical_assessment_items (assessment_id, position, text, is_reverse, is_critical)
           VALUES (?, ?, ?, ?, ?)`,
          [
            assessmentId,
            item.position,
            item.text,
            item.is_reverse ? 1 : 0,
            item.is_critical ? 1 : 0
          ]
        );
      }
    }
  },

  /**
   * Returns available assessments with last_taken date and whether due.
   */
  async getAvailableAssessments(userId) {
    const assessments = await db.all(
      'SELECT * FROM clinical_assessments ORDER BY name'
    );

    const results = [];
    for (const a of assessments) {
      const lastResponse = await db.get(
        `SELECT completed_at FROM clinical_assessment_responses
         WHERE user_id = ? AND assessment_id = ?
         ORDER BY completed_at DESC LIMIT 1`,
        [userId, a.id]
      );

      const lastTaken = lastResponse ? lastResponse.completed_at : null;
      let isDue = true;
      if (lastTaken) {
        const lastDate = new Date(lastTaken);
        const now = new Date();
        const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        isDue = daysSince >= a.frequency_days;
      }

      results.push({
        id: a.id,
        name: a.name,
        full_name: a.full_name,
        category: a.category,
        frequency_days: a.frequency_days,
        last_taken: lastTaken,
        is_due: isDue
      });
    }

    return results;
  },

  /**
   * Returns full assessment definition with items.
   */
  async getAssessment(instrumentName) {
    const def = INSTRUMENTS[instrumentName];
    if (!def) return null;

    const dbRecord = await db.get(
      'SELECT * FROM clinical_assessments WHERE name = ?',
      [instrumentName]
    );

    return {
      id: dbRecord ? dbRecord.id : null,
      name: def.name,
      full_name: def.full_name,
      category: def.category,
      frequency_days: def.frequency_days,
      min_score: def.min_score,
      max_score: def.max_score,
      items: def.items,
      options: def.options,
      severity_ranges: def.severity_ranges
    };
  },

  /**
   * Calculates score, determines severity, records flags, and saves response.
   * @param {number} userId
   * @param {number} assessmentId - DB id of the clinical_assessments row
   * @param {string} instrument - instrument name e.g. 'PHQ-9'
   * @param {object} answers - { itemPosition: score, ... }
   * @returns {object} { responseId, score, severity, flags }
   */
  async submitResponse(userId, assessmentId, instrument, answers) {
    const { total, flags } = calculateScore(instrument, answers);
    const severity = getSeverity(instrument, total);

    const result = await db.run(
      `INSERT INTO clinical_assessment_responses
         (user_id, assessment_id, instrument, answers, score, severity, flags, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        userId,
        assessmentId,
        instrument,
        JSON.stringify(answers),
        total,
        severity,
        JSON.stringify(flags)
      ]
    );

    // If there are safety flags, record them separately for quick lookup
    if (flags.length > 0) {
      for (const flag of flags) {
        await db.run(
          `INSERT INTO clinical_safety_flags
             (user_id, assessment_response_id, instrument, item_position, item_text, score, flag_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [
            userId,
            result.lastID,
            instrument,
            flag.item_position,
            flag.item_text,
            flag.score,
            flag.flag_type
          ]
        );
      }
    }

    return {
      responseId: result.lastID,
      score: total,
      severity,
      flags
    };
  },

  /**
   * Returns score history for a given instrument, ordered most recent first.
   */
  async getHistory(userId, instrument, limit = 20) {
    const rows = await db.all(
      `SELECT id, score, severity, flags, completed_at
       FROM clinical_assessment_responses
       WHERE user_id = ? AND instrument = ?
       ORDER BY completed_at DESC
       LIMIT ?`,
      [userId, instrument, limit]
    );

    return rows.map(r => ({
      id: r.id,
      score: r.score,
      severity: r.severity,
      flags: JSON.parse(r.flags || '[]'),
      completed_at: r.completed_at
    }));
  },

  /**
   * Returns the most recent score for each instrument the user has completed.
   */
  async getLatestScores(userId) {
    const instruments = Object.keys(INSTRUMENTS);
    const results = {};

    for (const inst of instruments) {
      const row = await db.get(
        `SELECT score, severity, flags, completed_at
         FROM clinical_assessment_responses
         WHERE user_id = ? AND instrument = ?
         ORDER BY completed_at DESC LIMIT 1`,
        [userId, inst]
      );

      if (row) {
        results[inst] = {
          score: row.score,
          severity: row.severity,
          flags: JSON.parse(row.flags || '[]'),
          completed_at: row.completed_at
        };
      }
    }

    return results;
  },

  /**
   * Returns which assessments are overdue based on frequency_days.
   */
  async checkDue(userId) {
    const assessments = await db.all(
      'SELECT * FROM clinical_assessments ORDER BY name'
    );

    const overdue = [];

    for (const a of assessments) {
      const lastResponse = await db.get(
        `SELECT completed_at FROM clinical_assessment_responses
         WHERE user_id = ? AND assessment_id = ?
         ORDER BY completed_at DESC LIMIT 1`,
        [userId, a.id]
      );

      let isDue = true;
      let daysSince = null;

      if (lastResponse) {
        const lastDate = new Date(lastResponse.completed_at);
        const now = new Date();
        daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        isDue = daysSince >= a.frequency_days;
      }

      if (isDue) {
        overdue.push({
          id: a.id,
          name: a.name,
          full_name: a.full_name,
          category: a.category,
          frequency_days: a.frequency_days,
          days_since_last: daysSince,
          never_taken: !lastResponse
        });
      }
    }

    return overdue;
  }
};

module.exports = clinicalAssessmentService;

/**
 * Tests for the assessmentController wiring (2026-06-18 commit).
 *
 * These exercise the controller against a mocked ValidatedAssessment +
 * mocked db, not real Postgres — that's the same pattern other Mindspace
 * controller tests use (changePassword.test.js, etc.).
 *
 * Coverage:
 *   - getAvailableAssessments returns the catalogue with is_due flags
 *     computed against the user's last completion + recommendedFrequencyDays
 *   - getAssessment returns questions for a known instrument; 404 for unknown
 *   - submitResponse persists via ValidatedAssessment.create and returns
 *     score + severity + interpretation + change-since-last
 *   - submitResponse propagates has_crisis_flag (the follow-up commit
 *     hooks safety alerts onto this; this test guards the contract)
 *   - submitResponse returns 400 for malformed answers (length / range)
 *   - getHistory returns the user's past rows for an instrument
 *   - checkDue returns only instruments past their recommended frequency
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';

jest.mock('../src/models/ValidatedAssessment');
jest.mock('../src/config/database', () => ({ query: jest.fn() }));

const ValidatedAssessment = require('../src/models/ValidatedAssessment');
const logger = require('../src/config/logger');
jest.spyOn(logger, 'info').mockImplementation(() => {});
jest.spyOn(logger, 'warn').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});

const assessmentController = require('../src/controllers/assessmentController');

const makeReqRes = (overrides = {}) => {
  const req = {
    user: { userId: 'u1' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json:   jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
};

const todayMinus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── getAvailableAssessments ───────────────────────────────────────────────

describe('getAvailableAssessments', () => {
  test('returns 5 instruments, marks ones never taken as is_due', async () => {
    ValidatedAssessment.getLatestPerInstrument.mockResolvedValue([]);
    const { req, res, next } = makeReqRes();
    await assessmentController.getAvailableAssessments(req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.assessments).toHaveLength(5);
    const codes = body.data.assessments.map(a => a.instrument);
    expect(codes).toEqual(expect.arrayContaining(['PHQ9', 'GAD7', 'PSS4', 'ISI', 'WEMWBS']));
    body.data.assessments.forEach(a => {
      expect(a.is_due).toBe(true);
      expect(a.last_score).toBeNull();
    });
  });

  test('PHQ9 NOT due if last taken within recommendedFrequencyDays', async () => {
    // PHQ9 recommendedFrequencyDays is 14 (per phqscreeners standard)
    ValidatedAssessment.getLatestPerInstrument.mockResolvedValue([
      { instrument: 'PHQ9', total_score: 4, severity_tier: 'minimal', completed_at: todayMinus(3) },
    ]);
    const { req, res, next } = makeReqRes();
    await assessmentController.getAvailableAssessments(req, res, next);

    const body = res.json.mock.calls[0][0];
    const phq9 = body.data.assessments.find(a => a.instrument === 'PHQ9');
    expect(phq9.is_due).toBe(false);
    expect(phq9.last_score).toBe(4);
    expect(phq9.last_severity).toBe('minimal');
  });
});

// ─── getAssessment ─────────────────────────────────────────────────────────

describe('getAssessment', () => {
  test('PHQ9: returns 9 questions + response labels', async () => {
    const { req, res, next } = makeReqRes({ params: { instrument: 'PHQ9' } });
    await assessmentController.getAssessment(req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.data.instrument).toBe('PHQ9');
    expect(body.data.questions).toHaveLength(9);
    expect(body.data.questions[0]).toEqual({ index: 0, text: expect.any(String) });
    expect(body.data.response_labels).toHaveLength(4);
  });

  test('unknown instrument → 404', async () => {
    const { req, res, next } = makeReqRes({ params: { instrument: 'BADCODE' } });
    await assessmentController.getAssessment(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── submitResponse ────────────────────────────────────────────────────────

describe('submitResponse', () => {
  test('happy path PHQ9: persists, returns score + severity + interpretation + change', async () => {
    ValidatedAssessment.getLatestPerInstrument.mockResolvedValue([
      { instrument: 'PHQ9', total_score: 8, severity_tier: 'mild', completed_at: todayMinus(20) },
    ]);
    ValidatedAssessment.create.mockResolvedValue({
      assessment_id:   'a1',
      instrument:      'PHQ9',
      total_score:     12,
      severity_tier:   'moderate',
      has_crisis_flag: false,
      completed_at:    new Date().toISOString(),
    });

    const { req, res, next } = makeReqRes({
      params: { instrument: 'PHQ9' },
      body: { answers: [1, 1, 1, 1, 1, 1, 2, 2, 2] },
    });
    await assessmentController.submitResponse(req, res, next);

    expect(ValidatedAssessment.create).toHaveBeenCalledWith('u1', expect.objectContaining({
      instrument: 'PHQ9',
      responses:  [1, 1, 1, 1, 1, 1, 2, 2, 2],
    }));
    expect(res.status).toHaveBeenCalledWith(201);

    const body = res.json.mock.calls[0][0];
    expect(body.data.score).toBe(12);
    expect(body.data.severity).toBe('moderate');
    expect(body.data.has_crisis_flag).toBe(false);
    expect(body.data.interpretation).toMatch(/moderate depressive symptoms/i);
    expect(body.data.change).toBe(4);  // 12 - 8
  });

  test('PHQ-9 Q9=2 propagates has_crisis_flag=true through the response', async () => {
    // The controller MUST forward the flag. The follow-up Q9 -> safety hook
    // builds on this — this test guards against accidentally dropping the
    // bit from the payload.
    ValidatedAssessment.getLatestPerInstrument.mockResolvedValue([]);
    ValidatedAssessment.create.mockResolvedValue({
      assessment_id:   'a2',
      instrument:      'PHQ9',
      total_score:     2,
      severity_tier:   'minimal',
      has_crisis_flag: true,
      completed_at:    new Date().toISOString(),
    });

    const { req, res, next } = makeReqRes({
      params: { instrument: 'PHQ9' },
      body: { answers: [0, 0, 0, 0, 0, 0, 0, 0, 2] },
    });
    await assessmentController.submitResponse(req, res, next);

    const body = res.json.mock.calls[0][0];
    expect(body.data.has_crisis_flag).toBe(true);
  });

  // ─── Q9 crisis-flag → safety_alert + crisis_resources (2026-06-18) ───

  test('PHQ-9 Q9 crisis flag → INSERT into safety_alerts AND crisis_resources payload', async () => {
    const db = require('../src/config/database');
    db.query.mockResolvedValue({ rowCount: 1 });

    ValidatedAssessment.getLatestPerInstrument.mockResolvedValue([]);
    ValidatedAssessment.create.mockResolvedValue({
      assessment_id:   'a-crisis',
      instrument:      'PHQ9',
      total_score:     10,
      severity_tier:   'moderate',
      has_crisis_flag: true,
      completed_at:    new Date().toISOString(),
    });

    const { req, res, next } = makeReqRes({
      params: { instrument: 'PHQ9' },
      body: { answers: [1, 1, 1, 1, 1, 1, 1, 1, 2] },
    });
    await assessmentController.submitResponse(req, res, next);

    // safety_alerts insert
    expect(db.query).toHaveBeenCalled();
    const insertCall = db.query.mock.calls.find(c => /INSERT INTO safety_alerts/.test(c[0]));
    expect(insertCall).toBeDefined();
    expect(insertCall[1][2]).toBe('crisis_indicator');
    expect(insertCall[1][3]).toBe('critical');
    const alertData = JSON.parse(insertCall[1][4]);
    expect(alertData).toEqual(expect.objectContaining({
      source: 'validated_assessment',
      instrument: 'PHQ9',
      assessment_id: 'a-crisis',
    }));

    // Response payload carries UK crisis resources + a non-empty message
    const body = res.json.mock.calls[0][0];
    expect(body.data.crisis_resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Samaritans',                contact: '116 123' }),
      expect.objectContaining({ name: 'NHS Mental Health Crisis Line', contact: '111' }),
      expect.objectContaining({ name: 'Emergency services',        contact: '999' }),
    ]));
    expect(body.data.crisis_message).toMatch(/UK services/);
  });

  test('no crisis flag → NO safety_alerts insert, crisis_resources is null', async () => {
    const db = require('../src/config/database');
    db.query.mockResolvedValue({ rowCount: 1 });

    ValidatedAssessment.getLatestPerInstrument.mockResolvedValue([]);
    ValidatedAssessment.create.mockResolvedValue({
      assessment_id:   'a-clean',
      instrument:      'PHQ9',
      total_score:     3,
      severity_tier:   'minimal',
      has_crisis_flag: false,
      completed_at:    new Date().toISOString(),
    });

    const { req, res, next } = makeReqRes({
      params: { instrument: 'PHQ9' },
      body: { answers: [1, 1, 1, 0, 0, 0, 0, 0, 0] },
    });
    await assessmentController.submitResponse(req, res, next);

    const insertCall = db.query.mock.calls.find(c => /INSERT INTO safety_alerts/.test(c[0]));
    expect(insertCall).toBeUndefined();

    const body = res.json.mock.calls[0][0];
    expect(body.data.crisis_resources).toBeNull();
    expect(body.data.crisis_message).toBeNull();
  });

  test('safety_alerts INSERT failure does NOT fail the assessment response', async () => {
    // Audit-log failures must not look like the submission failed.
    // The user already answered; we must still return 201 + crisis_resources.
    const db = require('../src/config/database');
    db.query.mockRejectedValue(new Error('safety_alerts table missing'));

    ValidatedAssessment.getLatestPerInstrument.mockResolvedValue([]);
    ValidatedAssessment.create.mockResolvedValue({
      assessment_id:   'a-resilient',
      instrument:      'PHQ9',
      total_score:     2,
      severity_tier:   'minimal',
      has_crisis_flag: true,
      completed_at:    new Date().toISOString(),
    });

    const { req, res, next } = makeReqRes({
      params: { instrument: 'PHQ9' },
      body: { answers: [0, 0, 0, 0, 0, 0, 0, 0, 2] },
    });
    await assessmentController.submitResponse(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.has_crisis_flag).toBe(true);
    expect(body.data.crisis_resources).not.toBeNull();
  });

  test('first-ever submission: change is null (no prior to compare)', async () => {
    ValidatedAssessment.getLatestPerInstrument.mockResolvedValue([]);
    ValidatedAssessment.create.mockResolvedValue({
      assessment_id: 'a3', instrument: 'GAD7', total_score: 5,
      severity_tier: 'mild', has_crisis_flag: false, completed_at: new Date().toISOString(),
    });

    const { req, res, next } = makeReqRes({
      params: { instrument: 'GAD7' },
      body: { answers: [1, 1, 1, 1, 0, 0, 1] },
    });
    await assessmentController.submitResponse(req, res, next);

    expect(res.json.mock.calls[0][0].data.change).toBeNull();
  });

  test('malformed answers → ValidatedAssessment.create throws → 400 (not 500)', async () => {
    ValidatedAssessment.getLatestPerInstrument.mockResolvedValue([]);
    ValidatedAssessment.create.mockRejectedValue(new Error('Instrument PHQ9 expects 9 responses; got 3'));

    const { req, res, next } = makeReqRes({
      params: { instrument: 'PHQ9' },
      body: { answers: [1, 1, 1] },
    });
    await assessmentController.submitResponse(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toMatch(/expects 9/);
  });

  test('unknown instrument → 404 (never touches model)', async () => {
    const { req, res, next } = makeReqRes({
      params: { instrument: 'BADCODE' },
      body: { answers: [0] },
    });
    await assessmentController.submitResponse(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(ValidatedAssessment.create).not.toHaveBeenCalled();
  });
});

// ─── getHistory ────────────────────────────────────────────────────────────

describe('getHistory', () => {
  test('returns rows for the instrument', async () => {
    ValidatedAssessment.getUserAssessments.mockResolvedValue([
      { assessment_id: 'a1', instrument: 'PHQ9', total_score: 10, severity_tier: 'moderate', completed_at: todayMinus(14) },
      { assessment_id: 'a2', instrument: 'PHQ9', total_score: 6,  severity_tier: 'mild',     completed_at: todayMinus(28) },
    ]);
    const { req, res, next } = makeReqRes({ params: { instrument: 'PHQ9' }, query: { limit: '10' } });
    await assessmentController.getHistory(req, res, next);

    expect(ValidatedAssessment.getUserAssessments).toHaveBeenCalledWith('u1', {
      instrument: 'PHQ9', limit: 10,
    });
    const body = res.json.mock.calls[0][0];
    expect(body.data.history).toHaveLength(2);
    expect(body.data.history[0].score).toBe(10);
  });

  test('unknown instrument → 404', async () => {
    const { req, res, next } = makeReqRes({ params: { instrument: 'BADCODE' }, query: {} });
    await assessmentController.getHistory(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── checkDue ──────────────────────────────────────────────────────────────

describe('checkDue', () => {
  test('returns only instruments past their recommendedFrequencyDays', async () => {
    // PHQ9 freq 14d → taken 3 days ago → NOT due.
    // GAD7 freq 14d → taken 20 days ago → due.
    // ISI / PSS4 / WEMWBS never taken → all due.
    ValidatedAssessment.getLatestPerInstrument.mockResolvedValue([
      { instrument: 'PHQ9', total_score: 4, severity_tier: 'minimal', completed_at: todayMinus(3) },
      { instrument: 'GAD7', total_score: 6, severity_tier: 'mild',    completed_at: todayMinus(20) },
    ]);
    const { req, res, next } = makeReqRes();
    await assessmentController.checkDue(req, res, next);

    const body = res.json.mock.calls[0][0];
    const dueCodes = body.data.due.map(d => d.instrument);
    expect(dueCodes).toContain('GAD7');
    expect(dueCodes).toContain('PSS4');
    expect(dueCodes).toContain('ISI');
    expect(dueCodes).toContain('WEMWBS');
    expect(dueCodes).not.toContain('PHQ9');
    expect(body.data.count).toBe(dueCodes.length);
  });
});

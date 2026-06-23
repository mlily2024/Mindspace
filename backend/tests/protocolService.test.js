/**
 * Tests for protocolService (C.0 activation).
 *
 * The service was previously written against a phantom schema (`protocol_enrollments`,
 * `therapeutic_protocols.id/slug/approach`) and was never reachable (the controller
 * was stubbed). These tests pin the reconciliation to migration 006's real schema:
 *   - therapeutic_protocols(protocol_id, modality, …)  — no id/slug/approach
 *   - user_protocol_enrollments(enrollment_id, …, started_at)
 *   - protocol_session_completions(enrollment_id, session_number, week_number,
 *       mood_before, mood_after, difficulty_rating, …)  — difficulty_rating is the
 *       input C.2 (adaptive pacing) consumes.
 *
 * db is mocked; the protocol content definitions are used for real (pure).
 */
jest.mock('../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const db = require('../src/config/database');
const ProtocolService = require('../src/services/protocolService');

const lastCall = () => db.query.mock.calls[db.query.mock.calls.length - 1];
const callsWith = (substr) => db.query.mock.calls.filter((c) => c[0].includes(substr));

describe('protocolService.seedProtocols', () => {
  beforeEach(() => jest.clearAllMocks());

  it('skips when six protocols already exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ count: '6' }] });
    const r = await ProtocolService.seedProtocols();
    expect(r.status).toBe('already_seeded');
    expect(callsWith('INSERT INTO therapeutic_protocols')).toHaveLength(0);
  });

  it('inserts the protocols against the real schema (modality, no id/slug/approach)', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('COUNT(*) AS count')) return Promise.resolve({ rows: [{ count: '0' }] });
      if (sql.includes('SELECT protocol_id FROM therapeutic_protocols')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] }); // the INSERTs
    });

    const r = await ProtocolService.seedProtocols();
    expect(r.status).toBe('seeded');
    expect(r.count).toBeGreaterThanOrEqual(6);

    const inserts = callsWith('INSERT INTO therapeutic_protocols');
    expect(inserts.length).toBe(r.count);
    const sql = inserts[0][0];
    expect(sql).toContain('modality');
    expect(sql).not.toMatch(/\bslug\b/);
    expect(sql).not.toMatch(/\bapproach\b/);
    // protocol_id is DB-defaulted, never inserted by the app
    expect(sql).not.toMatch(/\(\s*id\b/);
  });
});

describe('protocolService.enrollUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects when the protocol does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // protocol lookup
    await expect(ProtocolService.enrollUser('u1', 'p1')).rejects.toThrow(/not found|inactive/i);
  });

  it('rejects a duplicate active enrollment', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ protocol_id: 'p1', name: 'BA' }] }) // protocol exists
      .mockResolvedValueOnce({ rows: [{ enrollment_id: 'e1', status: 'active' }] }); // already active
    await expect(ProtocolService.enrollUser('u1', 'p1')).rejects.toThrow(/already enrolled/i);
  });

  it('enrolls into user_protocol_enrollments with an ON CONFLICT re-activation', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ protocol_id: 'p1', name: 'BA' }] })
      .mockResolvedValueOnce({ rows: [] }) // no active enrollment
      .mockResolvedValueOnce({ rows: [{ enrollment_id: 'e1', status: 'active', current_session: 1 }] });
    const row = await ProtocolService.enrollUser('u1', 'p1', 12);
    expect(row.enrollment_id).toBe('e1');
    const insertSql = lastCall()[0];
    expect(insertSql).toContain('INSERT INTO user_protocol_enrollments');
    expect(insertSql).toContain('ON CONFLICT (user_id, protocol_id)');
  });
});

describe('protocolService.getCurrentSession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns not_enrolled when there is no active enrollment', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const r = await ProtocolService.getCurrentSession('u1', 'p1');
    expect(r.status).toBe('not_enrolled');
  });

  it('returns the session content matching current_session', async () => {
    const sessions = [
      { session_number: 1, week: 1, title: 'S1' },
      { session_number: 2, week: 1, title: 'S2' }
    ];
    db.query
      .mockResolvedValueOnce({
        rows: [{ enrollment_id: 'e1', current_session: 2, current_week: 1, total_sessions: 2, protocol_name: 'BA', sessions }]
      })
      .mockResolvedValueOnce({ rows: [] }); // recent completions (none yet) -> no adaptation
    const r = await ProtocolService.getCurrentSession('u1', 'p1');
    expect(r.status).toBe('ok');
    expect(r.session.title).toBe('S2');
    expect(r.adaptation).toBeNull();
    expect(db.query.mock.calls[0][0]).toContain('FROM user_protocol_enrollments');
  });

  it('attaches an "ease" adaptation when the last session was rated hard', async () => {
    const sessions = [{ session_number: 3, week: 2, title: 'S3' }];
    db.query
      .mockResolvedValueOnce({
        rows: [{ enrollment_id: 'e1', current_session: 3, current_week: 2, total_sessions: 6, protocol_name: 'BA', sessions }]
      })
      .mockResolvedValueOnce({ rows: [{ difficulty_rating: 5, mood_before: 6, mood_after: 5, session_number: 2 }] });
    const r = await ProtocolService.getCurrentSession('u1', 'p1');
    expect(r.adaptation).not.toBeNull();
    expect(r.adaptation.level).toBe('ease');
    // the completions query must be scoped to the enrollment
    expect(db.query.mock.calls[1][0]).toContain('FROM protocol_session_completions');
    expect(db.query.mock.calls[1][1][0]).toBe('e1');
  });
});

describe('protocolService.completeSession', () => {
  beforeEach(() => jest.clearAllMocks());

  const sessions = [
    { session_number: 1, week: 1 },
    { session_number: 2, week: 2 }
  ];
  const enrollmentRow = {
    enrollment_id: 'e1',
    current_session: 1,
    current_week: 1,
    total_sessions: 2,
    protocol_name: 'BA',
    sessions
  };

  it('rejects when the submitted session is not the current one', async () => {
    db.query.mockResolvedValueOnce({ rows: [enrollmentRow] });
    await expect(ProtocolService.completeSession('u1', 'p1', 2, {})).rejects.toThrow(/Expected session 1/);
  });

  it('records difficulty_rating + week_number and advances to the next session', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [enrollmentRow] }) // enrollment+protocol
      .mockResolvedValueOnce({ rows: [] }) // completion insert
      .mockResolvedValueOnce({ rows: [{ enrollment_id: 'e1', current_session: 2, current_week: 2 }] }); // advance

    const r = await ProtocolService.completeSession('u1', 'p1', 1, {
      mood_before: 4,
      mood_after: 6,
      difficulty_rating: 3,
      exercise_data: { foo: 'bar' }
    });

    expect(r.status).toBe('session_completed');
    expect(r.nextSession).toBe(2);

    const completion = callsWith('INSERT INTO protocol_session_completions')[0];
    expect(completion[0]).toContain('difficulty_rating');
    expect(completion[0]).toContain('week_number');
    // params: enrollment_id, session_number, week_number, mood_before, mood_after, difficulty_rating, notes, exercise_data
    expect(completion[1][0]).toBe('e1');
    expect(completion[1][2]).toBe(1); // week_number of the completed session
    expect(completion[1][5]).toBe(3); // difficulty_rating
  });

  it('completes the protocol on the final session', async () => {
    const lastRow = { ...enrollmentRow, current_session: 2 };
    db.query
      .mockResolvedValueOnce({ rows: [lastRow] })
      .mockResolvedValueOnce({ rows: [] }) // completion insert
      .mockResolvedValueOnce({ rows: [{ enrollment_id: 'e1', status: 'completed' }] });

    const r = await ProtocolService.completeSession('u1', 'p1', 2, {
      mood_before: 5, mood_after: 7, difficulty_rating: 2
    });
    expect(r.status).toBe('protocol_completed');
    expect(callsWith("status = 'completed'").length).toBe(1);
  });
});

describe('protocolService.getProgress', () => {
  beforeEach(() => jest.clearAllMocks());

  it('computes progress from completions and started_at', async () => {
    const started = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    db.query
      .mockResolvedValueOnce({
        rows: [{
          enrollment_id: 'e1', status: 'active', current_session: 2, current_week: 1,
          total_sessions: 12, duration_weeks: 4, protocol_name: 'BA',
          started_at: started, completed_at: null
        }]
      })
      .mockResolvedValueOnce({ rows: [{ completed_count: '3' }] });

    const r = await ProtocolService.getProgress('u1', 'p1');
    expect(r.status).toBe('ok');
    expect(r.completedSessions).toBe(3);
    expect(r.progressPct).toBe(25);
    expect(db.query.mock.calls[0][0]).toContain('e.started_at');
  });
});

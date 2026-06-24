/**
 * Tests for enhancedPeerService (ADR-0022) — the activated peer-similarity surface.
 * Previously a non-functional SQLite stub; reconciled to Postgres + migration 006's
 * peer_pattern_profiles. db is mocked.
 */
jest.mock('../src/config/database', () => ({ query: jest.fn() }));

const db = require('../src/config/database');
const svc = require('../src/services/enhancedPeerService');

const moodRow = (entry_date, mood_score, triggers = []) => ({ entry_date, mood_score, triggers });

describe('pure helpers', () => {
  it('classifyPattern: volatility overrides trend', () => {
    expect(svc._classifyPattern(7, 2.5, -0.5)).toBe(2); // volatile
    expect(svc._classifyPattern(7, 1.0, -0.5)).toBe(3); // declining
    expect(svc._classifyPattern(7, 1.0, 0.5)).toBe(4); // improving
    expect(svc._classifyPattern(7, 1.0, 0.0)).toBe(0); // stable-high
    expect(svc._classifyPattern(4, 1.0, 0.0)).toBe(1); // stable-low
  });

  it('computeLinearTrendSlope on a clean ramp', () => {
    expect(svc._computeLinearTrendSlope([0, 1, 2, 3, 4])).toBeCloseTo(1, 9);
    expect(svc._computeLinearTrendSlope([4, 3, 2, 1, 0])).toBeCloseTo(-1, 9);
    expect(svc._computeLinearTrendSlope([5])).toBe(0);
  });
});

describe('computePatternProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns an empty profile and does not upsert when there is no mood data', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const p = await svc.computePatternProfile('u1');
    expect(p.data_points).toBe(0);
    expect(p.pattern_cluster).toBeNull();
    expect(db.query).toHaveBeenCalledTimes(1); // only the SELECT
  });

  it('classifies a declining series and upserts against the real schema', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          moodRow('2026-06-01', 8, ['work']),
          moodRow('2026-06-02', 7, ['work', 'sleep']),
          moodRow('2026-06-03', 6, ['sleep']),
          moodRow('2026-06-04', 5, []),
          moodRow('2026-06-05', 4, ['work']),
          moodRow('2026-06-06', 3, []),
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // upsert

    const p = await svc.computePatternProfile('u1');
    expect(p.pattern_cluster).toBe(3); // declining
    expect(p.cluster_label).toBe('Finding Footing');
    expect(p.peak_day).toBe('2026-06-01');
    expect(p.trough_day).toBe('2026-06-06');
    expect(p.data_points).toBe(6);
    expect(p.primary_triggers[0]).toMatchObject({ trigger: 'work', count: 3 });

    const [sql, params] = db.query.mock.calls[1];
    expect(sql).toContain('INSERT INTO peer_pattern_profiles');
    expect(sql).toContain('mood_pattern_cluster');
    expect(sql).toContain('ON CONFLICT (user_id)');
    expect(params[1]).toBe(3); // cluster
    expect(params[0]).toBe('u1');
  });

  it('tolerates jsonb triggers already parsed as arrays and legacy strings', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [moodRow('2026-06-01', 6, ['a']), moodRow('2026-06-02', 6, '["a","b"]'), moodRow('2026-06-03', 6, 'a,b')],
      })
      .mockResolvedValueOnce({ rows: [] });
    const p = await svc.computePatternProfile('u1');
    const names = p.primary_triggers.map((t) => t.trigger).sort();
    expect(names).toContain('a');
    expect(names).toContain('b');
  });
});

describe('findPatternMatches', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns [] when the user has no profile', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    expect(await svc.findPatternMatches('u1')).toEqual([]);
  });

  it('returns same-cluster peers (excluding self), with labels and no extra PII', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ mood_pattern_cluster: 2 }] }) // my cluster
      .mockResolvedValueOnce({
        rows: [
          { user_id: 'u2', mood_pattern_cluster: 2, avg_variability: '2.40', peak_day: '2026-06-01', trough_day: '2026-06-03', last_computed_at: 't' },
        ],
      });
    const matches = await svc.findPatternMatches('u1', 5);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ user_id: 'u2', pattern_cluster: 2, cluster_label: 'Riding the Waves' });
    // the query filters by cluster and excludes self
    const [sql, params] = db.query.mock.calls[1];
    expect(sql).toContain('mood_pattern_cluster = $1');
    expect(sql).toContain('user_id <> $2');
    expect(params).toEqual([2, 'u1', 5]);
  });
});

describe('suggestGroup', () => {
  beforeEach(() => jest.clearAllMocks());

  it('prompts to keep checking in when there is no profile yet', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const s = await svc.suggestGroup('u1');
    expect(s.pattern_cluster).toBeNull();
    expect(s.message).toMatch(/check in/i);
  });

  it('returns the cluster archetype without touching live group tables', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ mood_pattern_cluster: 4 }] });
    const s = await svc.suggestGroup('u1');
    expect(s).toMatchObject({ pattern_cluster: 4, cluster_label: 'On the Rise' });
    expect(db.query).toHaveBeenCalledTimes(1); // no second query against peer_support_groups
  });
});

describe('createStructuredExercise', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an invalid exercise type before any DB call (400)', async () => {
    await expect(svc.createStructuredExercise('u1', 'g1', 'not_a_type', 'T')).rejects.toMatchObject({ status: 400 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects a non-member (403) and does not insert', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // membership check: not a member
    await expect(svc.createStructuredExercise('u1', 'g1', 'gratitude_round', 'T')).rejects.toMatchObject({ status: 403 });
    expect(db.query).toHaveBeenCalledTimes(1); // only the membership check
  });

  it('inserts for an active member', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // is member
      .mockResolvedValueOnce({ rows: [{ exercise_id: 'e1', group_id: 'g1', exercise_type: 'gratitude_round', title: 'T' }] });
    const ex = await svc.createStructuredExercise('u1', 'g1', 'gratitude_round', 'T', 'desc', null);
    expect(ex.exercise_id).toBe('e1');
    const memberSql = db.query.mock.calls[0][0];
    expect(memberSql).toContain('FROM group_members');
    expect(db.query.mock.calls[1][0]).toContain('INSERT INTO peer_structured_exercises');
  });
});

describe('getGroupExercises', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a non-member (403)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(svc.getGroupExercises('u1', 'g1')).rejects.toMatchObject({ status: 403 });
  });

  it('lists exercises with a response count for a member', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ exercise_id: 'e1', response_count: 3 }] });
    const list = await svc.getGroupExercises('u1', 'g1');
    expect(list[0]).toMatchObject({ exercise_id: 'e1', response_count: 3 });
    expect(db.query.mock.calls[1][0]).toContain('peer_exercise_responses');
  });
});

describe('submitExerciseResponse', () => {
  beforeEach(() => jest.clearAllMocks());

  it('404 when the exercise does not exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // exercise lookup
    await expect(svc.submitExerciseResponse('u1', 'e1', 'hi')).rejects.toMatchObject({ status: 404 });
  });

  it('403 when the user is not a member of the exercise group', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ group_id: 'g1' }] }) // exercise -> group
      .mockResolvedValueOnce({ rows: [] }); // membership: none
    await expect(svc.submitExerciseResponse('u1', 'e1', 'hi')).rejects.toMatchObject({ status: 403 });
  });

  it('records a response for a member', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ group_id: 'g1' }] })
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      .mockResolvedValueOnce({ rows: [{ response_id: 'r1', exercise_id: 'e1' }] });
    const r = await svc.submitExerciseResponse('u1', 'e1', 'hi');
    expect(r.response_id).toBe('r1');
    expect(db.query.mock.calls[2][0]).toContain('INSERT INTO peer_exercise_responses');
  });
});

describe('getUserMentorships', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the user\'s active mentorships with a role', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { mentorship_id: 'm1', mentor_id: 'u1', mentee_id: 'u2', status: 'active', role: 'mentor' },
      ],
    });
    const ms = await svc.getUserMentorships('u1');
    expect(ms[0]).toMatchObject({ mentorship_id: 'm1', role: 'mentor' });
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('FROM peer_mentorships');
    expect(sql).toContain("status = 'active'");
    expect(params).toEqual(['u1']);
  });
});

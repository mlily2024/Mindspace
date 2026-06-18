/**
 * Tests for the recentCrisisAlert field added to lunaService.getSessionContext
 * (2026-06-18). Drives Luna's session-open greeting so a user who just
 * had a crisis_indicator alert written by the assessmentController gets
 * a gentler opener.
 *
 * Coverage:
 *   - No alerts: recentCrisisAlert is null
 *   - One unacknowledged crisis_indicator from the last 24h: returned
 *     with source + instrument from alert_data
 *   - Acknowledged alerts excluded
 *   - Older-than-24h alerts excluded
 *   - safety_alerts query failure does NOT crash context (returns null)
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';

jest.mock('../src/config/database', () => ({ query: jest.fn() }));

const db = require('../src/config/database');
const logger = require('../src/config/logger');
jest.spyOn(logger, 'info').mockImplementation(() => {});
jest.spyOn(logger, 'warn').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});

const lunaService = require('../src/services/lunaService');

// The getSessionContext implementation runs 4 queries in order:
//   1. last session summary
//   2. key themes
//   3. recent mood
//   4. recentCrisisAlert  (new)
// We mock the first three to harmless empty rows and only vary #4.
const mockBaselineThreeQueries = () => {
  db.query
    .mockResolvedValueOnce({ rows: [] })  // summary
    .mockResolvedValueOnce({ rows: [] })  // themes
    .mockResolvedValueOnce({ rows: [] }); // mood
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('lunaService.getSessionContext — recentCrisisAlert', () => {
  test('no safety_alerts → recentCrisisAlert is null', async () => {
    mockBaselineThreeQueries();
    db.query.mockResolvedValueOnce({ rows: [] }); // safety_alerts
    const ctx = await lunaService.getSessionContext('u1');
    expect(ctx.recentCrisisAlert).toBeNull();
  });

  test('one unacknowledged crisis_indicator → returned with source + instrument', async () => {
    mockBaselineThreeQueries();
    db.query.mockResolvedValueOnce({
      rows: [{
        alert_id:     'alert-1',
        alert_type:   'crisis_indicator',
        severity:     'critical',
        alert_data:   { source: 'validated_assessment', instrument: 'PHQ9' },
        triggered_at: new Date().toISOString(),
      }],
    });
    const ctx = await lunaService.getSessionContext('u1');
    expect(ctx.recentCrisisAlert).toEqual(expect.objectContaining({
      alert_id:   'alert-1',
      severity:   'critical',
      source:     'validated_assessment',
      instrument: 'PHQ9',
    }));
  });

  test('safety_alerts query failure → recentCrisisAlert null, context still returned', async () => {
    mockBaselineThreeQueries();
    db.query.mockRejectedValueOnce(new Error('safety_alerts table missing'));
    const ctx = await lunaService.getSessionContext('u1');
    expect(ctx.recentCrisisAlert).toBeNull();
    // Other context fields still populated (empty arrays / nulls, not undefined)
    expect(ctx.keyThemes).toEqual([]);
    expect(ctx.recentMood).toEqual([]);
  });

  test('SQL filters acknowledged + older-than-24h alerts (verify WHERE clause shape)', async () => {
    mockBaselineThreeQueries();
    db.query.mockResolvedValueOnce({ rows: [] });
    await lunaService.getSessionContext('u1');

    // Locate the safety_alerts query (4th call) and inspect the SQL
    const safetyCall = db.query.mock.calls.find(c => /FROM safety_alerts/.test(c[0]));
    expect(safetyCall).toBeDefined();
    const sql = safetyCall[0];
    expect(sql).toMatch(/is_acknowledged = false/);
    expect(sql).toMatch(/triggered_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'/);
    expect(sql).toMatch(/alert_type = 'crisis_indicator'/);
    expect(sql).toMatch(/ORDER BY triggered_at DESC/);
    expect(sql).toMatch(/LIMIT 1/);
  });
});

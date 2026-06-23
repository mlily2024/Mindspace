/**
 * Tests for careEscalationService (ADR-0013) — the tiered escalation evaluator.
 * Pins the tier rules (crisis / elevated / monitor incl. batched + RCI cases)
 * and the cooldown-guarded persistence. ValidatedAssessment + db are mocked;
 * carePathways + the RCI module are used for real (pure).
 */
jest.mock('../src/models/ValidatedAssessment', () => ({ getUserAssessments: jest.fn() }));
jest.mock('../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../src/config/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const ValidatedAssessment = require('../src/models/ValidatedAssessment');
const db = require('../src/config/database');
const service = require('../src/services/careEscalationService');

const row = (total_score, severity_tier, has_crisis_flag = false) => ({ total_score, severity_tier, has_crisis_flag });

function setAssessments(map) {
  ValidatedAssessment.getUserAssessments.mockImplementation((_userId, { instrument }) =>
    Promise.resolve(map[instrument] || [])
  );
}

describe('careEscalationService.evaluate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('monitor when all scores are minimal', async () => {
    setAssessments({ PHQ9: [row(4, 'minimal')] });
    const r = await service.evaluate('u1');
    expect(r.tier).toBe('monitor');
    expect(r.crisis).toBe(false);
  });

  it('crisis when the PHQ-9 item-9 crisis flag is set', async () => {
    setAssessments({ PHQ9: [row(8, 'mild', true)] });
    const r = await service.evaluate('u1');
    expect(r.tier).toBe('crisis');
    expect(r.crisis).toBe(true);
    expect(r.pathways.some((p) => p.phone === '116 123')).toBe(true); // Samaritans
  });

  it('crisis when a score is severe', async () => {
    setAssessments({ PHQ9: [row(22, 'severe')] });
    expect((await service.evaluate('u1')).tier).toBe('crisis');
  });

  it('elevated on a single moderate score (under-trigger guard)', async () => {
    setAssessments({ PHQ9: [row(12, 'moderate')] });
    const r = await service.evaluate('u1');
    expect(r.tier).toBe('elevated');
    expect(r.pathways.map((p) => p.name).join(' ')).toContain('NHS Talking Therapies');
  });

  it('elevated on a reliable deterioration even from a non-moderate latest score', async () => {
    // PHQ-9 mild now (9) but jumped from 1 -> 9 (delta 8, RCI ~3.3 -> reliable deterioration)
    setAssessments({ PHQ9: [row(9, 'mild'), row(1, 'minimal')] });
    const r = await service.evaluate('u1');
    expect(r.tier).toBe('elevated');
    expect(r.reasons.join(' ')).toMatch(/worsened/);
  });

  it('elevated on the batched case (>=2 mildly elevated, none moderate)', async () => {
    setAssessments({ PHQ9: [row(6, 'mild')], GAD7: [row(6, 'mild')] });
    const r = await service.evaluate('u1');
    expect(r.tier).toBe('elevated');
    expect(r.reasons.join(' ')).toMatch(/mildly elevated/);
  });

  it('monitor on a single mild score (no batching, no deterioration)', async () => {
    setAssessments({ PHQ9: [row(6, 'mild'), row(6, 'mild')] });
    expect((await service.evaluate('u1')).tier).toBe('monitor');
  });
});

describe('careEscalationService.recordIfNeeded', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not persist for the monitor tier', async () => {
    const id = await service.recordIfNeeded('u1', { tier: 'monitor', reasons: [], signals: [] });
    expect(id).toBeNull();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('persists an elevated escalation when none is within cooldown', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // cooldown check: none recent
      .mockResolvedValueOnce({ rows: [{ escalation_id: 'esc-1' }] }); // insert
    const id = await service.recordIfNeeded('u1', { tier: 'elevated', reasons: ['x'], signals: [] });
    expect(id).toBe('esc-1');
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('skips persistence within the cooldown window', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ exists: 1 }] }); // a recent escalation exists
    const id = await service.recordIfNeeded('u1', { tier: 'crisis', reasons: [], signals: [] });
    expect(id).toBeNull();
    expect(db.query).toHaveBeenCalledTimes(1); // only the cooldown check, no insert
  });

  it('never throws — returns null on a db error', async () => {
    db.query.mockRejectedValue(new Error('db down'));
    const id = await service.recordIfNeeded('u1', { tier: 'elevated', reasons: [], signals: [] });
    expect(id).toBeNull();
  });
});

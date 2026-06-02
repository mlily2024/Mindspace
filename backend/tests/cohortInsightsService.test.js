/**
 * Tests for cohortInsightsService — DP-protected cohort aggregates.
 *
 * DB is mocked. We verify:
 *   - shape of the response
 *   - small-cell suppression (n < minN)
 *   - noisy mean is centred near the true mean for large n
 *   - per-call budget consumption + exhaustion behaviour
 *   - argument validation
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';

// Mock the db module before requiring the service.
const mockQuery = jest.fn();
jest.mock('../src/config/database', () => ({
  query: (...args) => mockQuery(...args)
}));

const cohortService = require('../src/services/cohortInsightsService');
const { resetBudget, budget, SCOPE, MOOD_MIN, MOOD_MAX } = cohortService._internal;

const fullWeekRows = (n, mean) =>
  Array.from({ length: 7 }, (_, dow) => ({ dow, n, mean_mood: mean }));

beforeEach(() => {
  mockQuery.mockReset();
  resetBudget();
});

describe('getAverageMoodByDayOfWeek()', () => {

  describe('argument validation', () => {
    it('rejects non-positive epsilon', async () => {
      await expect(cohortService.getAverageMoodByDayOfWeek({ epsilon: 0 }))
        .rejects.toThrow(/epsilon/);
      await expect(cohortService.getAverageMoodByDayOfWeek({ epsilon: -1 }))
        .rejects.toThrow(/epsilon/);
    });

    it('rejects minN < 1', async () => {
      await expect(cohortService.getAverageMoodByDayOfWeek({ minN: 0 }))
        .rejects.toThrow(/minN/);
    });
  });

  describe('shape', () => {
    it('returns 7 day entries (one per DOW) even with empty DB', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const r = await cohortService.getAverageMoodByDayOfWeek();
      expect(r.days).toHaveLength(7);
      expect(r.days.map(d => d.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      // All suppressed (no data).
      expect(r.days.every(d => d.suppressed === true)).toBe(true);
      expect(r.days.every(d => d.noisyAverage === null)).toBe(true);
    });

    it('returns budget bookkeeping fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const r = await cohortService.getAverageMoodByDayOfWeek({ epsilon: 0.5 });
      expect(r.epsilon).toBe(0.5);
      expect(r.budgetSpentForScope).toBeCloseTo(0.5);
      expect(r.budgetRemainingForScope).toBeCloseTo(r.budgetTotal - 0.5);
      expect(r.moodRange).toEqual({ min: MOOD_MIN, max: MOOD_MAX });
      expect(r.method).toMatch(/Laplace/);
    });
  });

  describe('small-cell suppression', () => {
    it('suppresses DOWs with n below minN', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { dow: 0, n: 2,   mean_mood: 6.0 },  // below minN=5
          { dow: 1, n: 100, mean_mood: 7.0 }   // above
        ]
      });
      const r = await cohortService.getAverageMoodByDayOfWeek({ minN: 5 });
      const sun = r.days.find(d => d.dayOfWeek === 0);
      const mon = r.days.find(d => d.dayOfWeek === 1);
      expect(sun.suppressed).toBe(true);
      expect(sun.reason).toMatch(/below minN/);
      expect(mon.suppressed).toBe(false);
      expect(mon.noisyAverage).not.toBeNull();
    });

    it('reports "no data" reason for DOWs missing from the query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ dow: 3, n: 100, mean_mood: 7.0 }] });
      const r = await cohortService.getAverageMoodByDayOfWeek();
      const missingDow = r.days.find(d => d.dayOfWeek === 0);
      expect(missingDow.suppressed).toBe(true);
      expect(missingDow.reason).toBe('no data');
      expect(missingDow.n).toBe(0);
    });
  });

  describe('noise behaviour (statistical)', () => {
    it('noisy averages are centred on true mean for very large n', async () => {
      // n=10000 makes sensitivity = 9/10000 = 0.0009 → very small noise.
      mockQuery.mockResolvedValueOnce({ rows: fullWeekRows(10_000, 6.5) });
      const r = await cohortService.getAverageMoodByDayOfWeek({ epsilon: 1.0 });
      for (const d of r.days) {
        expect(d.noisyAverage).toBeCloseTo(6.5, 1);   // within ±0.05
      }
    });

    it('noisy averages are clamped to the mood range [1, 10]', async () => {
      // Tiny n + tiny ε ⇒ enormous noise; clamping must keep the published
      // value inside the legal range so callers can't see noise direction.
      mockQuery.mockResolvedValueOnce({ rows: fullWeekRows(5, 6.5) });
      const r = await cohortService.getAverageMoodByDayOfWeek({ epsilon: 0.01, minN: 5 });
      for (const d of r.days) {
        if (d.suppressed) continue;
        expect(d.noisyAverage).toBeGreaterThanOrEqual(MOOD_MIN);
        expect(d.noisyAverage).toBeLessThanOrEqual(MOOD_MAX);
      }
    });

    it('repeated calls produce DIFFERENT noisy values for the same true data', async () => {
      // Same query, two calls → noise should differ (fresh random per call).
      mockQuery.mockResolvedValue({ rows: fullWeekRows(100, 6.5) });
      const a = await cohortService.getAverageMoodByDayOfWeek({ epsilon: 0.5 });
      const b = await cohortService.getAverageMoodByDayOfWeek({ epsilon: 0.5 });
      const aSig = a.days.map(d => d.noisyAverage).join(',');
      const bSig = b.days.map(d => d.noisyAverage).join(',');
      expect(aSig).not.toBe(bSig);
    });
  });

  describe('budget consumption', () => {
    it('each call consumes the requested epsilon', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      await cohortService.getAverageMoodByDayOfWeek({ epsilon: 1.0 });
      expect(budget.spent(SCOPE)).toBeCloseTo(1.0);
      await cohortService.getAverageMoodByDayOfWeek({ epsilon: 2.0 });
      expect(budget.spent(SCOPE)).toBeCloseTo(3.0);
    });

    it('refuses queries that would exceed the total budget', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      // Default total = 10. Spend 9 first, then a request for 2 must fail.
      await cohortService.getAverageMoodByDayOfWeek({ epsilon: 5 });
      await cohortService.getAverageMoodByDayOfWeek({ epsilon: 4 });
      await expect(cohortService.getAverageMoodByDayOfWeek({ epsilon: 2 }))
        .rejects.toThrow(/exhausted/i);
      // The refused call must NOT have run the query.
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('budget is consumed BEFORE the DB query is made (so a DB failure does not refund ε)', async () => {
      mockQuery.mockRejectedValueOnce(new Error('db down'));
      await expect(cohortService.getAverageMoodByDayOfWeek({ epsilon: 1.0 }))
        .rejects.toThrow(/db down/);
      // ε was spent regardless of the query outcome — DP-safe behaviour.
      expect(budget.spent(SCOPE)).toBeCloseTo(1.0);
    });
  });
});

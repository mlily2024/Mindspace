/**
 * Tests for the ValidatedAssessment model + screeningInstruments scorer.
 *
 * Coverage:
 *   - All 5 instruments score correctly at boundary points (min, mid, max,
 *     severity transitions, WEMWBS direction, PSS-4 reverse-scoring)
 *   - PHQ-9 crisis flag fires on Q9 ≥ 1 and does NOT fire on Q9 = 0
 *   - Wrong response count rejected
 *   - Out-of-range response rejected
 *   - Unknown instrument rejected
 *   - Model.create persists, returns scored row, decrypts on read
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';

const { scoreResponses, getInstrument, listInstrumentSummaries } =
  require('../src/data/screeningInstruments');

describe('screeningInstruments — scoreResponses (pure-function)', () => {
  test('PHQ-9 all zeros → minimal, score 0, no crisis flag', () => {
    const r = scoreResponses('PHQ9', new Array(9).fill(0));
    expect(r.total_score).toBe(0);
    expect(r.severity_tier).toBe('minimal');
    expect(r.has_crisis_flag).toBe(false);
  });

  test('PHQ-9 Q9 = 1, others 0 → crisis flag TRUE even at score 1', () => {
    const responses = new Array(9).fill(0);
    responses[8] = 1;
    const r = scoreResponses('PHQ9', responses);
    expect(r.total_score).toBe(1);
    expect(r.has_crisis_flag).toBe(true);
  });

  test('PHQ-9 score 20 → severe band', () => {
    const r = scoreResponses('PHQ9', [3, 3, 3, 3, 3, 3, 2, 0, 0]);
    expect(r.total_score).toBe(20);
    expect(r.severity_tier).toBe('severe');
  });

  test('PHQ-9 severity boundaries (construct valid response arrays)', () => {
    // Each PHQ-9 response is 0-3, so to reach total T we spread across items.
    // Helper builds a 9-element array summing to T using values in [0, 3].
    const buildPhq9 = (target) => {
      const out = new Array(9).fill(0);
      let remaining = target;
      for (let i = 0; i < out.length && remaining > 0; i += 1) {
        const v = Math.min(3, remaining);
        out[i] = v;
        remaining -= v;
      }
      if (remaining > 0) throw new Error(`cannot reach ${target} in valid PHQ-9 range`);
      return out;
    };
    expect(scoreResponses('PHQ9', buildPhq9(0)).severity_tier).toBe('minimal');
    expect(scoreResponses('PHQ9', buildPhq9(5)).severity_tier).toBe('mild');
    expect(scoreResponses('PHQ9', buildPhq9(10)).severity_tier).toBe('moderate');
    expect(scoreResponses('PHQ9', buildPhq9(15)).severity_tier).toBe('moderately_severe');
    expect(scoreResponses('PHQ9', buildPhq9(20)).severity_tier).toBe('severe');
    expect(scoreResponses('PHQ9', buildPhq9(27)).severity_tier).toBe('severe');
  });

  test('PHQ-9 rejects wrong response count', () => {
    expect(() => scoreResponses('PHQ9', [0, 0, 0])).toThrow(/expects 9/);
  });

  test('PHQ-9 rejects out-of-range response', () => {
    const responses = new Array(9).fill(0);
    responses[0] = 5;
    expect(() => scoreResponses('PHQ9', responses)).toThrow(/out of range/);
  });

  test('GAD-7 score 15 → severe', () => {
    const r = scoreResponses('GAD7', [3, 3, 3, 3, 3, 0, 0]);
    expect(r.total_score).toBe(15);
    expect(r.severity_tier).toBe('severe');
  });

  test('GAD-7 has no crisis index', () => {
    const r = scoreResponses('GAD7', [3, 3, 3, 3, 3, 3, 3]);
    expect(r.has_crisis_flag).toBe(false);
  });

  test('PSS-4 reverse-scoring: positively-worded items 2 and 3 invert', () => {
    // All "Very often" (4). Items 2, 3 are positively worded; reverse → 0 each.
    // Items 1, 4 stay 4. Total = 4 + 0 + 0 + 4 = 8 → moderate.
    const r = scoreResponses('PSS4', [4, 4, 4, 4]);
    expect(r.total_score).toBe(8);
    expect(r.severity_tier).toBe('moderate');
  });

  test('PSS-4 all zeros for negatively-worded → reverse of zeros for positively-worded = 4 each → total 8', () => {
    // Items 1, 4 = 0. Items 2, 3 reverse 0 → 4. Total = 0 + 4 + 4 + 0 = 8 → moderate.
    const r = scoreResponses('PSS4', [0, 0, 0, 0]);
    expect(r.total_score).toBe(8);
    expect(r.severity_tier).toBe('moderate');
  });

  test('ISI severity bands', () => {
    expect(scoreResponses('ISI', [0, 0, 0, 0, 0, 0, 0]).severity_tier).toBe('absent');
    expect(scoreResponses('ISI', [2, 2, 2, 2, 0, 0, 0]).severity_tier).toBe('subthreshold');
    expect(scoreResponses('ISI', [3, 3, 3, 3, 3, 0, 0]).severity_tier).toBe('moderate');
    expect(scoreResponses('ISI', [4, 4, 4, 4, 4, 2, 0]).severity_tier).toBe('severe');
  });

  test('WEMWBS uses 1-5 range; total 14 = low_wellbeing, 70 = high_wellbeing', () => {
    expect(scoreResponses('WEMWBS', new Array(14).fill(1)).total_score).toBe(14);
    expect(scoreResponses('WEMWBS', new Array(14).fill(1)).severity_tier).toBe('low_wellbeing');
    expect(scoreResponses('WEMWBS', new Array(14).fill(5)).total_score).toBe(70);
    expect(scoreResponses('WEMWBS', new Array(14).fill(5)).severity_tier).toBe('high_wellbeing');
  });

  test('WEMWBS rejects response of 0 (range is 1-5, not 0-4)', () => {
    expect(() => scoreResponses('WEMWBS', new Array(14).fill(0))).toThrow(/out of range/);
  });

  test('Unknown instrument throws', () => {
    expect(() => scoreResponses('NOTREAL', [0])).toThrow(/Unknown instrument/);
  });

  test('listInstrumentSummaries returns all 5 with required metadata', () => {
    const list = listInstrumentSummaries();
    expect(list).toHaveLength(5);
    const codes = list.map(l => l.code).sort();
    expect(codes).toEqual(['GAD7', 'ISI', 'PHQ9', 'PSS4', 'WEMWBS']);
    for (const item of list) {
      expect(item.citation).toMatch(/\d{4}/); // citation has a year
      expect(item.questionCount).toBeGreaterThan(0);
      expect(item.recommendedFrequencyDays).toBeGreaterThan(0);
    }
  });

  test('getInstrument returns null for unknown code', () => {
    expect(getInstrument('XYZ')).toBeNull();
    expect(getInstrument('PHQ9')).toBeTruthy();
  });
});

// --- Model layer (mocked DB + encryption) ---------------------------------

const mockEncrypt = jest.fn((s) => `enc(${s})`);
const mockDecrypt = jest.fn((s) => (s && s.startsWith('enc(') ? s.slice(4, -1) : s));

jest.mock('../src/utils/encryption', () => ({
  encrypt: (s) => mockEncrypt(s),
  decrypt: (s) => mockDecrypt(s),
}));

jest.mock('../src/config/database', () => ({ query: jest.fn() }));

const db = require('../src/config/database');
const ValidatedAssessment = require('../src/models/ValidatedAssessment');

beforeEach(() => {
  jest.clearAllMocks();
  mockEncrypt.mockImplementation((s) => `enc(${s})`);
  mockDecrypt.mockImplementation((s) => (s && s.startsWith('enc(') ? s.slice(4, -1) : s));
});

describe('ValidatedAssessment.create', () => {
  test('scores responses server-side and persists scored row', async () => {
    db.query.mockResolvedValue({
      rows: [{
        assessment_id: 'a1', instrument: 'PHQ9',
        responses: '[3,3,3,3,3,3,2,0,0]',
        total_score: 20, severity_tier: 'severe', has_crisis_flag: false,
        is_encrypted: false, is_e2ee_encrypted: false,
        note: null, completed_at: new Date(),
      }],
    });
    const result = await ValidatedAssessment.create('u1', {
      instrument: 'PHQ9',
      responses: [3, 3, 3, 3, 3, 3, 2, 0, 0],
    });
    // Verify the INSERT values include the computed score
    const values = db.query.mock.calls[0][1];
    expect(values[3]).toBe(20);                   // total_score
    expect(values[4]).toBe('severe');             // severity_tier
    expect(values[5]).toBe(false);                // has_crisis_flag
    expect(result.responses).toEqual([3, 3, 3, 3, 3, 3, 2, 0, 0]);
  });

  test('PHQ-9 Q9 = 2 → has_crisis_flag persisted as TRUE', async () => {
    db.query.mockResolvedValue({
      rows: [{
        assessment_id: 'a1', instrument: 'PHQ9',
        responses: '[0,0,0,0,0,0,0,0,2]',
        total_score: 2, severity_tier: 'minimal', has_crisis_flag: true,
        is_encrypted: false, is_e2ee_encrypted: false,
        completed_at: new Date(),
      }],
    });
    await ValidatedAssessment.create('u1', {
      instrument: 'PHQ9',
      responses: [0, 0, 0, 0, 0, 0, 0, 0, 2],
    });
    const values = db.query.mock.calls[0][1];
    expect(values[5]).toBe(true); // has_crisis_flag
  });

  test('E2EE flag triggers legacy server-side encrypt at rest (v1 limitation)', async () => {
    db.query.mockResolvedValue({
      rows: [{
        assessment_id: 'a1', instrument: 'GAD7',
        responses: 'enc([1,1,1,1,1,1,1])',
        total_score: 7, severity_tier: 'mild',
        has_crisis_flag: false,
        is_encrypted: true, is_e2ee_encrypted: false,
        completed_at: new Date(),
      }],
    });
    await ValidatedAssessment.create('u1', {
      instrument: 'GAD7',
      responses: [1, 1, 1, 1, 1, 1, 1],
      is_e2ee_encrypted: true,
    });
    expect(mockEncrypt).toHaveBeenCalled();
  });

  test('rejects unknown instrument', async () => {
    await expect(
      ValidatedAssessment.create('u1', { instrument: 'BOGUS', responses: [0] })
    ).rejects.toThrow(/Unknown instrument/);
  });
});

describe('ValidatedAssessment.getUserAssessments', () => {
  test('parses responses JSON back to array on read', async () => {
    db.query.mockResolvedValue({
      rows: [{
        assessment_id: 'a1', instrument: 'PHQ9',
        responses: '[1,2,3,1,0,1,2,1,0]',
        total_score: 11, severity_tier: 'moderate',
        is_encrypted: false, is_e2ee_encrypted: false,
        completed_at: new Date(),
      }],
    });
    const rows = await ValidatedAssessment.getUserAssessments('u1');
    expect(rows[0].responses).toEqual([1, 2, 3, 1, 0, 1, 2, 1, 0]);
  });

  test('legacy-encrypted row decrypts responses on read', async () => {
    db.query.mockResolvedValue({
      rows: [{
        assessment_id: 'a1', instrument: 'GAD7',
        responses: 'enc([2,2,2,2,2,2,2])',
        total_score: 14, severity_tier: 'moderate',
        is_encrypted: true, is_e2ee_encrypted: false,
        completed_at: new Date(),
      }],
    });
    const rows = await ValidatedAssessment.getUserAssessments('u1');
    expect(mockDecrypt).toHaveBeenCalled();
    expect(rows[0].responses).toEqual([2, 2, 2, 2, 2, 2, 2]);
  });
});

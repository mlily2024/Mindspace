/**
 * Tests for MoodSentiment model — validation + DB interaction.
 *
 * DB is mocked. Verifies argument validation, that the model NEVER
 * persists plaintext, and the INSERT shape.
 */

process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET     = 'test_jwt_secret';

const mockQuery = jest.fn();
jest.mock('../src/config/database', () => ({
  query: (...args) => mockQuery(...args)
}));

const MoodSentiment = require('../src/models/MoodSentiment');

const VALID = Object.freeze({
  sentimentScore: 0.65,
  sentimentLabel: 'positive',
  confidence:     0.92,
  modelId:        'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
  modelVersion:   '1.0.0',
  textLength:     128,
  textHash:       'a'.repeat(64),
  moodEntryId:    null,
  clientUserAgent: 'jest',
  inferenceMs:    47
});

beforeEach(() => { mockQuery.mockReset(); });

describe('MoodSentiment.create() — validation', () => {

  it('rejects missing userId', async () => {
    await expect(MoodSentiment.create(null, VALID))
      .rejects.toThrow(/userId/);
  });

  it('rejects out-of-range sentimentScore', async () => {
    await expect(MoodSentiment.create('u', { ...VALID, sentimentScore:  1.1 })).rejects.toThrow(/sentimentScore/);
    await expect(MoodSentiment.create('u', { ...VALID, sentimentScore: -1.1 })).rejects.toThrow(/sentimentScore/);
    await expect(MoodSentiment.create('u', { ...VALID, sentimentScore: NaN })).rejects.toThrow(/sentimentScore/);
  });

  it('rejects unknown sentimentLabel', async () => {
    await expect(MoodSentiment.create('u', { ...VALID, sentimentLabel: 'angry' }))
      .rejects.toThrow(/sentimentLabel/);
  });

  it('rejects confidence outside [0, 1]', async () => {
    await expect(MoodSentiment.create('u', { ...VALID, confidence: 1.5 })).rejects.toThrow(/confidence/);
    await expect(MoodSentiment.create('u', { ...VALID, confidence: -0.1 })).rejects.toThrow(/confidence/);
  });

  it('rejects missing modelId', async () => {
    await expect(MoodSentiment.create('u', { ...VALID, modelId: '' })).rejects.toThrow(/modelId/);
  });

  it('rejects malformed textHash', async () => {
    await expect(MoodSentiment.create('u', { ...VALID, textHash: 'too-short' }))
      .rejects.toThrow(/textHash/);
    await expect(MoodSentiment.create('u', { ...VALID, textHash: 'g'.repeat(64) }))
      .rejects.toThrow(/textHash/);
  });

  it('rejects negative textLength', async () => {
    await expect(MoodSentiment.create('u', { ...VALID, textLength: -1 }))
      .rejects.toThrow(/textLength/);
  });

  it('rejects negative inferenceMs', async () => {
    await expect(MoodSentiment.create('u', { ...VALID, inferenceMs: -5 }))
      .rejects.toThrow(/inferenceMs/);
  });

  it('accepts neutral label', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...VALID, sentiment_id: 'x', sentiment_label: 'neutral' }] });
    const row = await MoodSentiment.create('u', { ...VALID, sentimentLabel: 'neutral', sentimentScore: 0 });
    expect(row.sentiment_label).toBe('neutral');
  });

  it('omits optional fields gracefully (all nullable on the wire)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ sentiment_id: 'x' }] });
    await MoodSentiment.create('u', {
      sentimentScore: 0.4,
      sentimentLabel: 'positive',
      confidence:     0.8,
      modelId:        'm'
      // no modelVersion, no textLength, no textHash, etc.
    });
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe('MoodSentiment.create() — payload contract', () => {
  it('NEVER passes plaintext to the DB INSERT', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ sentiment_id: 'x' }] });
    const secret = 'plaintext-MUST-NEVER-be-stored';
    // The model has no place to put plaintext, but make sure passing
    // an unknown 'text' key in `data` doesn't leak it via INSERT params.
    await MoodSentiment.create('u', { ...VALID, text: secret });
    const params = mockQuery.mock.calls[0][1];
    expect(JSON.stringify(params)).not.toContain(secret);
  });
});

describe('MoodSentiment.findByUser()', () => {

  it('rejects missing userId', async () => {
    await expect(MoodSentiment.findByUser(null)).rejects.toThrow(/userId/);
  });

  it('rejects invalid label', async () => {
    await expect(MoodSentiment.findByUser('u', { label: 'bogus' }))
      .rejects.toThrow(/label/);
  });

  it('clamps limit into [1, 200]', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await MoodSentiment.findByUser('u', { limit: 10_000 });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/LIMIT 200/);
  });

  it('builds a label-filtered query when label given', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await MoodSentiment.findByUser('u', { label: 'positive' });
    const sql    = mockQuery.mock.calls[0][0];
    const params = mockQuery.mock.calls[0][1];
    expect(sql).toMatch(/sentiment_label = \$2/);
    expect(params).toEqual(['u', 'positive']);
  });
});

describe('MoodSentiment.summarize()', () => {

  it('clamps daysBack into [1, 365]', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const r = await MoodSentiment.summarize('u', 99_999);
    expect(r.daysBack).toBe(365);
  });

  it('forwards label-grouping query', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { label: 'positive', n: 12, mean_score: 0.62, mean_confidence: 0.91 },
        { label: 'negative', n: 3,  mean_score: -0.45, mean_confidence: 0.84 }
      ]
    });
    const r = await MoodSentiment.summarize('u', 30);
    expect(r.daysBack).toBe(30);
    expect(r.perLabel).toHaveLength(2);
    expect(r.perLabel[0]).toMatchObject({ label: 'positive', n: 12 });
  });
});

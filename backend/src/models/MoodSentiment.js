const db = require('../config/database');

/**
 * MoodSentiment — persistence layer for on-device sentiment results.
 *
 * Strict contract: this model never accepts or returns plaintext.
 * The frontend computes the sentiment in the browser; only the score,
 * label, confidence, model provenance, and metadata are persisted.
 */

const VALID_LABELS = Object.freeze(['positive', 'negative', 'neutral']);

const _requireFinite01 = (name, value) => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`MoodSentiment: ${name} must be a finite number in [0, 1]`);
  }
};

const _requireFiniteSigned = (name, value) => {
  if (!Number.isFinite(value) || value < -1 || value > 1) {
    throw new Error(`MoodSentiment: ${name} must be a finite number in [-1, 1]`);
  }
};

/**
 * Persist one on-device analysis result for a user.
 *
 * @param {string} userId
 * @param {Object} data
 * @param {number}  data.sentimentScore   in [-1, 1] (signed: + positive, − negative)
 * @param {string}  data.sentimentLabel   one of 'positive' | 'negative' | 'neutral'
 * @param {number}  data.confidence       in [0, 1]
 * @param {string}  data.modelId          e.g. 'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
 * @param {string|null} [data.modelVersion]
 * @param {number|null} [data.textLength]
 * @param {string|null} [data.textHash]   64-char SHA-256 hex; NEVER plaintext
 * @param {string|null} [data.moodEntryId]
 * @param {string|null} [data.clientUserAgent]
 * @param {number|null} [data.inferenceMs]
 * @returns {Promise<Object>} the inserted row
 */
const create = async (userId, data) => {
  if (!userId) throw new Error('MoodSentiment.create: userId is required');

  const {
    sentimentScore, sentimentLabel, confidence, modelId,
    modelVersion = null, textLength = null, textHash = null,
    moodEntryId = null, clientUserAgent = null, inferenceMs = null
  } = data || {};

  _requireFiniteSigned('sentimentScore', sentimentScore);
  if (!VALID_LABELS.includes(sentimentLabel)) {
    throw new Error(`MoodSentiment.create: sentimentLabel must be one of ${VALID_LABELS.join(', ')}`);
  }
  _requireFinite01('confidence', confidence);
  if (!modelId || typeof modelId !== 'string') {
    throw new Error('MoodSentiment.create: modelId is required');
  }
  if (textHash !== null && (typeof textHash !== 'string' || !/^[a-f0-9]{64}$/.test(textHash))) {
    throw new Error('MoodSentiment.create: textHash must be a 64-character SHA-256 hex string when provided');
  }
  if (textLength !== null && (!Number.isInteger(textLength) || textLength < 0)) {
    throw new Error('MoodSentiment.create: textLength must be a non-negative integer when provided');
  }
  if (inferenceMs !== null && (!Number.isInteger(inferenceMs) || inferenceMs < 0)) {
    throw new Error('MoodSentiment.create: inferenceMs must be a non-negative integer when provided');
  }

  const r = await db.query(
    `INSERT INTO mood_sentiments
       (user_id, mood_entry_id, sentiment_score, sentiment_label, confidence,
        model_id, model_version, text_length, text_hash,
        client_user_agent, inference_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [userId, moodEntryId, sentimentScore, sentimentLabel, confidence,
     modelId, modelVersion, textLength, textHash,
     clientUserAgent, inferenceMs]
  );
  return r.rows[0];
};

/**
 * List recent sentiment rows for a user.
 *
 * @param {string} userId
 * @param {Object} [opts]
 * @param {number} [opts.limit=30]
 * @param {string} [opts.label]   filter by 'positive' | 'negative' | 'neutral'
 */
const findByUser = async (userId, { limit = 30, label = null } = {}) => {
  if (!userId) throw new Error('MoodSentiment.findByUser: userId is required');
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 200);
  const params = [userId];
  let where = 'user_id = $1';
  if (label) {
    if (!VALID_LABELS.includes(label)) {
      throw new Error('MoodSentiment.findByUser: invalid label');
    }
    params.push(label);
    where += ` AND sentiment_label = $${params.length}`;
  }
  const r = await db.query(
    `SELECT * FROM mood_sentiments
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ${safeLimit}`,
    params
  );
  return r.rows;
};

/**
 * Per-label counts + mean signed score for a user over the last N days.
 */
const summarize = async (userId, daysBack = 30) => {
  if (!userId) throw new Error('MoodSentiment.summarize: userId is required');
  const safeDays = Math.min(Math.max(parseInt(daysBack, 10) || 30, 1), 365);
  const r = await db.query(
    `SELECT sentiment_label              AS label,
            COUNT(*)::int                AS n,
            AVG(sentiment_score)::float  AS mean_score,
            AVG(confidence)::float       AS mean_confidence
       FROM mood_sentiments
      WHERE user_id = $1
        AND created_at >= NOW() - ($2 || ' days')::interval
      GROUP BY sentiment_label
      ORDER BY n DESC`,
    [userId, safeDays]
  );
  return {
    daysBack: safeDays,
    perLabel: r.rows
  };
};

module.exports = {
  create,
  findByUser,
  summarize,
  // Exported for testing
  _internal: { VALID_LABELS }
};

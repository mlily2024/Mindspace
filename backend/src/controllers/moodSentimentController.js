const MoodSentiment = require('../models/MoodSentiment');
const aiAudit = require('../services/aiAuditService');
const logger = require('../config/logger');

/**
 * POST /api/mood-sentiments
 * Body: { sentimentScore, sentimentLabel, confidence, modelId,
 *         modelVersion?, textLength?, textHash?, moodEntryId?,
 *         inferenceMs? }
 *
 * Accepts the RESULT of on-device sentiment analysis. The endpoint
 * deliberately does NOT accept the analysed text.
 */
const createSentiment = async (req, res, next) => {
  try {
    const row = await MoodSentiment.create(req.user.userId, {
      sentimentScore:  req.body.sentimentScore,
      sentimentLabel:  req.body.sentimentLabel,
      confidence:      req.body.confidence,
      modelId:         req.body.modelId,
      modelVersion:    req.body.modelVersion || null,
      textLength:      req.body.textLength == null ? null : Number(req.body.textLength),
      textHash:        req.body.textHash || null,
      moodEntryId:     req.body.moodEntryId || null,
      clientUserAgent: req.get('user-agent') || null,
      inferenceMs:     req.body.inferenceMs == null ? null : Number(req.body.inferenceMs)
    });

    // Fire-and-forget audit trail. The audit log captures the fact that
    // a sentiment release happened, not the underlying text.
    aiAudit.safeAppend({
      userId: req.user.userId,
      provider: 'on_device_sentiment',
      modelVersion: req.body.modelId,
      userMessage: req.body.textHash || '',         // already a hash → hashed again, fine
      modelResponse: `${row.sentiment_label}:${row.sentiment_score.toFixed(3)}`,
      safetyVerdict: { crisisDetected: false },
      outputClassification: 'sentiment_only',
      latencyMs: row.inference_ms || 0
    });

    logger.info('On-device sentiment recorded', {
      userId: req.user.userId,
      sentimentId: row.sentiment_id,
      label: row.sentiment_label
    });

    res.status(201).json({
      success: true,
      data: { sentiment: row }
    });
  } catch (err) {
    if (err && err.message && err.message.startsWith('MoodSentiment')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    logger.error('Create sentiment error', {
      userId: req.user && req.user.userId,
      error: err && err.message
    });
    next(err);
  }
};

const getRecent = async (req, res, next) => {
  try {
    const sentiments = await MoodSentiment.findByUser(req.user.userId, {
      limit: req.query.limit,
      label: req.query.label
    });
    res.json({ success: true, data: { sentiments } });
  } catch (err) {
    if (err && err.message && err.message.startsWith('MoodSentiment')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const summary = await MoodSentiment.summarize(req.user.userId, req.query.days);
    res.json({ success: true, data: summary });
  } catch (err) {
    if (err && err.message && err.message.startsWith('MoodSentiment')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

module.exports = {
  createSentiment,
  getRecent,
  getSummary
};

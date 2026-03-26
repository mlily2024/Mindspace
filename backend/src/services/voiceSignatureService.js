/**
 * Voice Mood Signature Analysis Service
 * Processes voice feature data to maintain baselines, detect anomalies,
 * and correlate voice patterns with mood scores.
 *
 * Features are extracted on the frontend (Web Audio API) and sent here
 * for storage, baseline tracking, and deviation analysis.
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

const VOICE_FEATURES = [
  'pitch',
  'pitch_variability',
  'speech_rate',
  'pause_frequency',
  'volume',
  'volume_variability',
  'jitter'
];

class VoiceSignatureService {
  /**
   * Record a voice sample, save it, and update the user's baseline.
   * @param {string} userId
   * @param {object} features - {pitch, pitch_variability, speech_rate, pause_frequency, volume, volume_variability, jitter}
   * @param {number|null} associatedMoodScore - optional mood score recorded at the same time
   * @returns {object} saved sample with deviation info
   */
  static async recordSample(userId, features, associatedMoodScore = null) {
    try {
      // Compute deviation before updating baseline so it's relative to the prior baseline
      const deviation = await this.computeDeviation(userId, features);

      // Persist the sample
      const sampleId = uuidv4();
      const result = await db.query(
        `INSERT INTO voice_signature_samples
           (id, user_id, pitch, pitch_variability, speech_rate, pause_frequency,
            volume, volume_variability, jitter, associated_mood_score,
            deviation_score, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         RETURNING *`,
        [
          sampleId,
          userId,
          features.pitch,
          features.pitch_variability,
          features.speech_rate,
          features.pause_frequency,
          features.volume,
          features.volume_variability,
          features.jitter,
          associatedMoodScore,
          deviation.deviationScore
        ]
      );

      // Update the running baseline
      await this._updateBaseline(userId, features);

      logger.info('Voice sample recorded', { userId, sampleId, deviationScore: deviation.deviationScore });

      return {
        sample: result.rows[0],
        deviation
      };
    } catch (error) {
      logger.error('Error recording voice sample', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get the user's baseline voice profile (running averages and std deviations).
   * @param {string} userId
   * @returns {object|null} baseline profile or null if no data
   */
  static async getBaseline(userId) {
    try {
      const result = await db.query(
        `SELECT * FROM voice_signature_baselines WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        userId: row.user_id,
        sampleCount: row.sample_count,
        means: {
          pitch: parseFloat(row.mean_pitch),
          pitch_variability: parseFloat(row.mean_pitch_variability),
          speech_rate: parseFloat(row.mean_speech_rate),
          pause_frequency: parseFloat(row.mean_pause_frequency),
          volume: parseFloat(row.mean_volume),
          volume_variability: parseFloat(row.mean_volume_variability),
          jitter: parseFloat(row.mean_jitter)
        },
        stdDevs: {
          pitch: parseFloat(row.std_pitch),
          pitch_variability: parseFloat(row.std_pitch_variability),
          speech_rate: parseFloat(row.std_speech_rate),
          pause_frequency: parseFloat(row.std_pause_frequency),
          volume: parseFloat(row.std_volume),
          volume_variability: parseFloat(row.std_volume_variability),
          jitter: parseFloat(row.std_jitter)
        },
        updatedAt: row.updated_at
      };
    } catch (error) {
      logger.error('Error fetching voice baseline', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Compute how much a set of features deviates from the user's baseline.
   * Returns a composite deviation score (mean of per-feature z-scores).
   * @param {string} userId
   * @param {object} features
   * @returns {object} {deviationScore, featureDeviations}
   */
  static async computeDeviation(userId, features) {
    try {
      const baseline = await this.getBaseline(userId);

      // No baseline yet — deviation is 0 by definition
      if (!baseline || baseline.sampleCount < 2) {
        return {
          deviationScore: 0,
          featureDeviations: VOICE_FEATURES.reduce((acc, f) => { acc[f] = 0; return acc; }, {})
        };
      }

      const featureDeviations = {};
      let totalAbsZ = 0;

      for (const feature of VOICE_FEATURES) {
        const mean = baseline.means[feature];
        const std = baseline.stdDevs[feature];
        const value = features[feature] || 0;

        if (std > 0) {
          featureDeviations[feature] = (value - mean) / std;
        } else {
          featureDeviations[feature] = 0;
        }
        totalAbsZ += Math.abs(featureDeviations[feature]);
      }

      const deviationScore = totalAbsZ / VOICE_FEATURES.length;

      return { deviationScore, featureDeviations };
    } catch (error) {
      logger.error('Error computing voice deviation', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Detect whether a voice sample is anomalous (deviation > 1.5 std from baseline).
   * @param {string} userId
   * @param {object} features
   * @returns {object} {isAnomaly, deviationScore, alerts[]}
   */
  static async detectAnomaly(userId, features) {
    try {
      const ANOMALY_THRESHOLD = 1.5;
      const deviation = await this.computeDeviation(userId, features);
      const alerts = [];

      // Flag individual features that are significantly deviant
      for (const feature of VOICE_FEATURES) {
        const absZ = Math.abs(deviation.featureDeviations[feature]);
        if (absZ > ANOMALY_THRESHOLD) {
          const direction = deviation.featureDeviations[feature] > 0 ? 'elevated' : 'reduced';
          alerts.push({
            feature,
            zScore: deviation.featureDeviations[feature],
            direction,
            message: `${feature.replace(/_/g, ' ')} is significantly ${direction} (z=${deviation.featureDeviations[feature].toFixed(2)})`
          });
        }
      }

      const isAnomaly = deviation.deviationScore > ANOMALY_THRESHOLD;

      if (isAnomaly) {
        logger.info('Voice anomaly detected', {
          userId,
          deviationScore: deviation.deviationScore,
          alertCount: alerts.length
        });
      }

      return {
        isAnomaly,
        deviationScore: deviation.deviationScore,
        alerts
      };
    } catch (error) {
      logger.error('Error detecting voice anomaly', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Analyze correlation between voice deviations and mood scores.
   * Uses Pearson correlation on all samples that have both a deviation score
   * and an associated mood score.
   * @param {string} userId
   * @returns {object} correlation analysis
   */
  static async getVoiceMoodCorrelation(userId) {
    try {
      const result = await db.query(
        `SELECT deviation_score, associated_mood_score,
                pitch, pitch_variability, speech_rate, pause_frequency,
                volume, volume_variability, jitter
         FROM voice_signature_samples
         WHERE user_id = $1
           AND associated_mood_score IS NOT NULL
           AND deviation_score IS NOT NULL
         ORDER BY recorded_at ASC`,
        [userId]
      );

      const rows = result.rows;
      if (rows.length < 5) {
        return {
          status: 'insufficient_data',
          message: `Need at least 5 samples with mood scores. You have ${rows.length}.`,
          samplesNeeded: 5 - rows.length
        };
      }

      // Overall deviation-mood correlation
      const deviations = rows.map(r => parseFloat(r.deviation_score));
      const moods = rows.map(r => parseFloat(r.associated_mood_score));
      const overallCorrelation = this._pearson(deviations, moods);

      // Per-feature correlations with mood
      const featureCorrelations = {};
      for (const feature of VOICE_FEATURES) {
        const featureValues = rows.map(r => parseFloat(r[feature]));
        featureCorrelations[feature] = this._pearson(featureValues, moods);
      }

      return {
        status: 'ok',
        sampleCount: rows.length,
        overallCorrelation: {
          r: overallCorrelation,
          interpretation: this._interpretCorrelation(overallCorrelation)
        },
        featureCorrelations,
        strongestPredictor: Object.entries(featureCorrelations)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]
      };
    } catch (error) {
      logger.error('Error computing voice-mood correlation', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get recent voice samples with deviation scores.
   * @param {string} userId
   * @param {number} days - number of days to look back (default 30)
   * @returns {object[]} recent samples
   */
  static async getHistory(userId, days = 30) {
    try {
      const result = await db.query(
        `SELECT id, pitch, pitch_variability, speech_rate, pause_frequency,
                volume, volume_variability, jitter,
                associated_mood_score, deviation_score, recorded_at
         FROM voice_signature_samples
         WHERE user_id = $1
           AND recorded_at >= NOW() - INTERVAL '1 day' * $2
         ORDER BY recorded_at DESC`,
        [userId, days]
      );

      return result.rows.map(row => ({
        id: row.id,
        features: {
          pitch: parseFloat(row.pitch),
          pitch_variability: parseFloat(row.pitch_variability),
          speech_rate: parseFloat(row.speech_rate),
          pause_frequency: parseFloat(row.pause_frequency),
          volume: parseFloat(row.volume),
          volume_variability: parseFloat(row.volume_variability),
          jitter: parseFloat(row.jitter)
        },
        associatedMoodScore: row.associated_mood_score ? parseFloat(row.associated_mood_score) : null,
        deviationScore: parseFloat(row.deviation_score),
        recordedAt: row.recorded_at
      }));
    } catch (error) {
      logger.error('Error fetching voice history', { userId, days, error: error.message });
      throw error;
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────

  /**
   * Update the running baseline using Welford's online algorithm for mean and variance.
   */
  static async _updateBaseline(userId, features) {
    const existing = await db.query(
      `SELECT * FROM voice_signature_baselines WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      // First sample — initialise baseline
      await db.query(
        `INSERT INTO voice_signature_baselines
           (user_id, sample_count,
            mean_pitch, mean_pitch_variability, mean_speech_rate, mean_pause_frequency,
            mean_volume, mean_volume_variability, mean_jitter,
            std_pitch, std_pitch_variability, std_speech_rate, std_pause_frequency,
            std_volume, std_volume_variability, std_jitter,
            m2_pitch, m2_pitch_variability, m2_speech_rate, m2_pause_frequency,
            m2_volume, m2_volume_variability, m2_jitter,
            updated_at)
         VALUES ($1, 1,
                 $2, $3, $4, $5, $6, $7, $8,
                 0, 0, 0, 0, 0, 0, 0,
                 0, 0, 0, 0, 0, 0, 0,
                 NOW())`,
        [
          userId,
          features.pitch, features.pitch_variability, features.speech_rate,
          features.pause_frequency, features.volume, features.volume_variability,
          features.jitter
        ]
      );
      return;
    }

    // Welford's online update
    const row = existing.rows[0];
    const n = row.sample_count + 1;
    const updates = {};

    for (const feature of VOICE_FEATURES) {
      const colMean = `mean_${feature}`;
      const colM2 = `m2_${feature}`;
      const colStd = `std_${feature}`;

      const oldMean = parseFloat(row[colMean]);
      const oldM2 = parseFloat(row[colM2]);
      const x = features[feature] || 0;

      const newMean = oldMean + (x - oldMean) / n;
      const newM2 = oldM2 + (x - oldMean) * (x - newMean);
      const newStd = n > 1 ? Math.sqrt(newM2 / (n - 1)) : 0;

      updates[colMean] = newMean;
      updates[colM2] = newM2;
      updates[colStd] = newStd;
    }

    await db.query(
      `UPDATE voice_signature_baselines
       SET sample_count = $1,
           mean_pitch = $2, mean_pitch_variability = $3, mean_speech_rate = $4,
           mean_pause_frequency = $5, mean_volume = $6, mean_volume_variability = $7, mean_jitter = $8,
           std_pitch = $9, std_pitch_variability = $10, std_speech_rate = $11,
           std_pause_frequency = $12, std_volume = $13, std_volume_variability = $14, std_jitter = $15,
           m2_pitch = $16, m2_pitch_variability = $17, m2_speech_rate = $18,
           m2_pause_frequency = $19, m2_volume = $20, m2_volume_variability = $21, m2_jitter = $22,
           updated_at = NOW()
       WHERE user_id = $23`,
      [
        n,
        updates.mean_pitch, updates.mean_pitch_variability, updates.mean_speech_rate,
        updates.mean_pause_frequency, updates.mean_volume, updates.mean_volume_variability, updates.mean_jitter,
        updates.std_pitch, updates.std_pitch_variability, updates.std_speech_rate,
        updates.std_pause_frequency, updates.std_volume, updates.std_volume_variability, updates.std_jitter,
        updates.m2_pitch, updates.m2_pitch_variability, updates.m2_speech_rate,
        updates.m2_pause_frequency, updates.m2_volume, updates.m2_volume_variability, updates.m2_jitter,
        userId
      ]
    );
  }

  /**
   * Pearson correlation coefficient for two arrays.
   */
  static _pearson(x, y) {
    const n = x.length;
    if (n === 0) return 0;

    const meanX = x.reduce((s, v) => s + v, 0) / n;
    const meanY = y.reduce((s, v) => s + v, 0) / n;

    let num = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denom = Math.sqrt(denomX * denomY);
    return denom === 0 ? 0 : num / denom;
  }

  /**
   * Human-readable interpretation of a correlation coefficient.
   */
  static _interpretCorrelation(r) {
    const abs = Math.abs(r);
    const direction = r >= 0 ? 'positive' : 'negative';
    if (abs < 0.1) return 'negligible';
    if (abs < 0.3) return `weak ${direction}`;
    if (abs < 0.5) return `moderate ${direction}`;
    if (abs < 0.7) return `strong ${direction}`;
    return `very strong ${direction}`;
  }
}

module.exports = VoiceSignatureService;

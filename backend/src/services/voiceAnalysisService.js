/**
 * Voice Emotion Analysis Service
 * Analyzes voice recordings for emotional content
 *
 * MVP Implementation: Basic acoustic feature extraction and rule-based emotion mapping
 * Future: Integration with ML-based speech emotion recognition
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class VoiceAnalysisService {
  /**
   * Analyze voice recording and extract emotional indicators
   *
   * In MVP, we receive pre-extracted features from the frontend
   * (using Web Audio API) and map them to emotions
   */
  static async analyzeVoice(userId, audioFeatures, transcript = null) {
    try {
      // Get user's baseline for comparison
      const baseline = await this.getUserBaseline(userId);

      // Calculate deviations from baseline
      const deviations = this.calculateDeviations(audioFeatures, baseline);

      // Map features to emotions
      const emotions = this.mapToEmotions(audioFeatures, deviations, baseline);

      // Convert emotions to mood metrics
      const moodMetrics = this.emotionsToMoodMetrics(emotions);

      // Calculate overall confidence
      const confidence = this.calculateConfidence(audioFeatures, baseline);

      // Save analysis to database
      const analysis = await this.saveAnalysis(userId, {
        emotions,
        acousticFeatures: audioFeatures,
        confidence,
        transcript,
        suggestedMood: moodMetrics.mood,
        suggestedEnergy: moodMetrics.energy
      });

      // Update user's baseline with new data
      await this.updateUserBaseline(userId, audioFeatures);

      logger.info('Voice analysis completed', {
        userId,
        confidence,
        suggestedMood: moodMetrics.mood
      });

      return {
        analysisId: analysis.analysis_id,
        emotions,
        moodMetrics,
        confidence,
        deviations,
        interpretation: this.generateInterpretation(emotions, moodMetrics, deviations)
      };
    } catch (error) {
      logger.error('Voice analysis error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Map acoustic features to emotional indicators
   *
   * Based on research correlations:
   * - Higher pitch + faster speech → excitement, anxiety, or joy
   * - Lower pitch + slower speech → sadness, fatigue, or calm
   * - Higher pitch variation → emotional expressiveness
   * - More pauses → cognitive load, uncertainty, or depression
   * - Louder volume → confidence, anger, or excitement
   * - Softer volume → sadness, fatigue, or shyness
   */
  static mapToEmotions(features, deviations, baseline) {
    const emotions = {
      energy: 5,      // 1-10 scale
      stress: 5,      // 1-10 scale
      positivity: 5,  // 1-10 scale (valence)
      confidence: 5   // 1-10 scale
    };

    // If no baseline yet, use absolute feature analysis
    if (!baseline || baseline.sample_count < 3) {
      return this.analyzeAbsoluteFeatures(features);
    }

    // Pitch analysis
    if (deviations.pitch !== null) {
      if (deviations.pitch > 0.15) {
        // Higher than usual pitch
        emotions.energy += 1.5;
        emotions.stress += 1;
      } else if (deviations.pitch < -0.15) {
        // Lower than usual pitch
        emotions.energy -= 1.5;
        emotions.positivity -= 0.5;
      }
    }

    // Pitch variation analysis
    if (deviations.pitchVariation !== null) {
      if (deviations.pitchVariation > 0.2) {
        // More expressive than usual
        emotions.positivity += 1;
        emotions.energy += 0.5;
      } else if (deviations.pitchVariation < -0.2) {
        // Flatter/monotone than usual
        emotions.positivity -= 1;
        emotions.energy -= 0.5;
      }
    }

    // Speech rate analysis
    if (deviations.speechRate !== null) {
      if (deviations.speechRate > 0.2) {
        // Faster than usual
        emotions.energy += 1;
        emotions.stress += 0.5;
      } else if (deviations.speechRate < -0.2) {
        // Slower than usual
        emotions.energy -= 1;
        // Could be relaxation OR fatigue - use other indicators
        if (deviations.pitch < 0) {
          emotions.positivity -= 0.5;
        }
      }
    }

    // Pause frequency analysis
    if (deviations.pauseFrequency !== null) {
      if (deviations.pauseFrequency > 0.25) {
        // More pauses than usual
        emotions.stress += 1;
        emotions.confidence -= 1;
      } else if (deviations.pauseFrequency < -0.15) {
        // Fewer pauses - flowing speech
        emotions.confidence += 0.5;
      }
    }

    // Volume analysis
    if (deviations.volume !== null) {
      if (deviations.volume > 0.2) {
        // Louder than usual
        emotions.energy += 1;
        emotions.confidence += 1;
      } else if (deviations.volume < -0.2) {
        // Softer than usual
        emotions.energy -= 0.5;
        emotions.confidence -= 0.5;
      }
    }

    // Bound all values to 1-10
    Object.keys(emotions).forEach(key => {
      emotions[key] = Math.max(1, Math.min(10, emotions[key]));
      emotions[key] = parseFloat(emotions[key].toFixed(1));
    });

    return emotions;
  }

  /**
   * Analyze features without baseline comparison
   */
  static analyzeAbsoluteFeatures(features) {
    const emotions = {
      energy: 5,
      stress: 5,
      positivity: 5,
      confidence: 5
    };

    // Use general population norms for initial analysis

    // Speech rate (words per minute) - normal is ~120-150 wpm
    if (features.speechRate) {
      if (features.speechRate > 170) {
        emotions.energy = 7;
        emotions.stress = 6;
      } else if (features.speechRate < 100) {
        emotions.energy = 4;
      }
    }

    // Pitch variation - higher variation generally indicates more engagement
    if (features.pitchVariation) {
      if (features.pitchVariation > 50) {
        emotions.positivity = 6;
        emotions.energy = 6;
      } else if (features.pitchVariation < 20) {
        emotions.positivity = 4;
        emotions.energy = 4;
      }
    }

    // Pause frequency - many pauses can indicate uncertainty or fatigue
    if (features.pauseFrequency) {
      if (features.pauseFrequency > 0.3) {
        emotions.confidence = 4;
        emotions.stress = 6;
      }
    }

    return emotions;
  }

  /**
   * Convert emotional indicators to mood metrics
   */
  static emotionsToMoodMetrics(emotions) {
    // Mood is primarily driven by positivity and inversely by stress
    const mood = Math.round(
      (emotions.positivity * 0.5) +
      (emotions.energy * 0.2) +
      ((10 - emotions.stress) * 0.3)
    );

    // Energy is directly from the energy indicator
    const energy = Math.round(emotions.energy);

    // Stress comes directly from stress indicator
    const stress = Math.round(emotions.stress);

    return {
      mood: Math.max(1, Math.min(10, mood)),
      energy: Math.max(1, Math.min(10, energy)),
      stress: Math.max(1, Math.min(10, stress))
    };
  }

  /**
   * Calculate deviations from user's baseline
   */
  static calculateDeviations(features, baseline) {
    if (!baseline || baseline.sample_count < 3) {
      return {
        pitch: null,
        pitchVariation: null,
        speechRate: null,
        volume: null,
        pauseFrequency: null
      };
    }

    const calculateDeviation = (current, baselineValue) => {
      if (!current || !baselineValue || baselineValue === 0) return null;
      return (current - baselineValue) / baselineValue;
    };

    return {
      pitch: calculateDeviation(features.pitch, baseline.avg_pitch),
      pitchVariation: calculateDeviation(features.pitchVariation, baseline.avg_pitch_variation),
      speechRate: calculateDeviation(features.speechRate, baseline.avg_speech_rate),
      volume: calculateDeviation(features.volume, baseline.avg_volume),
      pauseFrequency: calculateDeviation(features.pauseFrequency, baseline.avg_pause_frequency)
    };
  }

  /**
   * Calculate confidence in the analysis
   */
  static calculateConfidence(features, baseline) {
    let confidence = 0.5; // Base confidence

    // More features = higher confidence
    const featureCount = Object.values(features).filter(v => v !== null && v !== undefined).length;
    confidence += featureCount * 0.05;

    // Having baseline data increases confidence
    if (baseline && baseline.sample_count >= 3) {
      confidence += 0.15;
    }
    if (baseline && baseline.sample_count >= 10) {
      confidence += 0.1;
    }

    // Longer recordings would increase confidence (if we had duration)
    if (features.duration && features.duration >= 10) {
      confidence += 0.1;
    }

    return Math.min(0.9, parseFloat(confidence.toFixed(2)));
  }

  /**
   * Generate human-readable interpretation
   */
  static generateInterpretation(emotions, moodMetrics, deviations) {
    const interpretations = [];

    // Energy interpretation
    if (moodMetrics.energy >= 7) {
      interpretations.push("Your voice sounds energetic and engaged.");
    } else if (moodMetrics.energy <= 4) {
      interpretations.push("Your voice suggests you might be feeling tired or low energy.");
    }

    // Stress interpretation
    if (emotions.stress >= 7) {
      interpretations.push("There are signs of tension or stress in your voice.");
    } else if (emotions.stress <= 3) {
      interpretations.push("Your voice sounds calm and relaxed.");
    }

    // Positivity interpretation
    if (emotions.positivity >= 7) {
      interpretations.push("Your tone has a positive, upbeat quality.");
    } else if (emotions.positivity <= 4) {
      interpretations.push("Your voice has a somewhat subdued quality today.");
    }

    // Deviation-based interpretations
    if (deviations.speechRate && deviations.speechRate < -0.2) {
      interpretations.push("You're speaking slower than usual.");
    }
    if (deviations.pauseFrequency && deviations.pauseFrequency > 0.25) {
      interpretations.push("There are more pauses than usual in your speech.");
    }

    if (interpretations.length === 0) {
      interpretations.push("Your voice patterns are within your normal range.");
    }

    return interpretations.join(" ");
  }

  /**
   * Save analysis to database
   */
  static async saveAnalysis(userId, analysisData) {
    const query = `
      INSERT INTO voice_analyses (
        analysis_id, user_id, detected_emotions, acoustic_features,
        confidence_score, transcript, suggested_mood, suggested_energy,
        analyzed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const values = [
      uuidv4(),
      userId,
      JSON.stringify(analysisData.emotions),
      JSON.stringify(analysisData.acousticFeatures),
      analysisData.confidence,
      analysisData.transcript,
      analysisData.suggestedMood,
      analysisData.suggestedEnergy
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get user's voice baseline
   */
  static async getUserBaseline(userId) {
    const query = `
      SELECT * FROM user_voice_baselines
      WHERE user_id = $1
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Update user's voice baseline with new sample
   */
  static async updateUserBaseline(userId, features) {
    try {
      // Get existing baseline
      const existing = await this.getUserBaseline(userId);

      if (!existing) {
        // Create new baseline
        const insertQuery = `
          INSERT INTO user_voice_baselines (
            baseline_id, user_id, avg_pitch, avg_pitch_variation,
            avg_speech_rate, avg_volume, avg_pause_frequency,
            sample_count, last_updated
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 1, CURRENT_TIMESTAMP)
          RETURNING *
        `;

        const result = await db.query(insertQuery, [
          uuidv4(),
          userId,
          features.pitch || null,
          features.pitchVariation || null,
          features.speechRate || null,
          features.volume || null,
          features.pauseFrequency || null
        ]);

        return result.rows[0];
      }

      // Update existing baseline with exponential moving average
      // Weight recent samples more heavily for first few, then stabilize
      const alpha = existing.sample_count < 10 ? 0.3 : 0.1;
      const count = existing.sample_count;

      const updateQuery = `
        UPDATE user_voice_baselines
        SET
          avg_pitch = CASE
            WHEN $3 IS NOT NULL THEN
              COALESCE(avg_pitch, $3) * (1 - $2) + $3 * $2
            ELSE avg_pitch
          END,
          avg_pitch_variation = CASE
            WHEN $4 IS NOT NULL THEN
              COALESCE(avg_pitch_variation, $4) * (1 - $2) + $4 * $2
            ELSE avg_pitch_variation
          END,
          avg_speech_rate = CASE
            WHEN $5 IS NOT NULL THEN
              COALESCE(avg_speech_rate, $5) * (1 - $2) + $5 * $2
            ELSE avg_speech_rate
          END,
          avg_volume = CASE
            WHEN $6 IS NOT NULL THEN
              COALESCE(avg_volume, $6) * (1 - $2) + $6 * $2
            ELSE avg_volume
          END,
          avg_pause_frequency = CASE
            WHEN $7 IS NOT NULL THEN
              COALESCE(avg_pause_frequency, $7) * (1 - $2) + $7 * $2
            ELSE avg_pause_frequency
          END,
          sample_count = sample_count + 1,
          last_updated = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `;

      const result = await db.query(updateQuery, [
        userId,
        alpha,
        features.pitch,
        features.pitchVariation,
        features.speechRate,
        features.volume,
        features.pauseFrequency
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating voice baseline', { error: error.message, userId });
      // Non-critical - don't throw
      return null;
    }
  }

  /**
   * Get user's voice analysis history
   */
  static async getAnalysisHistory(userId, limit = 10) {
    const query = `
      SELECT * FROM voice_analyses
      WHERE user_id = $1
      ORDER BY analyzed_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Link voice analysis to a mood entry
   */
  static async linkToMoodEntry(analysisId, entryId) {
    const query = `
      UPDATE voice_analyses
      SET entry_id = $2, user_confirmed = TRUE
      WHERE analysis_id = $1
      RETURNING *
    `;

    const result = await db.query(query, [analysisId, entryId]);
    return result.rows[0];
  }
}

module.exports = VoiceAnalysisService;

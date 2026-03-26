/**
 * Quick Check-In Service
 * Handles the 10-second quick check-in flow.
 * Takes minimal input (mood_score, optional energy_score) and infers
 * remaining metrics from the user's recent 7-day patterns.
 */

const db = require('../config/database');
const logger = require('../config/logger');

class QuickCheckInService {
  /**
   * Infer metrics from the user's last 7 days of mood entries.
   * Returns averages for anxiety_level, sleep_quality, and social_interaction
   * so a quick entry can be saved without asking the user for everything.
   *
   * @param {number} userId
   * @returns {Object} inferred metric averages (rounded to nearest int)
   */
  static async inferMetrics(userId) {
    try {
      const query = `
        SELECT
          ROUND(AVG(anxiety_level))   AS avg_anxiety,
          ROUND(AVG(sleep_quality))   AS avg_sleep,
          ROUND(AVG(social_interaction)) AS avg_social,
          ROUND(AVG(energy_level))    AS avg_energy,
          ROUND(AVG(mood_score))      AS avg_mood,
          COUNT(*)                    AS entry_count
        FROM mood_entries
        WHERE user_id = $1
          AND entry_date >= CURRENT_DATE - INTERVAL '7 days'
      `;
      const result = await db.query(query, [userId]);
      const row = result.rows[0];

      if (!row || parseInt(row.entry_count, 10) === 0) {
        // No recent history — return neutral defaults
        return {
          anxiety_level: 3,
          sleep_quality: 3,
          social_interaction: 3,
          energy_level: 3,
          mood_score: 3,
          source: 'default',
          sample_size: 0
        };
      }

      return {
        anxiety_level: parseInt(row.avg_anxiety, 10) || 3,
        sleep_quality: parseInt(row.avg_sleep, 10) || 3,
        social_interaction: parseInt(row.avg_social, 10) || 3,
        energy_level: parseInt(row.avg_energy, 10) || 3,
        mood_score: parseInt(row.avg_mood, 10) || 3,
        source: 'history',
        sample_size: parseInt(row.entry_count, 10)
      };
    } catch (error) {
      logger.error('Error inferring metrics for quick check-in', {
        error: error.message,
        userId
      });
      return {
        anxiety_level: 3,
        sleep_quality: 3,
        social_interaction: 3,
        energy_level: 3,
        mood_score: 3,
        source: 'fallback',
        sample_size: 0
      };
    }
  }

  /**
   * Create a quick mood entry.
   *
   * @param {number} userId
   * @param {Object} data
   * @param {number} data.mood_score      - Required, 1-5
   * @param {number} [data.energy_score]  - Optional, 1-5
   * @returns {Object} the created mood entry row
   */
  static async createQuickEntry(userId, { mood_score, energy_score }) {
    try {
      // Validate required input
      if (mood_score == null || mood_score < 1 || mood_score > 5) {
        throw new Error('mood_score is required and must be between 1 and 5');
      }
      if (energy_score != null && (energy_score < 1 || energy_score > 5)) {
        throw new Error('energy_score must be between 1 and 5');
      }

      // Infer the metrics we didn't ask for
      const inferred = await this.inferMetrics(userId);

      const inferredMetrics = {
        anxiety_level: inferred.anxiety_level,
        sleep_quality: inferred.sleep_quality,
        social_interaction: inferred.social_interaction,
        inference_source: inferred.source,
        sample_size: inferred.sample_size
      };

      // If energy_score was not provided, infer it too
      const effectiveEnergy = energy_score != null ? energy_score : inferred.energy_level;
      if (energy_score == null) {
        inferredMetrics.energy_level = inferred.energy_level;
      }

      const insertQuery = `
        INSERT INTO mood_entries (
          user_id,
          mood_score,
          energy_level,
          anxiety_level,
          sleep_quality,
          social_interaction,
          is_quick_entry,
          inferred_metrics,
          entry_date,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          true,
          $7,
          CURRENT_DATE,
          NOW()
        )
        RETURNING *
      `;

      const values = [
        userId,
        mood_score,
        effectiveEnergy,
        inferred.anxiety_level,
        inferred.sleep_quality,
        inferred.social_interaction,
        JSON.stringify(inferredMetrics)
      ];

      const result = await db.query(insertQuery, values);

      logger.info('Quick check-in created', {
        userId,
        mood_score,
        energy_score: effectiveEnergy,
        inferred_source: inferred.source
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating quick check-in entry', {
        error: error.message,
        userId
      });
      throw error;
    }
  }
}

module.exports = QuickCheckInService;

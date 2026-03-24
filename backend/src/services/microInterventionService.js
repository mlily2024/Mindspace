/**
 * Micro-Interventions Service
 * Manages context-aware therapeutic micro-interventions
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class MicroInterventionService {
  // Cooldown period between interventions (in milliseconds)
  static INTERVENTION_COOLDOWN = 4 * 60 * 60 * 1000; // 4 hours

  /**
   * Get appropriate intervention based on context
   */
  static async getContextualIntervention(userId, context) {
    try {
      // Check cooldown - don't spam interventions
      const recentIntervention = await this.getRecentIntervention(userId);
      if (recentIntervention && !context.override) {
        const timeSince = Date.now() - new Date(recentIntervention.triggered_at).getTime();
        if (timeSince < this.INTERVENTION_COOLDOWN) {
          return null;
        }
      }

      // Determine the best intervention based on context
      const intervention = await this.selectIntervention(userId, context);

      if (!intervention) {
        return null;
      }

      // Record that this intervention was delivered
      await this.recordInterventionDelivered(userId, intervention.intervention_id, context.trigger);

      logger.info('Intervention suggested', {
        userId,
        interventionCode: intervention.intervention_code,
        trigger: context.trigger
      });

      return {
        interventionId: intervention.intervention_id,
        code: intervention.intervention_code,
        title: intervention.title,
        description: intervention.description,
        type: intervention.intervention_type,
        duration: intervention.duration_seconds,
        content: intervention.content,
        icon: intervention.icon,
        color: intervention.color,
        effortLevel: intervention.effort_level
      };
    } catch (error) {
      logger.error('Error getting contextual intervention', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Select the most appropriate intervention
   */
  static async selectIntervention(userId, context) {
    const { moodEntry, trigger } = context;

    // Get all active interventions
    const interventionsQuery = `
      SELECT * FROM micro_interventions
      WHERE is_active = TRUE
      ORDER BY intervention_code
    `;
    const result = await db.query(interventionsQuery);
    const interventions = result.rows;

    if (interventions.length === 0) {
      return null;
    }

    // Score each intervention based on context
    const scored = interventions.map(intervention => {
      let score = 0;
      const conditions = intervention.trigger_conditions;

      // Check mood-based triggers
      if (moodEntry) {
        const mood = parseInt(moodEntry.mood_score);
        const stress = parseInt(moodEntry.stress_level) || 5;
        const anxiety = parseInt(moodEntry.anxiety_level) || 5;
        const energy = parseInt(moodEntry.energy_level) || 5;

        // Low mood matches
        if (conditions.triggers?.includes('low_mood') && mood <= 4) {
          score += 3;
        }

        // High stress matches
        if (conditions.triggers?.includes('high_stress') && stress >= conditions.stress_threshold) {
          score += 3;
        }

        // High anxiety matches
        if (conditions.triggers?.includes('high_anxiety') && anxiety >= (conditions.anxiety_threshold || 7)) {
          score += 4; // Higher priority for anxiety
        }

        // Low energy matches
        if (conditions.triggers?.includes('low_energy') && energy <= (conditions.energy_threshold || 4)) {
          score += 2;
        }

        // Neutral mood engagement
        if (conditions.triggers?.includes('neutral_mood') && mood >= 4 && mood <= 6) {
          score += 1;
        }

        // Mood range match
        if (conditions.mood_range) {
          const [min, max] = conditions.mood_range;
          if (mood >= min && mood <= max) {
            score += 2;
          }
        }
      }

      // Post check-in trigger
      if (trigger === 'post_checkin' && conditions.any_checkin) {
        score += 1;
      }

      return { intervention, score };
    });

    // Filter to interventions with positive scores
    const matched = scored.filter(s => s.score > 0);

    if (matched.length === 0) {
      // Return a default gentle intervention
      return interventions.find(i => i.intervention_code === 'gratitude_quick') || null;
    }

    // Sort by score and pick the highest
    matched.sort((a, b) => b.score - a.score);

    // Add some randomness among top matches
    const topMatches = matched.filter(m => m.score === matched[0].score);
    const selected = topMatches[Math.floor(Math.random() * topMatches.length)];

    // Check if user recently did this intervention
    const recentHistory = await this.getInterventionHistory(userId, 7);
    const recentCodes = recentHistory.map(h => h.intervention_code);

    if (recentCodes.includes(selected.intervention.intervention_code)) {
      // Try to find an alternative
      const alternative = matched.find(m => !recentCodes.includes(m.intervention.intervention_code));
      if (alternative) {
        return alternative.intervention;
      }
    }

    return selected.intervention;
  }

  /**
   * Record that an intervention was delivered to user
   */
  static async recordInterventionDelivered(userId, interventionId, triggerReason) {
    const query = `
      INSERT INTO user_interventions (
        user_intervention_id, user_id, intervention_id,
        triggered_at, trigger_reason, was_shown
      )
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, TRUE)
      RETURNING *
    `;

    const result = await db.query(query, [
      uuidv4(),
      userId,
      interventionId,
      triggerReason || 'contextual'
    ]);

    return result.rows[0];
  }

  /**
   * Record intervention completion
   */
  static async recordInterventionCompleted(userId, interventionId, rating = null) {
    try {
      // Find the most recent delivery of this intervention
      const findQuery = `
        SELECT user_intervention_id
        FROM user_interventions
        WHERE user_id = $1 AND intervention_id = $2
        ORDER BY triggered_at DESC
        LIMIT 1
      `;
      const findResult = await db.query(findQuery, [userId, interventionId]);

      if (findResult.rows.length === 0) {
        // Create a new record if not found
        const insertQuery = `
          INSERT INTO user_interventions (
            user_intervention_id, user_id, intervention_id,
            triggered_at, was_shown, was_completed, completed_at, user_rating
          )
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP, TRUE, TRUE, CURRENT_TIMESTAMP, $4)
          RETURNING *
        `;
        const insertResult = await db.query(insertQuery, [
          uuidv4(),
          userId,
          interventionId,
          rating
        ]);
        return insertResult.rows[0];
      }

      // Update existing record
      const updateQuery = `
        UPDATE user_interventions
        SET was_completed = TRUE,
            completed_at = CURRENT_TIMESTAMP,
            user_rating = COALESCE($3, user_rating)
        WHERE user_intervention_id = $1 AND user_id = $2
        RETURNING *
      `;

      const result = await db.query(updateQuery, [
        findResult.rows[0].user_intervention_id,
        userId,
        rating
      ]);

      logger.info('Intervention completed', {
        userId,
        interventionId,
        rating
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error recording intervention completion', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Record intervention skip
   */
  static async recordInterventionSkipped(userId, interventionId) {
    try {
      const findQuery = `
        SELECT user_intervention_id
        FROM user_interventions
        WHERE user_id = $1 AND intervention_id = $2
        ORDER BY triggered_at DESC
        LIMIT 1
      `;
      const findResult = await db.query(findQuery, [userId, interventionId]);

      if (findResult.rows.length > 0) {
        const updateQuery = `
          UPDATE user_interventions
          SET skipped = TRUE,
              skipped_at = CURRENT_TIMESTAMP
          WHERE user_intervention_id = $1
          RETURNING *
        `;

        const result = await db.query(updateQuery, [findResult.rows[0].user_intervention_id]);
        return result.rows[0];
      }

      return null;
    } catch (error) {
      logger.error('Error recording intervention skip', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Get user's recent intervention (for cooldown check)
   */
  static async getRecentIntervention(userId) {
    const query = `
      SELECT ui.*, mi.intervention_code
      FROM user_interventions ui
      JOIN micro_interventions mi ON ui.intervention_id = mi.intervention_id
      WHERE ui.user_id = $1
        AND ui.was_shown = TRUE
        AND ui.triggered_at > CURRENT_TIMESTAMP - INTERVAL '4 hours'
      ORDER BY ui.triggered_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Get user's intervention history
   */
  static async getInterventionHistory(userId, days = 30) {
    const query = `
      SELECT
        ui.*,
        mi.intervention_code,
        mi.title,
        mi.intervention_type,
        mi.icon
      FROM user_interventions ui
      JOIN micro_interventions mi ON ui.intervention_id = mi.intervention_id
      WHERE ui.user_id = $1
        AND ui.triggered_at > CURRENT_TIMESTAMP - $2 * INTERVAL '1 day'
      ORDER BY ui.triggered_at DESC
    `;

    const result = await db.query(query, [userId, days]);
    return result.rows;
  }

  /**
   * Get intervention statistics for user
   */
  static async getInterventionStats(userId) {
    const query = `
      SELECT
        COUNT(*) as total_shown,
        COUNT(CASE WHEN was_completed THEN 1 END) as total_completed,
        COUNT(CASE WHEN skipped THEN 1 END) as total_skipped,
        AVG(user_rating) as avg_rating,
        COUNT(CASE WHEN was_completed AND user_rating >= 4 THEN 1 END) as helpful_count
      FROM user_interventions
      WHERE user_id = $1
        AND triggered_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
    `;

    const result = await db.query(query, [userId]);
    const stats = result.rows[0];

    return {
      totalShown: parseInt(stats.total_shown) || 0,
      totalCompleted: parseInt(stats.total_completed) || 0,
      totalSkipped: parseInt(stats.total_skipped) || 0,
      completionRate: stats.total_shown > 0
        ? ((parseInt(stats.total_completed) / parseInt(stats.total_shown)) * 100).toFixed(0) + '%'
        : '0%',
      averageRating: stats.avg_rating ? parseFloat(stats.avg_rating).toFixed(1) : null,
      helpfulCount: parseInt(stats.helpful_count) || 0
    };
  }

  /**
   * Get all available interventions
   */
  static async getAllInterventions() {
    const query = `
      SELECT * FROM micro_interventions
      WHERE is_active = TRUE
      ORDER BY intervention_type, title
    `;

    const result = await db.query(query);
    return result.rows;
  }

  /**
   * Get intervention by ID
   */
  static async getInterventionById(interventionId) {
    const query = `
      SELECT * FROM micro_interventions
      WHERE intervention_id = $1
    `;

    const result = await db.query(query, [interventionId]);
    return result.rows[0] || null;
  }

  /**
   * Get intervention by code
   */
  static async getInterventionByCode(code) {
    const query = `
      SELECT * FROM micro_interventions
      WHERE intervention_code = $1
    `;

    const result = await db.query(query, [code]);
    return result.rows[0] || null;
  }

  /**
   * Check if user should receive intervention notification
   * (For proactive push notifications - future feature)
   */
  static async checkForProactiveIntervention(userId) {
    // This could be called by a scheduler to check if user
    // should receive a proactive intervention based on:
    // - Time of day patterns
    // - Upcoming calendar events (future)
    // - Prolonged app inactivity
    // - Historical patterns suggesting difficult times

    // For now, return null (not implemented)
    return null;
  }
}

module.exports = MicroInterventionService;

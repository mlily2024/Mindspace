/**
 * Ecological Momentary Assessment (EMA) Service
 * Manages EMA schedules, generates smart prompts based on user patterns,
 * records responses, and computes daily mood variability.
 * Adaptive: reduces prompts when mood is stable, increases when volatile.
 */

const db = require('../config/database');
const logger = require('../config/logger');

class EmaService {
  /**
   * Get the EMA schedule for a user. Creates a default if none exists.
   *
   * @param {number} userId
   * @returns {Object} schedule settings
   */
  static async getSchedule(userId) {
    try {
      const query = `
        SELECT * FROM ema_schedules
        WHERE user_id = $1
      `;
      const result = await db.query(query, [userId]);

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Create default schedule: 3 prompts/day between 9am and 9pm
      const defaultSettings = {
        prompts_per_day: 3,
        start_hour: 9,
        end_hour: 21,
        min_gap_minutes: 120,
        active_days: [1, 2, 3, 4, 5, 6, 7], // all days
        adaptive_enabled: true
      };

      const insertQuery = `
        INSERT INTO ema_schedules (user_id, settings, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        RETURNING *
      `;
      const insertResult = await db.query(insertQuery, [userId, JSON.stringify(defaultSettings)]);
      return insertResult.rows[0];
    } catch (error) {
      logger.error('Error getting EMA schedule', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update EMA schedule settings for a user.
   *
   * @param {number} userId
   * @param {Object} settings - schedule settings to merge
   * @returns {Object} updated schedule
   */
  static async updateSchedule(userId, settings) {
    try {
      // Ensure schedule exists first
      await this.getSchedule(userId);

      const query = `
        UPDATE ema_schedules
        SET settings = settings || $2::jsonb,
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `;
      const result = await db.query(query, [userId, JSON.stringify(settings)]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating EMA schedule', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Generate smart EMA prompts for a user based on time of day,
   * recent patterns, and mood trajectory.
   *
   * @param {number} userId
   * @returns {Array<Object>} list of prompt objects to deliver
   */
  static async generatePrompts(userId) {
    try {
      const schedule = await this.getSchedule(userId);
      const settings = typeof schedule.settings === 'string'
        ? JSON.parse(schedule.settings)
        : schedule.settings;

      // Determine how many prompts today (adaptive)
      let promptCount = settings.prompts_per_day || 3;

      if (settings.adaptive_enabled) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        const variability = await this.computeVariability(userId, dateStr);

        if (variability && variability.instability) {
          // Volatile mood — increase prompts (max 4)
          promptCount = Math.min(promptCount + 1, 4);
        } else if (variability && variability.std !== null && variability.std < 0.5) {
          // Very stable mood — reduce prompts (min 1)
          promptCount = Math.max(promptCount - 1, 1);
        }
      }

      // Generate prompt times evenly distributed in the user's window
      const startHour = settings.start_hour || 9;
      const endHour = settings.end_hour || 21;
      const windowMinutes = (endHour - startHour) * 60;
      const gap = Math.floor(windowMinutes / (promptCount + 1));

      // Get recent mood trajectory to tailor prompt wording
      const trajectory = await this._getMoodTrajectory(userId);

      const prompts = [];
      for (let i = 1; i <= promptCount; i++) {
        const minutesAfterStart = gap * i;
        const promptHour = startHour + Math.floor(minutesAfterStart / 60);
        const promptMinute = minutesAfterStart % 60;

        const prompt = {
          prompt_number: i,
          scheduled_hour: promptHour,
          scheduled_minute: promptMinute,
          prompt_text: this._buildPromptText(i, promptHour, trajectory),
          prompt_type: this._getPromptType(promptHour)
        };

        prompts.push(prompt);
      }

      // Save prompts to database
      for (const prompt of prompts) {
        const insertQuery = `
          INSERT INTO ema_prompts (
            user_id, prompt_text, prompt_type,
            scheduled_time, status, created_at
          ) VALUES (
            $1, $2, $3,
            (CURRENT_DATE + ($4 || ' hours')::INTERVAL + ($5 || ' minutes')::INTERVAL),
            'pending',
            NOW()
          )
          RETURNING id
        `;
        const result = await db.query(insertQuery, [
          userId,
          prompt.prompt_text,
          prompt.prompt_type,
          String(prompt.scheduled_hour),
          String(prompt.scheduled_minute)
        ]);
        prompt.id = result.rows[0].id;
      }

      logger.info('EMA prompts generated', { userId, count: prompts.length });
      return prompts;
    } catch (error) {
      logger.error('Error generating EMA prompts', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Record a user's response to an EMA prompt.
   *
   * @param {number} userId
   * @param {number} promptId
   * @param {Object} data - { mood_score, energy_score, note }
   * @returns {Object} the saved response
   */
  static async recordResponse(userId, promptId, data) {
    try {
      const { mood_score, energy_score, note } = data;

      if (mood_score == null || mood_score < 1 || mood_score > 5) {
        throw new Error('mood_score is required and must be between 1 and 5');
      }
      if (energy_score != null && (energy_score < 1 || energy_score > 5)) {
        throw new Error('energy_score must be between 1 and 5');
      }

      // Mark prompt as completed
      const updatePrompt = `
        UPDATE ema_prompts
        SET status = 'completed', responded_at = NOW()
        WHERE id = $1 AND user_id = $2
      `;
      await db.query(updatePrompt, [promptId, userId]);

      // Save the response
      const insertQuery = `
        INSERT INTO ema_responses (
          user_id, prompt_id, mood_score, energy_score,
          note, responded_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `;
      const result = await db.query(insertQuery, [
        userId, promptId, mood_score, energy_score || null, note || null
      ]);

      logger.info('EMA response recorded', { userId, promptId, mood_score });
      return result.rows[0];
    } catch (error) {
      logger.error('Error recording EMA response', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Compute mood variability for a user on a given date.
   * Returns mean, standard deviation, and an instability flag (std > 1.5).
   *
   * @param {number} userId
   * @param {string} date - ISO date string (YYYY-MM-DD)
   * @returns {Object|null} { mean, std, instability, response_count }
   */
  static async computeVariability(userId, date) {
    try {
      const query = `
        SELECT
          AVG(mood_score)    AS mean_mood,
          STDDEV(mood_score) AS std_mood,
          COUNT(*)           AS response_count
        FROM ema_responses
        WHERE user_id = $1
          AND responded_at::date = $2::date
      `;
      const result = await db.query(query, [userId, date]);
      const row = result.rows[0];

      if (!row || parseInt(row.response_count, 10) < 2) {
        return null; // Need at least 2 responses for variability
      }

      const mean = parseFloat(row.mean_mood);
      const std = parseFloat(row.std_mood) || 0;

      return {
        mean: Math.round(mean * 100) / 100,
        std: Math.round(std * 100) / 100,
        instability: std > 1.5,
        response_count: parseInt(row.response_count, 10)
      };
    } catch (error) {
      logger.error('Error computing EMA variability', { error: error.message, userId, date });
      return null;
    }
  }

  /**
   * Get all pending (unanswered) prompts for a user today.
   *
   * @param {number} userId
   * @returns {Array<Object>} pending prompts
   */
  static async getPendingPrompts(userId) {
    try {
      const query = `
        SELECT *
        FROM ema_prompts
        WHERE user_id = $1
          AND status = 'pending'
          AND scheduled_time::date = CURRENT_DATE
        ORDER BY scheduled_time ASC
      `;
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting pending EMA prompts', { error: error.message, userId });
      return [];
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────

  /**
   * Get the user's mood trajectory over the last 3 days.
   * @private
   */
  static async _getMoodTrajectory(userId) {
    try {
      const query = `
        SELECT
          entry_date,
          AVG(mood_score) AS avg_mood
        FROM mood_entries
        WHERE user_id = $1
          AND entry_date >= CURRENT_DATE - INTERVAL '3 days'
        GROUP BY entry_date
        ORDER BY entry_date ASC
      `;
      const result = await db.query(query, [userId]);
      const rows = result.rows;

      if (rows.length < 2) return 'unknown';

      const first = parseFloat(rows[0].avg_mood);
      const last = parseFloat(rows[rows.length - 1].avg_mood);
      const diff = last - first;

      if (diff > 0.5) return 'improving';
      if (diff < -0.5) return 'declining';
      return 'stable';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Build a contextual prompt message.
   * @private
   */
  static _buildPromptText(promptNumber, hour, trajectory) {
    // Time-of-day greeting
    let greeting;
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    // Trajectory-aware framing
    if (trajectory === 'declining') {
      const prompts = [
        `${greeting}! How are you holding up right now?`,
        `${greeting}. Take a moment — how are you feeling in this moment?`,
        `${greeting}. Checking in — what's your mood like right now?`
      ];
      return prompts[(promptNumber - 1) % prompts.length];
    }

    if (trajectory === 'improving') {
      const prompts = [
        `${greeting}! You've been on an upswing — how's the mood right now?`,
        `${greeting}. Things have been looking up! Where's your energy at?`,
        `${greeting}. Quick check — how are you feeling this moment?`
      ];
      return prompts[(promptNumber - 1) % prompts.length];
    }

    // Default / stable / unknown
    const prompts = [
      `${greeting}! How are you feeling right now?`,
      `${greeting}. Quick moment for yourself — what's your mood?`,
      `${greeting}. Let's check in — how are things going?`
    ];
    return prompts[(promptNumber - 1) % prompts.length];
  }

  /**
   * Determine prompt type based on time of day.
   * @private
   */
  static _getPromptType(hour) {
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }
}

module.exports = EmaService;

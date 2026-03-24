const db = require('../config/database');
const logger = require('../config/logger');

/**
 * Gamification Service - Handles streaks and achievements
 */
class GamificationService {
  /**
   * Update user streak when a mood entry is created
   */
  static async updateStreak(userId) {
    try {
      // Get user's check-in dates for streak calculation
      const datesQuery = `
        SELECT DISTINCT entry_date
        FROM mood_entries
        WHERE user_id = $1
        ORDER BY entry_date DESC
      `;
      const datesResult = await db.query(datesQuery, [userId]);
      const checkInDates = datesResult.rows.map(r => new Date(r.entry_date));

      if (checkInDates.length === 0) {
        return null;
      }

      // Calculate current streak
      let currentStreak = 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const lastCheckIn = new Date(checkInDates[0]);
      lastCheckIn.setHours(0, 0, 0, 0);

      // Check if last check-in was today or yesterday
      const daysSinceLastCheckIn = Math.floor((today - lastCheckIn) / (1000 * 60 * 60 * 24));

      if (daysSinceLastCheckIn > 1) {
        // Streak broken - reset to 1 if checked in today, 0 otherwise
        currentStreak = daysSinceLastCheckIn === 0 ? 1 : 0;
      } else {
        // Calculate consecutive days
        for (let i = 1; i < checkInDates.length; i++) {
          const currentDate = new Date(checkInDates[i - 1]);
          const prevDate = new Date(checkInDates[i]);
          currentDate.setHours(0, 0, 0, 0);
          prevDate.setHours(0, 0, 0, 0);

          const diffDays = Math.floor((currentDate - prevDate) / (1000 * 60 * 60 * 24));

          if (diffDays === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      const totalCheckIns = checkInDates.length;

      // Get existing streak record
      const existingQuery = `SELECT * FROM user_streaks WHERE user_id = $1`;
      const existingResult = await db.query(existingQuery, [userId]);

      let longestStreak = currentStreak;
      if (existingResult.rows.length > 0) {
        longestStreak = Math.max(existingResult.rows[0].longest_streak, currentStreak);
      }

      // Upsert streak record
      const upsertQuery = `
        INSERT INTO user_streaks (streak_id, user_id, current_streak, longest_streak, last_check_in_date, total_check_ins, updated_at)
        VALUES (uuid_generate_v4(), $1, $2, $3, CURRENT_DATE, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id)
        DO UPDATE SET
          current_streak = $2,
          longest_streak = GREATEST(user_streaks.longest_streak, $3),
          last_check_in_date = CURRENT_DATE,
          total_check_ins = $4,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const result = await db.query(upsertQuery, [userId, currentStreak, longestStreak, totalCheckIns]);

      logger.info('Streak updated', { userId, currentStreak, longestStreak, totalCheckIns });

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating streak', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get user's streak data
   */
  static async getStreak(userId) {
    try {
      const query = `
        SELECT * FROM user_streaks WHERE user_id = $1
      `;
      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        // Return default values if no streak exists
        return {
          current_streak: 0,
          longest_streak: 0,
          total_check_ins: 0,
          last_check_in_date: null
        };
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting streak', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check and award achievements based on user activity
   */
  static async checkAndAwardAchievements(userId) {
    try {
      const newlyEarned = [];

      // Get all achievements
      const achievementsQuery = `SELECT * FROM achievements WHERE is_active = true`;
      const achievementsResult = await db.query(achievementsQuery);
      const allAchievements = achievementsResult.rows;

      // Get user's already earned achievements
      const earnedQuery = `
        SELECT achievement_id FROM user_achievements WHERE user_id = $1
      `;
      const earnedResult = await db.query(earnedQuery, [userId]);
      const earnedIds = new Set(earnedResult.rows.map(r => r.achievement_id));

      // Get user stats for checking achievements
      const stats = await this.getUserStats(userId);

      for (const achievement of allAchievements) {
        // Skip if already earned
        if (earnedIds.has(achievement.achievement_id)) continue;

        let earned = false;

        // Check based on requirement type
        switch (achievement.requirement_type) {
          case 'total_check_ins':
            earned = stats.totalCheckIns >= achievement.requirement_value;
            break;
          case 'streak_days':
            earned = stats.currentStreak >= achievement.requirement_value ||
                     stats.longestStreak >= achievement.requirement_value;
            break;
          case 'chat_sessions':
            earned = stats.chatSessions >= achievement.requirement_value;
            break;
          case 'breathing_exercises':
            earned = stats.breathingExercises >= achievement.requirement_value;
            break;
          case 'grounding_exercises':
            earned = stats.groundingExercises >= achievement.requirement_value;
            break;
          case 'journal_entries':
            earned = stats.journalEntries >= achievement.requirement_value;
            break;
          case 'recommendations_completed':
            earned = stats.recommendationsCompleted >= achievement.requirement_value;
            break;
          case 'insights_viewed':
            earned = stats.insightsViewed >= achievement.requirement_value;
            break;
          case 'night_checkin':
            earned = stats.hasNightCheckin;
            break;
          case 'early_checkin':
            earned = stats.hasEarlyCheckin;
            break;
          case 'mood_improvement':
            earned = stats.moodImprovement >= achievement.requirement_value;
            break;
        }

        if (earned) {
          // Award the achievement
          const awardQuery = `
            INSERT INTO user_achievements (user_achievement_id, user_id, achievement_id, earned_at)
            VALUES (uuid_generate_v4(), $1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, achievement_id) DO NOTHING
            RETURNING *
          `;
          const awardResult = await db.query(awardQuery, [userId, achievement.achievement_id]);

          if (awardResult.rows.length > 0) {
            newlyEarned.push({
              ...achievement,
              earned_at: awardResult.rows[0].earned_at
            });
            logger.info('Achievement earned', { userId, achievementCode: achievement.achievement_code });
          }
        }
      }

      return newlyEarned;
    } catch (error) {
      logger.error('Error checking achievements', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get user stats for achievement checking
   */
  static async getUserStats(userId) {
    try {
      // Get streak data
      const streak = await this.getStreak(userId);

      // Get chat sessions count
      const chatQuery = `
        SELECT COUNT(DISTINCT conversation_id) as count
        FROM chatbot_conversations
        WHERE user_id = $1
      `;
      const chatResult = await db.query(chatQuery, [userId]);

      // Get completed recommendations count
      const recsQuery = `
        SELECT COUNT(*) as count
        FROM recommendations
        WHERE user_id = $1 AND is_completed = true
      `;
      const recsResult = await db.query(recsQuery, [userId]);

      // Get insights viewed count
      const insightsQuery = `
        SELECT COUNT(*) as count
        FROM user_insights
        WHERE user_id = $1 AND is_read = true
      `;
      const insightsResult = await db.query(insightsQuery, [userId]);

      // Check for night/early check-ins
      const timeQuery = `
        SELECT
          EXISTS(SELECT 1 FROM mood_entries WHERE user_id = $1 AND entry_time >= '00:00:00' AND entry_time < '05:00:00') as has_night,
          EXISTS(SELECT 1 FROM mood_entries WHERE user_id = $1 AND entry_time >= '05:00:00' AND entry_time < '07:00:00') as has_early
      `;
      const timeResult = await db.query(timeQuery, [userId]);

      // Calculate mood improvement (compare first week to most recent week)
      const moodImprovementQuery = `
        WITH first_week AS (
          SELECT AVG(mood_score) as avg_mood
          FROM mood_entries
          WHERE user_id = $1
          ORDER BY entry_date ASC
          LIMIT 7
        ),
        last_week AS (
          SELECT AVG(mood_score) as avg_mood
          FROM mood_entries
          WHERE user_id = $1
          ORDER BY entry_date DESC
          LIMIT 7
        )
        SELECT
          COALESCE((SELECT avg_mood FROM last_week), 0) - COALESCE((SELECT avg_mood FROM first_week), 0) as improvement
      `;
      const moodResult = await db.query(moodImprovementQuery, [userId]);

      // Count entries with notes (journal entries)
      const journalQuery = `
        SELECT COUNT(*) as count
        FROM mood_entries
        WHERE user_id = $1 AND notes IS NOT NULL AND notes != ''
      `;
      const journalResult = await db.query(journalQuery, [userId]);

      // Count chatbot messages with breathing/grounding exercises
      const exercisesQuery = `
        SELECT
          COUNT(CASE WHEN message_type = 'breathing_exercise' THEN 1 END) as breathing,
          COUNT(CASE WHEN message_type = 'grounding' THEN 1 END) as grounding
        FROM chatbot_messages
        WHERE user_id = $1 AND sender = 'luna'
      `;
      const exercisesResult = await db.query(exercisesQuery, [userId]);

      return {
        totalCheckIns: streak.total_check_ins || 0,
        currentStreak: streak.current_streak || 0,
        longestStreak: streak.longest_streak || 0,
        chatSessions: parseInt(chatResult.rows[0]?.count || 0),
        recommendationsCompleted: parseInt(recsResult.rows[0]?.count || 0),
        insightsViewed: parseInt(insightsResult.rows[0]?.count || 0),
        hasNightCheckin: timeResult.rows[0]?.has_night || false,
        hasEarlyCheckin: timeResult.rows[0]?.has_early || false,
        moodImprovement: parseFloat(moodResult.rows[0]?.improvement || 0),
        journalEntries: parseInt(journalResult.rows[0]?.count || 0),
        breathingExercises: parseInt(exercisesResult.rows[0]?.breathing || 0),
        groundingExercises: parseInt(exercisesResult.rows[0]?.grounding || 0)
      };
    } catch (error) {
      logger.error('Error getting user stats', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get all achievements with user's earned status
   */
  static async getAchievements(userId) {
    try {
      const query = `
        SELECT
          a.*,
          ua.earned_at,
          ua.is_notified,
          CASE WHEN ua.user_id IS NOT NULL THEN true ELSE false END as is_earned
        FROM achievements a
        LEFT JOIN user_achievements ua ON a.achievement_id = ua.achievement_id AND ua.user_id = $1
        WHERE a.is_active = true
        ORDER BY a.category, a.requirement_value
      `;
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting achievements', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get user's earned achievements
   */
  static async getUserAchievements(userId) {
    try {
      const query = `
        SELECT
          a.*,
          ua.earned_at,
          ua.is_notified
        FROM user_achievements ua
        JOIN achievements a ON ua.achievement_id = a.achievement_id
        WHERE ua.user_id = $1
        ORDER BY ua.earned_at DESC
      `;
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting user achievements', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Mark achievements as notified
   */
  static async markAchievementsNotified(userId, achievementIds) {
    try {
      const query = `
        UPDATE user_achievements
        SET is_notified = true
        WHERE user_id = $1 AND achievement_id = ANY($2)
      `;
      await db.query(query, [userId, achievementIds]);
    } catch (error) {
      logger.error('Error marking achievements notified', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Use a streak freeze (if available)
   */
  static async useStreakFreeze(userId) {
    try {
      // Check if user has freeze available
      const checkQuery = `
        SELECT streak_freezes_available
        FROM user_streaks
        WHERE user_id = $1
      `;
      const checkResult = await db.query(checkQuery, [userId]);

      if (checkResult.rows.length === 0 || checkResult.rows[0].streak_freezes_available < 1) {
        return { success: false, message: 'No streak freezes available' };
      }

      // Use the freeze
      const useQuery = `
        UPDATE user_streaks
        SET
          streak_freezes_available = streak_freezes_available - 1,
          last_check_in_date = CURRENT_DATE,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `;
      const result = await db.query(useQuery, [userId]);

      logger.info('Streak freeze used', { userId });
      return { success: true, streak: result.rows[0] };
    } catch (error) {
      logger.error('Error using streak freeze', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Award streak freeze (e.g., weekly reward)
   */
  static async awardStreakFreeze(userId, count = 1) {
    try {
      const query = `
        UPDATE user_streaks
        SET
          streak_freezes_available = LEAST(streak_freezes_available + $2, 3),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
        RETURNING *
      `;
      const result = await db.query(query, [userId, count]);

      if (result.rows.length === 0) {
        // Create streak record if doesn't exist
        const insertQuery = `
          INSERT INTO user_streaks (streak_id, user_id, streak_freezes_available)
          VALUES (uuid_generate_v4(), $1, $2)
          RETURNING *
        `;
        const insertResult = await db.query(insertQuery, [userId, count]);
        return insertResult.rows[0];
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error awarding streak freeze', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = GamificationService;

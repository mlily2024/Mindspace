/**
 * Enhanced Feedback Service
 * Generates personalized feedback after mood check-ins
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { format, subDays } = require('date-fns');

class FeedbackService {
  /**
   * Generate personalized feedback after a mood check-in
   */
  static async generatePostCheckInFeedback(userId, moodEntry) {
    try {
      // Get comparison data
      const comparison = await this.getComparison(userId, moodEntry);

      // Get contextual message based on mood level
      const contextualMessage = this.getContextualMessage(moodEntry, comparison);

      // Generate immediate suggestions
      const suggestions = this.generateImmediateSuggestions(moodEntry, comparison);

      // Check for micro-insight opportunities
      const microInsight = await this.getMicroInsight(userId, moodEntry, comparison);

      // Determine if an intervention should be offered
      const shouldOfferIntervention = this.shouldOfferIntervention(moodEntry, comparison);

      // Get streak info if available
      const streakInfo = await this.getStreakInfo(userId);

      return {
        message: contextualMessage,
        comparison,
        suggestions,
        microInsight,
        shouldOfferIntervention,
        interventionType: shouldOfferIntervention ? this.getRecommendedInterventionType(moodEntry) : null,
        streakInfo,
        encouragement: this.getEncouragement(moodEntry, comparison, streakInfo)
      };
    } catch (error) {
      logger.error('Error generating post check-in feedback', { error: error.message, userId });
      // Return basic feedback on error
      return {
        message: this.getBasicMessage(moodEntry),
        comparison: null,
        suggestions: [],
        microInsight: null,
        shouldOfferIntervention: false
      };
    }
  }

  /**
   * Get contextual message based on mood/energy/stress levels
   */
  static getContextualMessage(moodEntry, comparison) {
    const mood = parseInt(moodEntry.mood_score);
    const energy = parseInt(moodEntry.energy_level) || 5;
    const stress = parseInt(moodEntry.stress_level) || 5;

    // Determine the primary message based on mood
    let emoji, title, message, tone;

    if (mood >= 8) {
      emoji = '🌟';
      title = 'Wonderful!';
      tone = 'celebratory';
      message = this.getHighMoodMessage(mood, energy, comparison);
    } else if (mood >= 6) {
      emoji = '💜';
      title = 'Good check-in!';
      tone = 'positive';
      message = this.getModerateMoodMessage(mood, energy, stress, comparison);
    } else if (mood >= 4) {
      emoji = '🌱';
      title = 'Thanks for checking in';
      tone = 'supportive';
      message = this.getNeutralMoodMessage(mood, energy, stress, comparison);
    } else {
      emoji = '💚';
      title = "We're here for you";
      tone = 'compassionate';
      message = this.getLowMoodMessage(mood, energy, stress, comparison);
    }

    return {
      emoji,
      title,
      message,
      tone,
      color: this.getToneColor(tone)
    };
  }

  static getHighMoodMessage(mood, energy, comparison) {
    const messages = [
      "You're doing wonderfully! Take a moment to notice what contributed to this feeling.",
      "This is great! Capturing good moments helps you recognize what works for you.",
      "Excellent! Your positive energy is worth celebrating.",
      "Wonderful check-in! Remember this feeling for when times are tougher."
    ];

    let message = messages[Math.floor(Math.random() * messages.length)];

    if (comparison?.vsYesterday > 2) {
      message += " That's a significant improvement from yesterday!";
    }

    if (energy >= 8) {
      message += " Your energy is high too - a great combination!";
    }

    return message;
  }

  static getModerateMoodMessage(mood, energy, stress, comparison) {
    let message = "You're doing well. ";

    if (comparison?.vsYesterday > 0) {
      message += "Things are looking up from yesterday. ";
    } else if (comparison?.vsYesterday < -1) {
      message += "Even if today feels a bit lower, that's completely normal. ";
    }

    if (stress > 6) {
      message += "I notice your stress is elevated - be gentle with yourself.";
    } else if (energy < 5) {
      message += "Your energy seems a bit low - rest when you can.";
    } else {
      message += "Keep doing what you're doing!";
    }

    return message;
  }

  static getNeutralMoodMessage(mood, energy, stress, comparison) {
    let message = "'Okay' is a perfectly valid place to be. ";

    if (comparison?.vsAverage < -1) {
      message += "This is below your usual average, which might be worth noting. ";
    }

    if (stress > 7) {
      message += "High stress can make everything feel harder. Consider a brief breathing break.";
    } else if (energy < 4) {
      message += "Low energy might be affecting how you feel. Rest is important.";
    } else {
      message += "Small steps can make a difference. What's one kind thing you could do for yourself?";
    }

    return message;
  }

  static getLowMoodMessage(mood, energy, stress, comparison) {
    const messages = [
      "Thank you for being honest about how you're feeling. That takes courage.",
      "Difficult feelings are valid. You don't have to face them alone.",
      "It's okay to not be okay. Checking in is already a positive step.",
      "We see you're going through a tough time. This feeling won't last forever."
    ];

    let message = messages[Math.floor(Math.random() * messages.length)];

    if (stress > 8) {
      message += " Your stress is very high right now - please consider reaching out for support.";
    }

    if (comparison?.vsYesterday < -2) {
      message += " This is a significant drop from yesterday. Would you like to talk to Luna?";
    }

    return message;
  }

  static getToneColor(tone) {
    const colors = {
      celebratory: 'var(--success-color)',
      positive: 'var(--primary-color)',
      supportive: 'var(--accent-color)',
      compassionate: 'var(--secondary-color)'
    };
    return colors[tone] || 'var(--primary-color)';
  }

  /**
   * Get comparison to yesterday and recent average
   */
  static async getComparison(userId, moodEntry) {
    try {
      // Get yesterday's entry
      const yesterdayQuery = `
        SELECT mood_score, energy_level, stress_level
        FROM mood_entries
        WHERE user_id = $1
          AND entry_date = CURRENT_DATE - INTERVAL '1 day'
        ORDER BY entry_time DESC
        LIMIT 1
      `;
      const yesterdayResult = await db.query(yesterdayQuery, [userId]);

      // Get 7-day average
      const avgQuery = `
        SELECT
          AVG(mood_score) as avg_mood,
          AVG(energy_level) as avg_energy,
          AVG(stress_level) as avg_stress,
          COUNT(*) as entry_count
        FROM mood_entries
        WHERE user_id = $1
          AND entry_date >= CURRENT_DATE - INTERVAL '7 days'
          AND entry_date < CURRENT_DATE
      `;
      const avgResult = await db.query(avgQuery, [userId]);

      const currentMood = parseFloat(moodEntry.mood_score);
      const stats = avgResult.rows[0];

      let comparison = {
        hasData: false,
        vsYesterday: null,
        vsAverage: null,
        yesterdayMood: null,
        weeklyAverage: null,
        trend: 'stable'
      };

      if (yesterdayResult.rows.length > 0) {
        const yesterdayMood = parseFloat(yesterdayResult.rows[0].mood_score);
        comparison.yesterdayMood = yesterdayMood;
        comparison.vsYesterday = parseFloat((currentMood - yesterdayMood).toFixed(1));
        comparison.hasData = true;
      }

      if (stats.entry_count >= 3) {
        const avgMood = parseFloat(stats.avg_mood);
        comparison.weeklyAverage = parseFloat(avgMood.toFixed(1));
        comparison.vsAverage = parseFloat((currentMood - avgMood).toFixed(1));
        comparison.hasData = true;

        // Determine trend
        if (comparison.vsAverage > 0.5) {
          comparison.trend = 'improving';
        } else if (comparison.vsAverage < -0.5) {
          comparison.trend = 'declining';
        }
      }

      return comparison;
    } catch (error) {
      logger.error('Error getting comparison data', { error: error.message, userId });
      return { hasData: false };
    }
  }

  /**
   * Generate immediate action suggestions
   */
  static generateImmediateSuggestions(moodEntry, comparison) {
    const suggestions = [];
    const mood = parseInt(moodEntry.mood_score);
    const energy = parseInt(moodEntry.energy_level) || 5;
    const stress = parseInt(moodEntry.stress_level) || 5;

    // High stress suggestions
    if (stress >= 7) {
      suggestions.push({
        icon: '🌬️',
        text: 'Try a breathing exercise',
        action: 'breathing',
        priority: 1
      });
    }

    // Low energy suggestions
    if (energy <= 4) {
      suggestions.push({
        icon: '🚶',
        text: 'Take a short walk',
        action: 'movement',
        priority: 2
      });
      suggestions.push({
        icon: '💧',
        text: 'Drink some water',
        action: 'hydration',
        priority: 3
      });
    }

    // Low mood suggestions
    if (mood <= 4) {
      suggestions.push({
        icon: '🌙',
        text: 'Chat with Luna',
        action: 'chat',
        priority: 1
      });
      suggestions.push({
        icon: '🎵',
        text: 'Listen to uplifting music',
        action: 'music',
        priority: 2
      });
    }

    // Good mood suggestions
    if (mood >= 7) {
      suggestions.push({
        icon: '📝',
        text: "Note what's working",
        action: 'journal',
        priority: 2
      });
      suggestions.push({
        icon: '🙏',
        text: 'Capture a gratitude',
        action: 'gratitude',
        priority: 3
      });
    }

    // Neutral mood - engagement suggestions
    if (mood >= 4 && mood <= 6) {
      suggestions.push({
        icon: '🎯',
        text: 'Set a small intention',
        action: 'intention',
        priority: 2
      });
    }

    // Sort by priority and return top 3
    return suggestions
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3);
  }

  /**
   * Generate micro-insight from the check-in
   */
  static async getMicroInsight(userId, moodEntry, comparison) {
    // Check for patterns worth highlighting
    const insights = [];

    // Significant improvement
    if (comparison?.vsYesterday >= 2) {
      insights.push({
        type: 'improvement',
        icon: '📈',
        text: `Your mood jumped ${comparison.vsYesterday} points from yesterday!`,
        detail: 'What contributed to this improvement?'
      });
    }

    // Significant decline
    if (comparison?.vsYesterday <= -2) {
      insights.push({
        type: 'decline',
        icon: '📉',
        text: `Your mood dropped ${Math.abs(comparison.vsYesterday)} points from yesterday.`,
        detail: "It's okay - let's focus on small steps forward."
      });
    }

    // Above average
    if (comparison?.vsAverage >= 1.5) {
      insights.push({
        type: 'above_average',
        icon: '⭐',
        text: "You're feeling better than your recent average!",
        detail: 'Take note of what might be helping.'
      });
    }

    // Check for sleep-mood connection
    const sleepHours = parseFloat(moodEntry.sleep_hours);
    const mood = parseInt(moodEntry.mood_score);
    if (sleepHours && sleepHours < 6 && mood < 5) {
      insights.push({
        type: 'sleep_connection',
        icon: '😴',
        text: `You logged ${sleepHours} hours of sleep and lower mood.`,
        detail: 'Sleep often affects how we feel. Tonight, try to prioritize rest.'
      });
    }

    // Stress-mood connection
    const stress = parseInt(moodEntry.stress_level);
    if (stress >= 8 && mood <= 4) {
      insights.push({
        type: 'stress_connection',
        icon: '😰',
        text: 'High stress seems to be impacting your mood today.',
        detail: 'A breathing exercise might help release some tension.'
      });
    }

    // Return the most relevant insight
    return insights.length > 0 ? insights[0] : null;
  }

  /**
   * Determine if an intervention should be offered
   */
  static shouldOfferIntervention(moodEntry, comparison) {
    const mood = parseInt(moodEntry.mood_score);
    const stress = parseInt(moodEntry.stress_level) || 5;
    const anxiety = parseInt(moodEntry.anxiety_level) || 5;

    // Offer intervention for:
    // - Low mood (< 4)
    // - High stress (> 7)
    // - High anxiety (> 7)
    // - Significant decline from yesterday
    if (mood <= 4) return true;
    if (stress >= 8) return true;
    if (anxiety >= 8) return true;
    if (comparison?.vsYesterday <= -3) return true;

    // Don't spam interventions for neutral/good moods
    // But occasionally offer engagement interventions (10% chance)
    if (mood >= 5 && mood <= 6 && Math.random() < 0.1) return true;

    return false;
  }

  /**
   * Get recommended intervention type based on mood entry
   */
  static getRecommendedInterventionType(moodEntry) {
    const mood = parseInt(moodEntry.mood_score);
    const stress = parseInt(moodEntry.stress_level) || 5;
    const anxiety = parseInt(moodEntry.anxiety_level) || 5;
    const energy = parseInt(moodEntry.energy_level) || 5;

    if (anxiety >= 8) return 'grounding';
    if (stress >= 8) return 'breathing';
    if (mood <= 3) return 'breathing';
    if (energy <= 3) return 'rest';
    if (mood >= 5 && mood <= 6) return 'gratitude';

    return 'breathing'; // Default
  }

  /**
   * Get streak information
   */
  static async getStreakInfo(userId) {
    try {
      const query = `
        SELECT current_streak, longest_streak, total_check_ins
        FROM user_streaks
        WHERE user_id = $1
      `;
      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        return { currentStreak: 1, isNewRecord: false };
      }

      const streak = result.rows[0];
      return {
        currentStreak: streak.current_streak,
        longestStreak: streak.longest_streak,
        totalCheckIns: streak.total_check_ins,
        isNewRecord: streak.current_streak === streak.longest_streak && streak.current_streak > 1
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get encouragement message
   */
  static getEncouragement(moodEntry, comparison, streakInfo) {
    const encouragements = [];

    // Streak-based encouragement
    if (streakInfo?.isNewRecord) {
      encouragements.push(`🎉 New streak record: ${streakInfo.currentStreak} days!`);
    } else if (streakInfo?.currentStreak >= 7) {
      encouragements.push(`🔥 Amazing ${streakInfo.currentStreak}-day streak!`);
    } else if (streakInfo?.currentStreak >= 3) {
      encouragements.push(`✨ ${streakInfo.currentStreak} days in a row - keep it up!`);
    }

    // Trend-based encouragement
    if (comparison?.trend === 'improving') {
      encouragements.push("📈 Your mood has been improving lately!");
    }

    // Milestone encouragement
    if (streakInfo?.totalCheckIns === 10) {
      encouragements.push("🌟 10 check-ins! You're building a great habit.");
    } else if (streakInfo?.totalCheckIns === 50) {
      encouragements.push("💫 50 check-ins! You're a dedicated tracker.");
    } else if (streakInfo?.totalCheckIns === 100) {
      encouragements.push("🏆 100 check-ins! Incredible commitment to self-awareness.");
    }

    return encouragements.length > 0 ? encouragements[0] : null;
  }

  /**
   * Get basic fallback message
   */
  static getBasicMessage(moodEntry) {
    const mood = parseInt(moodEntry.mood_score);
    let emoji, title, message;

    if (mood >= 7) {
      emoji = '🎉';
      title = 'Great!';
      message = "Wonderful to hear you're doing well!";
    } else if (mood >= 5) {
      emoji = '💜';
      title = 'Check-in saved';
      message = 'Thanks for taking a moment to reflect.';
    } else {
      emoji = '💚';
      title = 'We hear you';
      message = "It's okay to have difficult days. We're here for you.";
    }

    return { emoji, title, message, tone: 'neutral', color: 'var(--primary-color)' };
  }
}

module.exports = FeedbackService;

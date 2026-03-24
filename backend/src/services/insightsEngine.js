const MoodEntry = require('../models/MoodEntry');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { subDays, format, getDay, getHours } = require('date-fns');

/**
 * Insights Engine - Analyzes mood data and generates insights
 * Enhanced with pattern recognition, correlations, and personalized recommendations
 */
class InsightsEngine {
  /**
   * Generate insights for a user
   */
  static async generateInsights(userId) {
    const insights = [];

    // Get recent mood data (last 30 days)
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');

    const statistics = await MoodEntry.getStatistics(userId, { startDate, endDate });
    const trends = await MoodEntry.getTrends(userId, { startDate, endDate, groupBy: 'week' });

    // Check for declining mood trend
    const declineInsight = this.detectMoodDecline(trends);
    if (declineInsight) {
      insights.push(await this.saveInsight(userId, declineInsight));
    }

    // Check for improvement
    const improvementInsight = this.detectMoodImprovement(trends);
    if (improvementInsight) {
      insights.push(await this.saveInsight(userId, improvementInsight));
    }

    // Check for high stress patterns
    if (statistics.avg_stress >= 7) {
      insights.push(await this.saveInsight(userId, {
        type: 'pattern',
        period: 'monthly',
        data: {
          title: 'High Stress Pattern Detected',
          description: `Your average stress level has been ${statistics.avg_stress.toFixed(1)}/10 over the past 30 days. Consider stress management techniques.`,
          metric: 'stress',
          value: statistics.avg_stress
        },
        severity: 'high'
      }));
    }

    // Check for sleep issues
    if (statistics.avg_sleep_hours < 6) {
      insights.push(await this.saveInsight(userId, {
        type: 'pattern',
        period: 'monthly',
        data: {
          title: 'Insufficient Sleep Pattern',
          description: `You're averaging ${statistics.avg_sleep_hours.toFixed(1)} hours of sleep per night. Aim for 7-9 hours for better wellbeing.`,
          metric: 'sleep',
          value: statistics.avg_sleep_hours
        },
        severity: 'moderate'
      }));
    }

    // Check for low social interaction
    if (statistics.avg_social < 5) {
      insights.push(await this.saveInsight(userId, {
        type: 'recommendation',
        period: 'monthly',
        data: {
          title: 'Consider Increasing Social Connection',
          description: 'Your social interaction quality has been low. Social connections are important for mental wellbeing.',
          metric: 'social',
          value: statistics.avg_social
        },
        severity: 'moderate'
      }));
    }

    return insights;
  }

  /**
   * Detect mood decline trend
   */
  static detectMoodDecline(trends) {
    if (trends.length < 2) return null;

    // Compare last 2 weeks with previous 2 weeks
    const recent = trends.slice(0, 2);
    const previous = trends.slice(2, 4);

    if (previous.length === 0) return null;

    const recentAvg = recent.reduce((sum, t) => sum + parseFloat(t.avg_mood), 0) / recent.length;
    const previousAvg = previous.reduce((sum, t) => sum + parseFloat(t.avg_mood), 0) / previous.length;

    const decline = previousAvg - recentAvg;

    if (decline >= 2) {
      return {
        type: 'trend',
        period: 'weekly',
        data: {
          title: 'Declining Mood Trend',
          description: `Your mood has decreased by ${decline.toFixed(1)} points over the past 2 weeks. Consider reaching out for support.`,
          metric: 'mood',
          previousValue: previousAvg,
          currentValue: recentAvg,
          change: -decline
        },
        severity: decline >= 3 ? 'high' : 'moderate'
      };
    }

    return null;
  }

  /**
   * Detect mood improvement trend
   */
  static detectMoodImprovement(trends) {
    if (trends.length < 2) return null;

    const recent = trends.slice(0, 2);
    const previous = trends.slice(2, 4);

    if (previous.length === 0) return null;

    const recentAvg = recent.reduce((sum, t) => sum + parseFloat(t.avg_mood), 0) / recent.length;
    const previousAvg = previous.reduce((sum, t) => sum + parseFloat(t.avg_mood), 0) / previous.length;

    const improvement = recentAvg - previousAvg;

    if (improvement >= 1.5) {
      return {
        type: 'improvement',
        period: 'weekly',
        data: {
          title: 'Positive Mood Trend',
          description: `Great news! Your mood has improved by ${improvement.toFixed(1)} points over the past 2 weeks. Keep up the good work!`,
          metric: 'mood',
          previousValue: previousAvg,
          currentValue: recentAvg,
          change: improvement
        },
        severity: 'low'
      };
    }

    return null;
  }

  /**
   * Save insight to database
   */
  static async saveInsight(userId, insightData) {
    const insightId = uuidv4();

    const query = `
      INSERT INTO user_insights (
        insight_id, user_id, insight_type, insight_period, insight_data, severity
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      insightId,
      userId,
      insightData.type,
      insightData.period,
      JSON.stringify(insightData.data),
      insightData.severity
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get user insights
   */
  static async getUserInsights(userId, { limit = 10, unreadOnly = false }) {
    let query = `
      SELECT * FROM user_insights
      WHERE user_id = $1
    `;

    const values = [userId];

    if (unreadOnly) {
      query += ' AND is_read = false';
    }

    query += ' ORDER BY generated_at DESC LIMIT $2';
    values.push(limit);

    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Mark insight as read
   */
  static async markAsRead(insightId, userId) {
    const query = `
      UPDATE user_insights
      SET is_read = true
      WHERE insight_id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [insightId, userId]);
    return result.rows[0];
  }

  /**
   * Detect risk and create safety alert
   */
  static async detectRisk(userId, moodEntry) {
    const alerts = [];

    // Critical mood score
    if (moodEntry.mood_score <= 3 && moodEntry.stress_level >= 8) {
      alerts.push(await this.createSafetyAlert(userId, {
        type: 'crisis_indicator',
        severity: 'critical',
        data: {
          moodScore: moodEntry.mood_score,
          stressLevel: moodEntry.stress_level,
          message: 'We noticed you might be experiencing significant distress. Please consider reaching out to a mental health professional or crisis helpline.'
        }
      }));
    }

    // High stress for extended period
    const recentEntries = await MoodEntry.getUserEntries(userId, {
      startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd')
    });

    const highStressCount = recentEntries.filter(e => e.stress_level >= 8).length;

    if (highStressCount >= 5) {
      alerts.push(await this.createSafetyAlert(userId, {
        type: 'prolonged_distress',
        severity: 'high',
        data: {
          daysWithHighStress: highStressCount,
          message: 'You\'ve reported high stress levels for several days. Consider self-care activities or professional support.'
        }
      }));
    }

    return alerts;
  }

  /**
   * Create safety alert
   */
  static async createSafetyAlert(userId, alertData) {
    const alertId = uuidv4();

    const query = `
      INSERT INTO safety_alerts (
        alert_id, user_id, alert_type, severity, alert_data
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      alertId,
      userId,
      alertData.type,
      alertData.severity,
      JSON.stringify(alertData.data)
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get user safety alerts
   */
  static async getSafetyAlerts(userId, { limit = 10, unacknowledgedOnly = false }) {
    let query = `
      SELECT * FROM safety_alerts
      WHERE user_id = $1
    `;

    const values = [userId];

    if (unacknowledgedOnly) {
      query += ' AND is_acknowledged = false';
    }

    query += ' ORDER BY triggered_at DESC LIMIT $2';
    values.push(limit);

    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Acknowledge safety alert
   */
  static async acknowledgeSafetyAlert(alertId, userId, actionTaken = null) {
    const query = `
      UPDATE safety_alerts
      SET is_acknowledged = true,
          acknowledged_at = CURRENT_TIMESTAMP,
          action_taken = $3
      WHERE alert_id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [alertId, userId, actionTaken]);
    return result.rows[0];
  }

  /**
   * Get comprehensive pattern analysis for dashboard
   */
  static async getPatternAnalysis(userId, days = 30) {
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

    const entries = await MoodEntry.getUserEntries(userId, { startDate, endDate });

    if (entries.length < 7) {
      return {
        status: 'insufficient_data',
        message: 'Keep logging for a few more days to unlock insights!',
        entriesNeeded: 7 - entries.length
      };
    }

    return {
      status: 'ready',
      patterns: this.analysePatterns(entries),
      correlations: this.findCorrelations(entries),
      trends: this.calculateTrends(entries),
      recommendations: this.generateRecommendations(entries)
    };
  }

  /**
   * Analyse day of week and time of day patterns
   */
  static analysePatterns(entries) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Day of week analysis
    const dayScores = {};
    entries.forEach(entry => {
      const day = dayNames[getDay(new Date(entry.created_at))];
      if (!dayScores[day]) dayScores[day] = [];
      dayScores[day].push(parseFloat(entry.mood_score));
    });

    const dayAverages = Object.entries(dayScores)
      .map(([day, scores]) => ({
        day,
        average: scores.reduce((a, b) => a + b, 0) / scores.length,
        count: scores.length
      }))
      .sort((a, b) => b.average - a.average);

    // Time of day analysis
    const timeScores = { morning: [], afternoon: [], evening: [], night: [] };
    entries.forEach(entry => {
      const hour = getHours(new Date(entry.created_at));
      if (hour >= 5 && hour < 12) timeScores.morning.push(parseFloat(entry.mood_score));
      else if (hour >= 12 && hour < 17) timeScores.afternoon.push(parseFloat(entry.mood_score));
      else if (hour >= 17 && hour < 21) timeScores.evening.push(parseFloat(entry.mood_score));
      else timeScores.night.push(parseFloat(entry.mood_score));
    });

    const timeAverages = Object.entries(timeScores)
      .filter(([_, scores]) => scores.length > 0)
      .map(([time, scores]) => ({
        time,
        average: scores.reduce((a, b) => a + b, 0) / scores.length,
        count: scores.length
      }))
      .sort((a, b) => b.average - a.average);

    // Calculate overall stats
    const moodScores = entries.map(e => parseFloat(e.mood_score));
    const overallAvg = moodScores.reduce((a, b) => a + b, 0) / moodScores.length;

    return {
      bestDay: dayAverages[0] || null,
      challengingDay: dayAverages[dayAverages.length - 1] || null,
      allDays: dayAverages,
      bestTime: timeAverages[0] || null,
      timeOfDayPattern: timeAverages,
      overallAverage: overallAvg,
      totalEntries: entries.length
    };
  }

  /**
   * Find correlations between factors and mood
   */
  static findCorrelations(entries) {
    const correlations = [];
    const overallAvg = entries.reduce((a, e) => a + parseFloat(e.mood_score), 0) / entries.length;

    // Sleep correlation
    const sleepEntries = entries.filter(e => e.sleep_hours);
    if (sleepEntries.length >= 5) {
      const correlation = this.calculateCorrelation(
        sleepEntries.map(e => parseFloat(e.sleep_hours)),
        sleepEntries.map(e => parseFloat(e.mood_score))
      );
      if (Math.abs(correlation) > 0.2) {
        correlations.push({
          factor: 'Sleep Duration',
          emoji: '😴',
          correlation: correlation,
          strength: Math.abs(correlation) > 0.5 ? 'strong' : 'moderate',
          insight: correlation > 0
            ? 'More sleep tends to improve your mood'
            : 'Your mood and sleep have an unusual relationship'
        });
      }
    }

    // Sleep quality correlation
    const qualityEntries = entries.filter(e => e.sleep_quality);
    if (qualityEntries.length >= 5) {
      const correlation = this.calculateCorrelation(
        qualityEntries.map(e => parseFloat(e.sleep_quality)),
        qualityEntries.map(e => parseFloat(e.mood_score))
      );
      if (Math.abs(correlation) > 0.2) {
        correlations.push({
          factor: 'Sleep Quality',
          emoji: '🌙',
          correlation: correlation,
          strength: Math.abs(correlation) > 0.5 ? 'strong' : 'moderate',
          insight: correlation > 0
            ? 'Better sleep quality boosts your mood'
            : 'Sleep quality has a complex effect on your mood'
        });
      }
    }

    // Stress inverse correlation
    const stressEntries = entries.filter(e => e.stress_level);
    if (stressEntries.length >= 5) {
      const correlation = this.calculateCorrelation(
        stressEntries.map(e => parseFloat(e.stress_level)),
        stressEntries.map(e => parseFloat(e.mood_score))
      );
      if (Math.abs(correlation) > 0.2) {
        correlations.push({
          factor: 'Stress Level',
          emoji: '😰',
          correlation: correlation,
          strength: Math.abs(correlation) > 0.5 ? 'strong' : 'moderate',
          insight: correlation < 0
            ? 'Lower stress significantly improves your mood'
            : 'Your stress response is unique - managing it helps'
        });
      }
    }

    // Energy correlation
    const energyEntries = entries.filter(e => e.energy_level);
    if (energyEntries.length >= 5) {
      const correlation = this.calculateCorrelation(
        energyEntries.map(e => parseFloat(e.energy_level)),
        energyEntries.map(e => parseFloat(e.mood_score))
      );
      if (Math.abs(correlation) > 0.2) {
        correlations.push({
          factor: 'Energy Level',
          emoji: '⚡',
          correlation: correlation,
          strength: Math.abs(correlation) > 0.5 ? 'strong' : 'moderate',
          insight: correlation > 0
            ? 'Higher energy days tend to be better mood days'
            : 'Your energy and mood have a unique pattern'
        });
      }
    }

    // Social interaction correlation
    const socialEntries = entries.filter(e => e.social_interaction);
    if (socialEntries.length >= 5) {
      const correlation = this.calculateCorrelation(
        socialEntries.map(e => parseFloat(e.social_interaction)),
        socialEntries.map(e => parseFloat(e.mood_score))
      );
      if (Math.abs(correlation) > 0.2) {
        correlations.push({
          factor: 'Social Connection',
          emoji: '👥',
          correlation: correlation,
          strength: Math.abs(correlation) > 0.5 ? 'strong' : 'moderate',
          insight: correlation > 0
            ? 'Social interaction lifts your spirits'
            : 'You might need more quality alone time'
        });
      }
    }

    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  static calculateCorrelation(x, y) {
    const n = x.length;
    if (n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate mood trends over time
   */
  static calculateTrends(entries) {
    // Sort by date ascending for chart
    const sorted = [...entries].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );

    const dates = sorted.map(e => format(new Date(e.created_at), 'MMM d'));
    const scores = sorted.map(e => parseFloat(e.mood_score));

    // Calculate 7-day moving average if enough data
    const movingAverage = [];
    for (let i = 0; i < scores.length; i++) {
      if (i < 6) {
        movingAverage.push(null);
      } else {
        const avg = scores.slice(i - 6, i + 1).reduce((a, b) => a + b, 0) / 7;
        movingAverage.push(parseFloat(avg.toFixed(1)));
      }
    }

    // Calculate trend direction
    const recentAvg = scores.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, scores.length);
    const previousAvg = scores.slice(-14, -7).length > 0
      ? scores.slice(-14, -7).reduce((a, b) => a + b, 0) / scores.slice(-14, -7).length
      : recentAvg;

    const trendDirection = recentAvg > previousAvg + 0.5 ? 'improving'
      : recentAvg < previousAvg - 0.5 ? 'declining'
      : 'stable';

    return {
      dates,
      scores,
      movingAverage,
      trendDirection,
      recentAverage: parseFloat(recentAvg.toFixed(1)),
      previousAverage: parseFloat(previousAvg.toFixed(1)),
      change: parseFloat((recentAvg - previousAvg).toFixed(1))
    };
  }

  /**
   * Generate personalized recommendations based on patterns
   */
  static generateRecommendations(entries) {
    const recommendations = [];
    const moodScores = entries.map(e => parseFloat(e.mood_score));
    const avgMood = moodScores.reduce((a, b) => a + b, 0) / moodScores.length;
    const recentAvg = moodScores.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, moodScores.length);

    // Check for recent dip
    if (recentAvg < avgMood - 0.5) {
      recommendations.push({
        type: 'check_in',
        emoji: '💜',
        title: 'Noticed a dip',
        message: 'Your mood has been lower than usual recently. Would you like to talk to Luna or try a breathing exercise?',
        actions: ['open_chat', 'breathing']
      });
    }

    // Check for improvement opportunity
    if (recentAvg >= avgMood + 0.3) {
      recommendations.push({
        type: 'celebration',
        emoji: '🌟',
        title: 'You\'re on a roll!',
        message: 'Your mood has been better than average. Keep doing what you\'re doing!',
        actions: []
      });
    }

    // Sleep-based recommendations
    const avgSleep = entries.filter(e => e.sleep_hours)
      .reduce((sum, e) => sum + parseFloat(e.sleep_hours), 0) /
      entries.filter(e => e.sleep_hours).length;

    if (avgSleep && avgSleep < 6.5) {
      recommendations.push({
        type: 'sleep',
        emoji: '😴',
        title: 'Sleep boost opportunity',
        message: 'You\'re averaging less than 7 hours of sleep. Even 30 extra minutes could help your mood.',
        actions: ['sleep_tips']
      });
    }

    // Stress-based recommendations
    const avgStress = entries.filter(e => e.stress_level)
      .reduce((sum, e) => sum + parseFloat(e.stress_level), 0) /
      entries.filter(e => e.stress_level).length;

    if (avgStress && avgStress > 6) {
      recommendations.push({
        type: 'stress',
        emoji: '🧘',
        title: 'Stress management',
        message: 'Your stress has been elevated. A breathing or grounding exercise might help.',
        actions: ['breathing', 'grounding']
      });
    }

    // Journaling encouragement
    if (entries.length >= 7 && entries.length < 14) {
      recommendations.push({
        type: 'journal',
        emoji: '📝',
        title: 'Try journaling',
        message: 'Writing about your feelings can provide clarity and relief. Give the journal a try!',
        actions: ['open_journal']
      });
    }

    return recommendations.slice(0, 3); // Limit to 3 recommendations
  }
}

module.exports = InsightsEngine;

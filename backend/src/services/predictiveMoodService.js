/**
 * Predictive Mood Intelligence Service
 * Generates mood predictions based on user patterns and historical data
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const { format, subDays, addDays, parseISO, differenceInDays, getDay } = require('date-fns');
const WearableConnection = require('../models/WearableConnection');

class PredictiveMoodService {
  /**
   * Generate mood predictions for upcoming days
   */
  static async generatePredictions(userId, daysAhead = 7) {
    try {
      // Check if user has enough data
      const entriesCount = await this.getEntriesCount(userId);
      if (entriesCount < 7) {
        return {
          status: 'insufficient_data',
          message: `Need at least 7 mood entries for predictions. You have ${entriesCount}.`,
          entriesNeeded: 7 - entriesCount
        };
      }

      // Analyze user patterns
      const patterns = await this.analyzeUserPatterns(userId);

      // Generate predictions for each day
      const predictions = [];
      const today = new Date();

      for (let i = 1; i <= daysAhead; i++) {
        const targetDate = addDays(today, i);
        const prediction = await this.calculatePrediction(userId, targetDate, patterns);

        // Save prediction to database
        const saved = await this.savePrediction(userId, prediction);
        predictions.push(saved);
      }

      logger.info('Predictions generated', {
        userId,
        count: predictions.length,
        avgConfidence: predictions.reduce((sum, p) => sum + p.confidence_score, 0) / predictions.length
      });

      return {
        status: 'success',
        predictions,
        patterns: {
          bestDay: patterns.bestDay,
          worstDay: patterns.worstDay,
          peakTime: patterns.peakTime
        }
      };
    } catch (error) {
      logger.error('Error generating predictions', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Analyze user's temporal patterns
   */
  static async analyzeUserPatterns(userId) {
    const entries = await this.getRecentEntries(userId, 60);

    if (entries.length < 7) {
      return null;
    }

    // Day of week analysis
    const dayPatterns = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    entries.forEach(entry => {
      const date = new Date(entry.entry_date);
      const dayOfWeek = getDay(date);
      const dayName = dayNames[dayOfWeek];

      if (!dayPatterns[dayName]) {
        dayPatterns[dayName] = { moods: [], energies: [], stresses: [] };
      }

      dayPatterns[dayName].moods.push(parseFloat(entry.mood_score));
      if (entry.energy_level) dayPatterns[dayName].energies.push(parseFloat(entry.energy_level));
      if (entry.stress_level) dayPatterns[dayName].stresses.push(parseFloat(entry.stress_level));
    });

    // Calculate averages and find best/worst days
    const dayAverages = {};
    let bestDay = null;
    let worstDay = null;
    let bestAvg = 0;
    let worstAvg = 10;

    Object.entries(dayPatterns).forEach(([day, data]) => {
      if (data.moods.length > 0) {
        const avgMood = data.moods.reduce((a, b) => a + b) / data.moods.length;
        dayAverages[day] = {
          avgMood: avgMood.toFixed(1),
          avgEnergy: data.energies.length > 0
            ? (data.energies.reduce((a, b) => a + b) / data.energies.length).toFixed(1)
            : null,
          sampleSize: data.moods.length
        };

        if (avgMood > bestAvg) {
          bestAvg = avgMood;
          bestDay = day;
        }
        if (avgMood < worstAvg) {
          worstAvg = avgMood;
          worstDay = day;
        }
      }
    });

    // Time of day analysis
    const timePatterns = {
      morning: { moods: [], range: [5, 12] },    // 5am - 12pm
      afternoon: { moods: [], range: [12, 17] }, // 12pm - 5pm
      evening: { moods: [], range: [17, 21] },   // 5pm - 9pm
      night: { moods: [], range: [21, 5] }       // 9pm - 5am
    };

    entries.forEach(entry => {
      if (entry.entry_time) {
        const hour = parseInt(entry.entry_time.split(':')[0]);
        let period;

        if (hour >= 5 && hour < 12) period = 'morning';
        else if (hour >= 12 && hour < 17) period = 'afternoon';
        else if (hour >= 17 && hour < 21) period = 'evening';
        else period = 'night';

        timePatterns[period].moods.push(parseFloat(entry.mood_score));
      }
    });

    let peakTime = 'afternoon';
    let peakAvg = 0;

    Object.entries(timePatterns).forEach(([time, data]) => {
      if (data.moods.length > 0) {
        const avg = data.moods.reduce((a, b) => a + b) / data.moods.length;
        if (avg > peakAvg) {
          peakAvg = avg;
          peakTime = time;
        }
      }
    });

    // Calculate correlations
    const correlations = this.calculateCorrelations(entries);

    // Calculate overall averages
    const allMoods = entries.map(e => parseFloat(e.mood_score));
    const avgMood = allMoods.reduce((a, b) => a + b) / allMoods.length;

    const allEnergies = entries.filter(e => e.energy_level).map(e => parseFloat(e.energy_level));
    const avgEnergy = allEnergies.length > 0
      ? allEnergies.reduce((a, b) => a + b) / allEnergies.length
      : null;

    // Calculate optimal sleep
    const sleepEntries = entries.filter(e => e.sleep_hours && e.mood_score >= 7);
    const optimalSleep = sleepEntries.length >= 3
      ? sleepEntries.reduce((sum, e) => sum + parseFloat(e.sleep_hours), 0) / sleepEntries.length
      : 7.5;

    // Calculate recent trend
    const recentEntries = entries.slice(0, 7);
    const olderEntries = entries.slice(7, 14);

    let trendDirection = 'stable';
    if (recentEntries.length >= 3 && olderEntries.length >= 3) {
      const recentAvg = recentEntries.reduce((sum, e) => sum + parseFloat(e.mood_score), 0) / recentEntries.length;
      const olderAvg = olderEntries.reduce((sum, e) => sum + parseFloat(e.mood_score), 0) / olderEntries.length;

      if (recentAvg - olderAvg > 0.5) trendDirection = 'improving';
      else if (olderAvg - recentAvg > 0.5) trendDirection = 'declining';
    }

    // Save patterns to database
    const patterns = {
      dayOfWeekPatterns: dayAverages,
      timeOfDayPatterns: timePatterns,
      bestDay,
      worstDay,
      peakTime,
      avgMood,
      avgEnergy,
      optimalSleep,
      trendDirection,
      correlations,
      dataPointsAnalyzed: entries.length
    };

    await this.saveUserPatterns(userId, patterns);

    return patterns;
  }

  /**
   * Calculate prediction for a specific date
   */
  static async calculatePrediction(userId, targetDate, patterns) {
    const dayOfWeek = getDay(targetDate);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDayName = dayNames[dayOfWeek];

    // Base prediction from day-of-week pattern
    let predictedMood = patterns.avgMood;
    let predictedEnergy = patterns.avgEnergy || 5;
    let confidence = 0.5;
    const factors = [];

    // Factor 1: Day of week pattern
    if (patterns.dayOfWeekPatterns[targetDayName]) {
      const dayData = patterns.dayOfWeekPatterns[targetDayName];
      predictedMood = parseFloat(dayData.avgMood);
      if (dayData.avgEnergy) predictedEnergy = parseFloat(dayData.avgEnergy);
      confidence += 0.1;
      factors.push({
        factor: 'day_of_week',
        impact: targetDayName === patterns.bestDay ? 'positive' :
                targetDayName === patterns.worstDay ? 'negative' : 'neutral',
        detail: `${targetDayName}s average: ${dayData.avgMood}/10`
      });
    }

    // Factor 2: Recent trend
    if (patterns.trendDirection === 'improving') {
      predictedMood += 0.3;
      confidence += 0.1;
      factors.push({
        factor: 'trend',
        impact: 'positive',
        detail: 'Your mood has been improving recently'
      });
    } else if (patterns.trendDirection === 'declining') {
      predictedMood -= 0.3;
      confidence += 0.1;
      factors.push({
        factor: 'trend',
        impact: 'negative',
        detail: 'Your mood has been declining recently'
      });
    }

    // Factor 3: Recent sleep debt (if data available)
    const recentEntries = await this.getRecentEntries(userId, 3);
    const recentSleepAvg = this.calculateRecentSleepAverage(recentEntries);

    if (recentSleepAvg && patterns.optimalSleep) {
      const sleepDiff = recentSleepAvg - patterns.optimalSleep;
      if (sleepDiff < -1) {
        predictedMood -= 0.5;
        predictedEnergy -= 1;
        factors.push({
          factor: 'sleep_debt',
          impact: 'negative',
          detail: `Sleep deficit: averaging ${recentSleepAvg.toFixed(1)}h vs your optimal ${patterns.optimalSleep.toFixed(1)}h`
        });
      } else if (sleepDiff > 0.5) {
        predictedMood += 0.2;
        predictedEnergy += 0.5;
        factors.push({
          factor: 'sleep',
          impact: 'positive',
          detail: 'Good sleep recently'
        });
      }
    }

    // Factor 4: Days ahead (confidence decreases with distance)
    const daysFromNow = differenceInDays(targetDate, new Date());
    confidence *= Math.pow(0.9, daysFromNow - 1);

    if (daysFromNow > 3) {
      factors.push({
        factor: 'distance',
        impact: 'neutral',
        detail: `${daysFromNow} days ahead - prediction uncertainty increases`
      });
    }

    // Bound predictions
    predictedMood = Math.max(1, Math.min(10, predictedMood));
    predictedEnergy = Math.max(1, Math.min(10, predictedEnergy));
    confidence = Math.max(0.2, Math.min(0.95, confidence));

    // Generate preventive actions if mood is predicted low
    const preventiveActions = this.generatePreventiveActions(
      predictedMood,
      predictedEnergy,
      factors,
      patterns
    );

    return {
      predictedDate: format(targetDate, 'yyyy-MM-dd'),
      predictedMood: parseFloat(predictedMood.toFixed(1)),
      predictedEnergy: parseFloat(predictedEnergy.toFixed(1)),
      confidence: parseFloat(confidence.toFixed(2)),
      factors,
      preventiveActions,
      weatherIcon: this.getMoodWeatherIcon(predictedMood),
      riskLevel: predictedMood < 4 ? 'high' : predictedMood < 6 ? 'moderate' : 'low'
    };
  }

  /**
   * Generate preventive actions based on prediction
   */
  static generatePreventiveActions(predictedMood, predictedEnergy, factors, patterns) {
    const actions = [];

    // Check each risk factor and suggest action
    factors.forEach(factor => {
      if (factor.factor === 'sleep_debt' && factor.impact === 'negative') {
        actions.push({
          timing: 'tonight',
          action: `Aim for ${(patterns.optimalSleep + 0.5).toFixed(1)}+ hours of sleep`,
          priority: 'high',
          icon: '😴',
          rationale: 'Sleep debt is affecting your predicted mood'
        });
      }

      if (factor.factor === 'trend' && factor.impact === 'negative') {
        actions.push({
          timing: 'today',
          action: 'Try a 5-minute breathing exercise',
          priority: 'medium',
          icon: '🌬️',
          rationale: 'Breaking a declining trend often starts with small actions'
        });
      }

      if (factor.factor === 'day_of_week' && factor.impact === 'negative') {
        actions.push({
          timing: 'morning',
          action: `${factor.detail.split(' ')[0]}s are often harder - plan something enjoyable`,
          priority: 'medium',
          icon: '📅',
          rationale: 'Knowing your patterns helps you prepare'
        });
      }
    });

    // General actions based on predicted mood level
    if (predictedMood < 5) {
      actions.push({
        timing: 'that_day',
        action: 'Schedule a brief check-in with someone you trust',
        priority: 'medium',
        icon: '👥',
        rationale: 'Social connection often helps on difficult days'
      });
    }

    if (predictedEnergy < 5) {
      actions.push({
        timing: 'morning',
        action: '10-minute walk in daylight',
        priority: 'medium',
        icon: '🚶',
        rationale: 'Light exposure and movement boost energy'
      });
    }

    // Limit to top 3 most relevant actions
    return actions.slice(0, 3);
  }

  /**
   * Get weather-style icon for mood
   */
  static getMoodWeatherIcon(mood) {
    if (mood >= 8) return '☀️';
    if (mood >= 6) return '🌤️';
    if (mood >= 5) return '⛅';
    if (mood >= 4) return '☁️';
    if (mood >= 3) return '🌧️';
    return '⛈️';
  }

  /**
   * Save prediction to database
   */
  static async savePrediction(userId, prediction) {
    const query = `
      INSERT INTO mood_predictions (
        prediction_id, user_id, predicted_date, predicted_mood,
        predicted_energy, confidence_score, factors_considered,
        preventive_actions, generated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, predicted_date)
      DO UPDATE SET
        predicted_mood = EXCLUDED.predicted_mood,
        predicted_energy = EXCLUDED.predicted_energy,
        confidence_score = EXCLUDED.confidence_score,
        factors_considered = EXCLUDED.factors_considered,
        preventive_actions = EXCLUDED.preventive_actions,
        generated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      uuidv4(),
      userId,
      prediction.predictedDate,
      prediction.predictedMood,
      prediction.predictedEnergy,
      prediction.confidence,
      JSON.stringify(prediction.factors),
      JSON.stringify(prediction.preventiveActions)
    ];

    const result = await db.query(query, values);
    const saved = result.rows[0];

    // Add computed fields
    saved.weatherIcon = prediction.weatherIcon;
    saved.riskLevel = prediction.riskLevel;

    return saved;
  }

  /**
   * Get predictions for user
   */
  static async getPredictions(userId, daysAhead = 7) {
    const query = `
      SELECT *
      FROM mood_predictions
      WHERE user_id = $1
        AND predicted_date >= CURRENT_DATE
        AND predicted_date <= CURRENT_DATE + $2 * INTERVAL '1 day'
      ORDER BY predicted_date ASC
    `;

    const result = await db.query(query, [userId, daysAhead]);

    return result.rows.map(row => ({
      ...row,
      weatherIcon: this.getMoodWeatherIcon(parseFloat(row.predicted_mood)),
      riskLevel: row.predicted_mood < 4 ? 'high' : row.predicted_mood < 6 ? 'moderate' : 'low',
      factors: row.factors_considered,
      preventiveActions: row.preventive_actions
    }));
  }

  /**
   * Update prediction accuracy when actual mood is logged
   */
  static async updatePredictionAccuracy(userId, entryDate, actualMood) {
    try {
      const query = `
        UPDATE mood_predictions
        SET
          actual_mood = $3,
          prediction_accuracy = 1.0 - (ABS(predicted_mood - $3) / 10.0)
        WHERE user_id = $1
          AND predicted_date = $2
        RETURNING *
      `;

      const result = await db.query(query, [userId, entryDate, actualMood]);

      if (result.rows.length > 0) {
        logger.info('Prediction accuracy updated', {
          userId,
          date: entryDate,
          predicted: result.rows[0].predicted_mood,
          actual: actualMood,
          accuracy: result.rows[0].prediction_accuracy
        });
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating prediction accuracy', { error: error.message, userId });
      // Don't throw - this is a non-critical operation
      return null;
    }
  }

  /**
   * Get prediction accuracy metrics
   */
  static async getPredictionAccuracy(userId) {
    const query = `
      SELECT
        COUNT(*) as total_predictions,
        COUNT(actual_mood) as verified_predictions,
        AVG(prediction_accuracy) as avg_accuracy,
        AVG(ABS(predicted_mood - actual_mood)) as avg_error,
        MIN(prediction_accuracy) as worst_accuracy,
        MAX(prediction_accuracy) as best_accuracy
      FROM mood_predictions
      WHERE user_id = $1
        AND actual_mood IS NOT NULL
        AND generated_at > CURRENT_DATE - INTERVAL '30 days'
    `;

    const result = await db.query(query, [userId]);
    const stats = result.rows[0];

    return {
      totalPredictions: parseInt(stats.total_predictions) || 0,
      verifiedPredictions: parseInt(stats.verified_predictions) || 0,
      averageAccuracy: stats.avg_accuracy ? parseFloat(stats.avg_accuracy).toFixed(2) : null,
      averageError: stats.avg_error ? parseFloat(stats.avg_error).toFixed(1) : null,
      accuracyPercentage: stats.avg_accuracy
        ? `${(parseFloat(stats.avg_accuracy) * 100).toFixed(0)}%`
        : 'Not enough data'
    };
  }

  /**
   * Save user patterns to database
   */
  static async saveUserPatterns(userId, patterns) {
    const query = `
      INSERT INTO user_patterns (
        pattern_id, user_id, day_of_week_patterns, time_of_day_patterns,
        sleep_mood_correlation, stress_mood_correlation, energy_mood_correlation,
        social_mood_correlation, best_day, worst_day, peak_time,
        avg_mood, avg_energy, optimal_sleep_hours, data_points_analyzed,
        last_analysis_date, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_DATE, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        day_of_week_patterns = EXCLUDED.day_of_week_patterns,
        time_of_day_patterns = EXCLUDED.time_of_day_patterns,
        sleep_mood_correlation = EXCLUDED.sleep_mood_correlation,
        stress_mood_correlation = EXCLUDED.stress_mood_correlation,
        energy_mood_correlation = EXCLUDED.energy_mood_correlation,
        social_mood_correlation = EXCLUDED.social_mood_correlation,
        best_day = EXCLUDED.best_day,
        worst_day = EXCLUDED.worst_day,
        peak_time = EXCLUDED.peak_time,
        avg_mood = EXCLUDED.avg_mood,
        avg_energy = EXCLUDED.avg_energy,
        optimal_sleep_hours = EXCLUDED.optimal_sleep_hours,
        data_points_analyzed = EXCLUDED.data_points_analyzed,
        last_analysis_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      uuidv4(),
      userId,
      JSON.stringify(patterns.dayOfWeekPatterns),
      JSON.stringify(patterns.timeOfDayPatterns),
      patterns.correlations?.sleep || null,
      patterns.correlations?.stress || null,
      patterns.correlations?.energy || null,
      patterns.correlations?.social || null,
      patterns.bestDay,
      patterns.worstDay,
      patterns.peakTime,
      patterns.avgMood,
      patterns.avgEnergy,
      patterns.optimalSleep,
      patterns.dataPointsAnalyzed
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get user patterns
   */
  static async getUserPatterns(userId) {
    const query = `SELECT * FROM user_patterns WHERE user_id = $1`;
    const result = await db.query(query, [userId]);
    return result.rows[0];
  }

  // ===== Helper Methods =====

  static async getEntriesCount(userId) {
    const query = `SELECT COUNT(*) as count FROM mood_entries WHERE user_id = $1`;
    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  static async getRecentEntries(userId, days = 30) {
    const query = `
      SELECT * FROM mood_entries
      WHERE user_id = $1
        AND entry_date >= CURRENT_DATE - $2 * INTERVAL '1 day'
      ORDER BY entry_date DESC, entry_time DESC
    `;
    const result = await db.query(query, [userId, days]);
    return result.rows;
  }

  static calculateRecentSleepAverage(entries) {
    const sleepEntries = entries.filter(e => e.sleep_hours);
    if (sleepEntries.length === 0) return null;
    return sleepEntries.reduce((sum, e) => sum + parseFloat(e.sleep_hours), 0) / sleepEntries.length;
  }

  static calculateCorrelations(entries) {
    if (entries.length < 5) return {};

    const correlations = {};
    const moods = entries.map(e => parseFloat(e.mood_score));

    // Sleep hours correlation
    const sleepEntries = entries.filter(e => e.sleep_hours);
    if (sleepEntries.length >= 5) {
      correlations.sleep = this.pearsonCorrelation(
        sleepEntries.map(e => parseFloat(e.sleep_hours)),
        sleepEntries.map(e => parseFloat(e.mood_score))
      );
    }

    // Stress correlation (inverse expected)
    const stressEntries = entries.filter(e => e.stress_level);
    if (stressEntries.length >= 5) {
      correlations.stress = this.pearsonCorrelation(
        stressEntries.map(e => parseFloat(e.stress_level)),
        stressEntries.map(e => parseFloat(e.mood_score))
      );
    }

    // Energy correlation
    const energyEntries = entries.filter(e => e.energy_level);
    if (energyEntries.length >= 5) {
      correlations.energy = this.pearsonCorrelation(
        energyEntries.map(e => parseFloat(e.energy_level)),
        energyEntries.map(e => parseFloat(e.mood_score))
      );
    }

    // Social correlation
    const socialEntries = entries.filter(e => e.social_interaction_quality);
    if (socialEntries.length >= 5) {
      correlations.social = this.pearsonCorrelation(
        socialEntries.map(e => parseFloat(e.social_interaction_quality)),
        socialEntries.map(e => parseFloat(e.mood_score))
      );
    }

    return correlations;
  }

  static pearsonCorrelation(x, y) {
    const n = x.length;
    if (n === 0 || n !== y.length) return null;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;

    const correlation = numerator / denominator;
    return parseFloat(correlation.toFixed(3));
  }

  // ===== Biometric Integration Methods =====

  /**
   * Get recent biometric data for prediction enhancement
   */
  static async getRecentBiometrics(userId, days = 7) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const biometricData = await WearableConnection.getBiometricData(userId, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        limit: 500
      });

      // Organize by type
      const byType = {};
      biometricData.forEach(data => {
        if (!byType[data.data_type]) {
          byType[data.data_type] = [];
        }
        byType[data.data_type].push({
          date: data.data_date,
          value: parseFloat(data.value_numeric),
          recordedAt: data.recorded_at
        });
      });

      return byType;
    } catch (error) {
      logger.warn('Could not fetch biometric data for predictions', { error: error.message, userId });
      return {};
    }
  }

  /**
   * Get biometric baselines for user
   */
  static async getBiometricBaselines(userId) {
    try {
      const baselines = await WearableConnection.getBaselines(userId);

      const baselineMap = {};
      baselines.forEach(b => {
        baselineMap[b.biometric_type] = {
          mean: parseFloat(b.baseline_mean),
          stddev: parseFloat(b.baseline_stddev),
          optimalLow: parseFloat(b.optimal_range_low),
          optimalHigh: parseFloat(b.optimal_range_high)
        };
      });

      return baselineMap;
    } catch (error) {
      logger.warn('Could not fetch biometric baselines', { error: error.message, userId });
      return {};
    }
  }

  /**
   * Calculate biometric factors for prediction
   */
  static async calculateBiometricFactors(userId, baselines) {
    const factors = [];
    const biometrics = await this.getRecentBiometrics(userId, 3);

    // HRV Factor
    if (biometrics.hrv || biometrics.hrv_rmssd) {
      const hrvData = biometrics.hrv || biometrics.hrv_rmssd;
      const baseline = baselines.hrv || baselines.hrv_rmssd;

      if (hrvData.length > 0 && baseline) {
        const recentAvg = hrvData.reduce((sum, d) => sum + d.value, 0) / hrvData.length;
        const deviation = (recentAvg - baseline.mean) / (baseline.stddev || 1);

        if (deviation < -1) {
          factors.push({
            factor: 'hrv_low',
            impact: 'negative',
            detail: `HRV is below your typical range (${recentAvg.toFixed(0)}ms vs ${baseline.mean.toFixed(0)}ms average)`,
            adjustment: -0.4,
            icon: '💓'
          });
        } else if (deviation > 1) {
          factors.push({
            factor: 'hrv_high',
            impact: 'positive',
            detail: `HRV is above average, indicating good recovery`,
            adjustment: 0.3,
            icon: '💓'
          });
        }
      }
    }

    // Sleep Duration Factor (from wearable)
    if (biometrics.sleep_duration) {
      const sleepData = biometrics.sleep_duration;
      const baseline = baselines.sleep_duration;

      if (sleepData.length > 0) {
        const recentAvg = sleepData.reduce((sum, d) => sum + d.value, 0) / sleepData.length;

        if (baseline) {
          if (recentAvg < baseline.optimalLow) {
            factors.push({
              factor: 'wearable_sleep_deficit',
              impact: 'negative',
              detail: `Wearable detected sleep deficit: ${recentAvg.toFixed(1)}h average vs ${baseline.optimalLow.toFixed(1)}h minimum`,
              adjustment: -0.5,
              icon: '😴'
            });
          } else if (recentAvg >= baseline.optimalHigh) {
            factors.push({
              factor: 'wearable_sleep_good',
              impact: 'positive',
              detail: `Wearable shows good sleep: ${recentAvg.toFixed(1)}h average`,
              adjustment: 0.3,
              icon: '😴'
            });
          }
        } else if (recentAvg < 6) {
          factors.push({
            factor: 'wearable_sleep_low',
            impact: 'negative',
            detail: `Wearable detected low sleep: ${recentAvg.toFixed(1)}h average`,
            adjustment: -0.4,
            icon: '😴'
          });
        }
      }
    }

    // Resting Heart Rate Factor
    if (biometrics.resting_heart_rate) {
      const hrData = biometrics.resting_heart_rate;
      const baseline = baselines.resting_heart_rate;

      if (hrData.length > 0 && baseline) {
        const recentAvg = hrData.reduce((sum, d) => sum + d.value, 0) / hrData.length;
        const deviation = (recentAvg - baseline.mean) / (baseline.stddev || 1);

        if (deviation > 1.5) {
          factors.push({
            factor: 'elevated_hr',
            impact: 'negative',
            detail: `Elevated resting heart rate detected (${recentAvg.toFixed(0)}bpm vs ${baseline.mean.toFixed(0)}bpm typical)`,
            adjustment: -0.3,
            icon: '❤️'
          });
        }
      }
    }

    // Activity Factor
    if (biometrics.steps || biometrics.active_minutes || biometrics.activity_score) {
      const activityData = biometrics.activity_score || biometrics.active_minutes || biometrics.steps;
      const activityType = biometrics.activity_score ? 'activity_score' :
                          biometrics.active_minutes ? 'active_minutes' : 'steps';
      const baseline = baselines[activityType];

      if (activityData.length > 0 && baseline) {
        const recentAvg = activityData.reduce((sum, d) => sum + d.value, 0) / activityData.length;
        const deviation = (recentAvg - baseline.mean) / (baseline.stddev || 1);

        if (deviation < -1) {
          factors.push({
            factor: 'low_activity',
            impact: 'negative',
            detail: `Activity levels are below your typical range`,
            adjustment: -0.2,
            icon: '🏃'
          });
        } else if (deviation > 0.5) {
          factors.push({
            factor: 'good_activity',
            impact: 'positive',
            detail: `Good activity levels recently`,
            adjustment: 0.2,
            icon: '🏃'
          });
        }
      }
    }

    // Readiness Score Factor (Oura-specific)
    if (biometrics.readiness_score) {
      const readinessData = biometrics.readiness_score;

      if (readinessData.length > 0) {
        const latest = readinessData[readinessData.length - 1].value;

        if (latest < 60) {
          factors.push({
            factor: 'low_readiness',
            impact: 'negative',
            detail: `Low readiness score (${latest.toFixed(0)}) - consider taking it easy`,
            adjustment: -0.4,
            icon: '🔋'
          });
        } else if (latest >= 85) {
          factors.push({
            factor: 'high_readiness',
            impact: 'positive',
            detail: `High readiness score (${latest.toFixed(0)}) - you're well recovered`,
            adjustment: 0.3,
            icon: '🔋'
          });
        }
      }
    }

    return factors;
  }

  /**
   * Enhanced prediction calculation with biometric data
   */
  static async calculatePredictionWithBiometrics(userId, targetDate, patterns, biometricBaselines) {
    // Get base prediction
    const basePrediction = await this.calculatePrediction(userId, targetDate, patterns);

    // Add biometric factors
    const biometricFactors = await this.calculateBiometricFactors(userId, biometricBaselines);

    // Apply biometric adjustments
    let adjustedMood = basePrediction.predictedMood;
    let adjustedEnergy = basePrediction.predictedEnergy;
    let confidenceBoost = 0;

    biometricFactors.forEach(factor => {
      adjustedMood += factor.adjustment;
      if (factor.factor.includes('activity') || factor.factor.includes('readiness')) {
        adjustedEnergy += factor.adjustment;
      }
      confidenceBoost += 0.05; // More data = more confidence
    });

    // Bound predictions
    adjustedMood = Math.max(1, Math.min(10, adjustedMood));
    adjustedEnergy = Math.max(1, Math.min(10, adjustedEnergy));
    const adjustedConfidence = Math.min(0.95, basePrediction.confidence + confidenceBoost);

    // Merge factors
    const allFactors = [...basePrediction.factors, ...biometricFactors];

    // Generate additional preventive actions based on biometric factors
    const biometricActions = this.generateBiometricPreventiveActions(biometricFactors);
    const allActions = [...basePrediction.preventiveActions, ...biometricActions].slice(0, 4);

    return {
      ...basePrediction,
      predictedMood: parseFloat(adjustedMood.toFixed(1)),
      predictedEnergy: parseFloat(adjustedEnergy.toFixed(1)),
      confidence: parseFloat(adjustedConfidence.toFixed(2)),
      factors: allFactors,
      preventiveActions: allActions,
      hasBiometricData: biometricFactors.length > 0,
      weatherIcon: this.getMoodWeatherIcon(adjustedMood),
      riskLevel: adjustedMood < 4 ? 'high' : adjustedMood < 6 ? 'moderate' : 'low'
    };
  }

  /**
   * Generate preventive actions based on biometric factors
   */
  static generateBiometricPreventiveActions(biometricFactors) {
    const actions = [];

    biometricFactors.forEach(factor => {
      if (factor.factor === 'hrv_low') {
        actions.push({
          timing: 'today',
          action: 'Practice deep breathing or meditation to support HRV recovery',
          priority: 'high',
          icon: '🧘',
          rationale: 'Low HRV often correlates with stress - recovery practices can help'
        });
      }

      if (factor.factor === 'wearable_sleep_deficit' || factor.factor === 'wearable_sleep_low') {
        actions.push({
          timing: 'tonight',
          action: 'Prioritize an early bedtime to catch up on sleep',
          priority: 'high',
          icon: '🛏️',
          rationale: 'Your wearable data shows a sleep deficit'
        });
      }

      if (factor.factor === 'elevated_hr') {
        actions.push({
          timing: 'today',
          action: 'Take breaks and practice stress management',
          priority: 'medium',
          icon: '❤️',
          rationale: 'Elevated resting heart rate may indicate stress or fatigue'
        });
      }

      if (factor.factor === 'low_activity') {
        actions.push({
          timing: 'today',
          action: 'Try a short walk or light exercise',
          priority: 'medium',
          icon: '🚶',
          rationale: 'Increasing activity can boost mood and energy'
        });
      }

      if (factor.factor === 'low_readiness') {
        actions.push({
          timing: 'today',
          action: 'Consider a lighter schedule and prioritize rest',
          priority: 'medium',
          icon: '🔋',
          rationale: 'Your body may need more recovery time'
        });
      }
    });

    return actions.slice(0, 2); // Limit biometric-specific actions
  }

  /**
   * Get biometric-enhanced predictions
   */
  static async getEnhancedPredictions(userId, daysAhead = 7) {
    try {
      // Check for wearable connections
      const connections = await WearableConnection.getUserConnections(userId);
      const hasWearables = connections.some(c => c.is_active);

      if (!hasWearables) {
        // Fall back to regular predictions
        return this.getPredictions(userId, daysAhead);
      }

      // Get biometric baselines
      const biometricBaselines = await this.getBiometricBaselines(userId);

      // Get patterns
      const patterns = await this.analyzeUserPatterns(userId);
      if (!patterns) {
        return [];
      }

      // Generate enhanced predictions
      const predictions = [];
      const today = new Date();

      for (let i = 1; i <= daysAhead; i++) {
        const targetDate = addDays(today, i);
        const prediction = await this.calculatePredictionWithBiometrics(
          userId,
          targetDate,
          patterns,
          biometricBaselines
        );

        const saved = await this.savePrediction(userId, prediction);
        saved.hasBiometricData = prediction.hasBiometricData;
        predictions.push(saved);
      }

      return predictions;
    } catch (error) {
      logger.error('Error generating enhanced predictions', { error: error.message, userId });
      // Fall back to regular predictions
      return this.getPredictions(userId, daysAhead);
    }
  }
}

module.exports = PredictiveMoodService;

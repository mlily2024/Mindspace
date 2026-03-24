/**
 * Trend Predictor Service
 * Predicts mood trends and identifies early warning signals
 */

const db = require('../config/database');
const {
  linearRegression,
  exponentialMovingAverage,
  detectAnomalies,
  calculateStatistics,
  predictNextValue,
  pearsonCorrelation
} = require('./mlEngine');

/**
 * Risk levels for mental health concerns
 */
const RISK_LEVELS = {
  LOW: { level: 'low', color: 'green', actionRequired: false },
  MODERATE: { level: 'moderate', color: 'yellow', actionRequired: true },
  HIGH: { level: 'high', color: 'orange', actionRequired: true },
  CRITICAL: { level: 'critical', color: 'red', actionRequired: true }
};

/**
 * Predict mood for the next N days
 * @param {Array<Object>} entries - Historical mood entries
 * @param {number} daysAhead - Number of days to predict (1-7)
 * @returns {Array<Object>} Predictions with confidence
 */
const predictMood = (entries, daysAhead = 3) => {
  if (entries.length < 5) {
    return Array.from({ length: daysAhead }, (_, i) => ({
      day: i + 1,
      predicted: 5,
      confidence: 0,
      message: 'Not enough data for prediction'
    }));
  }

  const moods = entries.map(e => e.mood_score);
  const predictions = [];

  // Use exponential moving average for smoothing
  const ema = exponentialMovingAverage(moods, 0.3);
  const lastEMA = ema[ema.length - 1];

  // Calculate trend
  const x = moods.map((_, i) => i);
  const regression = linearRegression(x, moods);

  for (let i = 1; i <= daysAhead; i++) {
    // Combine EMA and trend for prediction
    const trendPredicted = regression.slope * (moods.length + i - 1) + regression.intercept;
    const emaPredicted = lastEMA;

    // Weight: 60% trend, 40% EMA
    let predicted = 0.6 * trendPredicted + 0.4 * emaPredicted;

    // Bound prediction to valid range
    predicted = Math.max(1, Math.min(10, predicted));

    // Confidence decreases with time
    const baseConfidence = Math.max(0, Math.min(1, regression.r2));
    const timeDecay = Math.pow(0.85, i);
    const confidence = baseConfidence * timeDecay;

    predictions.push({
      day: i,
      predicted: Math.round(predicted * 10) / 10,
      confidence: Math.round(confidence * 100) / 100,
      trend: regression.slope > 0.1 ? 'improving' : regression.slope < -0.1 ? 'declining' : 'stable'
    });
  }

  return predictions;
};

/**
 * Detect early warning signals
 * @param {Array<Object>} entries - Mood entries
 * @returns {Object} Warning signals and risk assessment
 */
const detectWarningSignals = (entries) => {
  if (entries.length < 7) {
    return {
      riskLevel: RISK_LEVELS.LOW,
      signals: [],
      message: 'Continue tracking for early warning detection'
    };
  }

  const signals = [];
  const moods = entries.map(e => e.mood_score);
  const stress = entries.map(e => e.stress_level || 5);
  const sleep = entries.map(e => e.sleep_hours || 7);
  const anxiety = entries.map(e => e.anxiety_level || 5);

  // Calculate statistics
  const moodStats = calculateStatistics(moods);
  const stressStats = calculateStatistics(stress);
  const sleepStats = calculateStatistics(sleep);

  // Recent vs historical comparison (last 7 days vs rest)
  const recent = moods.slice(-7);
  const historical = moods.slice(0, -7);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const historicalAvg = historical.length > 0
    ? historical.reduce((a, b) => a + b, 0) / historical.length
    : recentAvg;

  // Signal 1: Significant mood decline
  if (recentAvg < historicalAvg - 1.5) {
    signals.push({
      type: 'mood_decline',
      severity: 'high',
      message: 'Your mood has dropped significantly compared to your baseline.',
      recommendation: 'Consider reaching out to someone you trust or a mental health professional.'
    });
  }

  // Signal 2: Consistently low mood
  if (recentAvg < 4) {
    signals.push({
      type: 'persistent_low_mood',
      severity: 'high',
      message: 'Your mood has been consistently low for the past week.',
      recommendation: 'This pattern suggests you may benefit from additional support.'
    });
  }

  // Signal 3: Increasing trend of stress
  const stressRecent = stress.slice(-7);
  const stressTrend = linearRegression(stressRecent.map((_, i) => i), stressRecent);
  if (stressTrend.slope > 0.3 && stressStats.mean > 6) {
    signals.push({
      type: 'increasing_stress',
      severity: 'moderate',
      message: 'Your stress levels are trending upward.',
      recommendation: 'Try stress reduction techniques like deep breathing or progressive muscle relaxation.'
    });
  }

  // Signal 4: Sleep disruption
  if (sleepStats.mean < 5 || sleepStats.stdDev > 2) {
    signals.push({
      type: 'sleep_issues',
      severity: 'moderate',
      message: sleepStats.mean < 5
        ? 'You\'re averaging less than 5 hours of sleep.'
        : 'Your sleep pattern is highly irregular.',
      recommendation: 'Consistent sleep is crucial for mental health. Consider improving your sleep hygiene.'
    });
  }

  // Signal 5: High anxiety correlation with mood
  const anxietyMoodCorr = pearsonCorrelation(anxiety, moods);
  if (anxietyMoodCorr < -0.5 && calculateStatistics(anxiety).mean > 6) {
    signals.push({
      type: 'anxiety_impact',
      severity: 'moderate',
      message: 'High anxiety is strongly affecting your mood.',
      recommendation: 'Anxiety management techniques or professional support may help.'
    });
  }

  // Signal 6: Anomaly detection - sudden drops
  const anomalies = detectAnomalies(moods, 2);
  const recentAnomalies = anomalies.filter(a => a.index >= moods.length - 7 && a.zScore < -1.5);
  if (recentAnomalies.length >= 2) {
    signals.push({
      type: 'mood_anomalies',
      severity: 'moderate',
      message: 'You\'ve had multiple unusually low mood days recently.',
      recommendation: 'Try to identify what triggered these dips - journaling can help.'
    });
  }

  // Determine overall risk level
  let riskLevel;
  const highSeverityCount = signals.filter(s => s.severity === 'high').length;
  const moderateSeverityCount = signals.filter(s => s.severity === 'moderate').length;

  if (highSeverityCount >= 2 || (highSeverityCount >= 1 && moderateSeverityCount >= 2)) {
    riskLevel = RISK_LEVELS.CRITICAL;
  } else if (highSeverityCount >= 1) {
    riskLevel = RISK_LEVELS.HIGH;
  } else if (moderateSeverityCount >= 2) {
    riskLevel = RISK_LEVELS.MODERATE;
  } else {
    riskLevel = RISK_LEVELS.LOW;
  }

  return {
    riskLevel,
    signals,
    statistics: {
      moodAverage: moodStats.mean,
      stressAverage: stressStats.mean,
      sleepAverage: sleepStats.mean,
      moodTrend: recentAvg - historicalAvg
    }
  };
};

/**
 * Generate a comprehensive trend report
 * @param {string} userId - User ID
 * @returns {Object} Comprehensive trend analysis
 */
const generateTrendReport = async (userId) => {
  // Get entries from the last 30 days
  const query = `
    SELECT * FROM mood_entries
    WHERE user_id = $1
    AND entry_date >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY entry_date ASC
  `;

  const result = await db.query(query, [userId]);
  const entries = result.rows;

  if (entries.length < 5) {
    return {
      success: true,
      hasEnoughData: false,
      message: 'Continue tracking for at least 5 days to see trend analysis.',
      dataPoints: entries.length
    };
  }

  // Generate predictions
  const predictions = predictMood(entries, 7);

  // Detect warning signals
  const warningAnalysis = detectWarningSignals(entries);

  // Calculate comprehensive statistics
  const moods = entries.map(e => e.mood_score);
  const moodStats = calculateStatistics(moods);

  // Weekly breakdown
  const weeklyData = [];
  const today = new Date();
  for (let week = 0; week < 4; week++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (week + 1) * 7);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - week * 7);

    const weekEntries = entries.filter(e => {
      const entryDate = new Date(e.entry_date);
      return entryDate >= weekStart && entryDate < weekEnd;
    });

    if (weekEntries.length > 0) {
      const weekMoods = weekEntries.map(e => e.mood_score);
      weeklyData.push({
        week: week + 1,
        label: week === 0 ? 'This Week' : week === 1 ? 'Last Week' : `${week + 1} Weeks Ago`,
        average: weekMoods.reduce((a, b) => a + b, 0) / weekMoods.length,
        entries: weekEntries.length
      });
    }
  }

  // Day of week analysis
  const dayOfWeekData = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  entries.forEach(e => {
    const day = new Date(e.entry_date).getDay();
    if (!dayOfWeekData[day]) {
      dayOfWeekData[day] = [];
    }
    dayOfWeekData[day].push(e.mood_score);
  });

  const dayOfWeekAverages = dayNames.map((name, index) => ({
    day: name,
    average: dayOfWeekData[index]
      ? dayOfWeekData[index].reduce((a, b) => a + b, 0) / dayOfWeekData[index].length
      : null,
    entries: dayOfWeekData[index]?.length || 0
  }));

  // Generate summary
  const trendDirection = predictions[0]?.trend || 'stable';
  const riskLevel = warningAnalysis.riskLevel.level;

  let summary;
  if (riskLevel === 'critical' || riskLevel === 'high') {
    summary = 'Your recent patterns suggest you may need additional support. Please consider reaching out to a mental health professional or trusted person.';
  } else if (trendDirection === 'improving') {
    summary = 'Your mood shows a positive trend. Keep up the good work and continue with what\'s working for you.';
  } else if (trendDirection === 'declining') {
    summary = 'Your mood has been trending downward. Consider trying some of the recommended self-care activities.';
  } else {
    summary = 'Your mood has been relatively stable. Maintaining consistent self-care routines will help keep it that way.';
  }

  return {
    success: true,
    hasEnoughData: true,
    dataPoints: entries.length,
    analyzedPeriod: '30 days',
    summary,
    currentStatus: {
      averageMood: Math.round(moodStats.mean * 10) / 10,
      moodVariability: moodStats.stdDev < 1.5 ? 'low' : moodStats.stdDev < 2.5 ? 'moderate' : 'high',
      trend: trendDirection,
      riskLevel
    },
    predictions,
    warningSignals: warningAnalysis.signals,
    weeklyBreakdown: weeklyData,
    dayOfWeekAnalysis: dayOfWeekAverages.filter(d => d.entries > 0),
    statistics: {
      mood: moodStats,
      ...warningAnalysis.statistics
    }
  };
};

/**
 * Check if user needs immediate attention based on their latest entry
 * @param {Object} entry - Latest mood entry
 * @param {Array<Object>} recentEntries - Recent entries for context
 * @returns {Object} Alert status
 */
const checkImmediateRisk = (entry, recentEntries = []) => {
  const alerts = [];

  // Critical mood check
  if (entry.mood_score <= 2) {
    alerts.push({
      type: 'critical_mood',
      severity: 'high',
      message: 'Very low mood detected',
      action: 'SHOW_CRISIS_RESOURCES'
    });
  }

  // High stress + low mood combination
  if (entry.stress_level >= 8 && entry.mood_score <= 4) {
    alerts.push({
      type: 'high_stress_low_mood',
      severity: 'high',
      message: 'High stress with low mood',
      action: 'SHOW_IMMEDIATE_SUPPORT'
    });
  }

  // High anxiety check
  if (entry.anxiety_level >= 9) {
    alerts.push({
      type: 'severe_anxiety',
      severity: 'high',
      message: 'Severe anxiety detected',
      action: 'SHOW_GROUNDING_EXERCISE'
    });
  }

  // Check for sudden drop from recent average
  if (recentEntries.length >= 3) {
    const recentAvg = recentEntries.reduce((sum, e) => sum + e.mood_score, 0) / recentEntries.length;
    if (entry.mood_score < recentAvg - 3) {
      alerts.push({
        type: 'sudden_drop',
        severity: 'moderate',
        message: 'Significant mood drop from your usual',
        action: 'SUGGEST_CHECK_IN'
      });
    }
  }

  const needsAttention = alerts.some(a => a.severity === 'high');

  return {
    needsAttention,
    alerts,
    suggestedAction: needsAttention ? 'SHOW_SUPPORT_OPTIONS' : null
  };
};

module.exports = {
  RISK_LEVELS,
  predictMood,
  detectWarningSignals,
  generateTrendReport,
  checkImmediateRisk
};

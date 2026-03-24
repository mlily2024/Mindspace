/**
 * Biometric Correlation Service
 * Calculates correlations between biometric data and mood metrics
 * using Pearson correlation coefficient with statistical significance testing
 */

const db = require('../config/database');
const WearableConnection = require('../models/WearableConnection');
const MoodEntry = require('../models/MoodEntry');
const logger = require('../config/logger');

class BiometricCorrelationService {
  // Minimum sample size for reliable correlations
  static MIN_SAMPLE_SIZE = 7;

  // Significance threshold (p < 0.05)
  static SIGNIFICANCE_THRESHOLD = 0.05;

  // Biometric types to correlate
  static BIOMETRIC_TYPES = [
    'sleep_duration',
    'sleep_quality',
    'hrv',
    'hrv_rmssd',
    'resting_heart_rate',
    'steps',
    'active_minutes',
    'activity_score',
    'readiness_score',
    'stress_level'
  ];

  // Mood metrics to correlate against
  static MOOD_METRICS = [
    'mood_score',
    'energy_level',
    'stress_level',
    'anxiety_level',
    'sleep_quality'
  ];

  /**
   * Calculate Pearson correlation coefficient between two arrays
   */
  static calculatePearsonCorrelation(x, y) {
    if (x.length !== y.length || x.length < 2) {
      return { coefficient: null, error: 'Insufficient or mismatched data' };
    }

    const n = x.length;

    // Calculate means
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    // Calculate standard deviations and covariance
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      sumXY += dx * dy;
      sumX2 += dx * dx;
      sumY2 += dy * dy;
    }

    // Check for zero variance
    if (sumX2 === 0 || sumY2 === 0) {
      return { coefficient: 0, error: 'Zero variance in data' };
    }

    const coefficient = sumXY / Math.sqrt(sumX2 * sumY2);

    return {
      coefficient: Math.round(coefficient * 10000) / 10000,
      meanX,
      meanY,
      stdX: Math.sqrt(sumX2 / n),
      stdY: Math.sqrt(sumY2 / n)
    };
  }

  /**
   * Calculate p-value for Pearson correlation using t-distribution approximation
   * Uses Fisher transformation for better accuracy
   */
  static calculatePValue(r, n) {
    if (n < 3 || r === null || Math.abs(r) >= 1) {
      return 1;
    }

    // t-statistic
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    const df = n - 2;

    // Approximate p-value using t-distribution
    // Using a simplified approximation for two-tailed test
    const x = df / (df + t * t);

    // Regularized incomplete beta function approximation
    const pValue = this.incompleteBeta(df / 2, 0.5, x);

    return Math.min(1, Math.max(0, pValue));
  }

  /**
   * Simplified incomplete beta function approximation
   */
  static incompleteBeta(a, b, x) {
    // Using a simple approximation for statistical significance testing
    // For more accuracy, consider using a statistics library
    if (x === 0) return 0;
    if (x === 1) return 1;

    const bt = Math.exp(
      this.logGamma(a + b) - this.logGamma(a) - this.logGamma(b) +
      a * Math.log(x) + b * Math.log(1 - x)
    );

    if (x < (a + 1) / (a + b + 2)) {
      return bt * this.betaContinuedFraction(a, b, x) / a;
    } else {
      return 1 - bt * this.betaContinuedFraction(b, a, 1 - x) / b;
    }
  }

  /**
   * Log gamma function approximation (Stirling's approximation)
   */
  static logGamma(x) {
    const c = [
      76.18009172947146,
      -86.50532032941677,
      24.01409824083091,
      -1.231739572450155,
      0.1208650973866179e-2,
      -0.5395239384953e-5
    ];

    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;

    for (let j = 0; j < 6; j++) {
      ser += c[j] / ++y;
    }

    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  /**
   * Continued fraction for incomplete beta function
   */
  static betaContinuedFraction(a, b, x) {
    const maxIterations = 100;
    const epsilon = 1e-10;

    let qab = a + b;
    let qap = a + 1;
    let qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;

    if (Math.abs(d) < epsilon) d = epsilon;
    d = 1 / d;
    let h = d;

    for (let m = 1; m <= maxIterations; m++) {
      let m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < epsilon) d = epsilon;
      c = 1 + aa / c;
      if (Math.abs(c) < epsilon) c = epsilon;
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < epsilon) d = epsilon;
      c = 1 + aa / c;
      if (Math.abs(c) < epsilon) c = epsilon;
      d = 1 / d;
      let del = d * c;
      h *= del;
      if (Math.abs(del - 1) < epsilon) break;
    }

    return h;
  }

  /**
   * Classify correlation strength based on coefficient
   */
  static classifyCorrelationStrength(r) {
    if (r === null) return 'none';
    const absR = Math.abs(r);

    if (absR < 0.1) return 'none';
    if (absR < 0.3) return 'weak';
    if (absR < 0.5) return 'moderate';
    if (absR < 0.7) return 'strong';
    return 'very_strong';
  }

  /**
   * Get correlation direction
   */
  static getCorrelationDirection(r) {
    if (r === null || Math.abs(r) < 0.1) return 'none';
    return r > 0 ? 'positive' : 'negative';
  }

  /**
   * Calculate all correlations for a user
   */
  static async calculateUserCorrelations(userId, options = {}) {
    const { days = 30, forceRecalculate = false } = options;

    try {
      // Get date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Get mood entries for the period
      const moodEntries = await MoodEntry.getUserEntries(userId, {
        startDate: startDateStr,
        endDate: endDateStr,
        limit: 1000
      });

      if (moodEntries.length < this.MIN_SAMPLE_SIZE) {
        logger.info(`Insufficient mood data for user ${userId}: ${moodEntries.length} entries`);
        return {
          success: false,
          message: `Need at least ${this.MIN_SAMPLE_SIZE} mood entries for correlation analysis`,
          entriesFound: moodEntries.length
        };
      }

      // Get biometric data for the period
      const biometricData = await WearableConnection.getBiometricData(userId, {
        startDate: startDateStr,
        endDate: endDateStr,
        limit: 10000
      });

      if (biometricData.length === 0) {
        logger.info(`No biometric data found for user ${userId}`);
        return {
          success: false,
          message: 'No biometric data available for correlation analysis',
          entriesFound: 0
        };
      }

      // Organize mood data by date
      const moodByDate = {};
      moodEntries.forEach(entry => {
        const date = entry.entry_date instanceof Date
          ? entry.entry_date.toISOString().split('T')[0]
          : entry.entry_date;

        // If multiple entries per day, average them
        if (!moodByDate[date]) {
          moodByDate[date] = {
            mood_score: [],
            energy_level: [],
            stress_level: [],
            anxiety_level: [],
            sleep_quality: []
          };
        }

        if (entry.mood_score != null) moodByDate[date].mood_score.push(entry.mood_score);
        if (entry.energy_level != null) moodByDate[date].energy_level.push(entry.energy_level);
        if (entry.stress_level != null) moodByDate[date].stress_level.push(entry.stress_level);
        if (entry.anxiety_level != null) moodByDate[date].anxiety_level.push(entry.anxiety_level);
        if (entry.sleep_quality != null) moodByDate[date].sleep_quality.push(entry.sleep_quality);
      });

      // Average mood metrics per day
      Object.keys(moodByDate).forEach(date => {
        Object.keys(moodByDate[date]).forEach(metric => {
          const values = moodByDate[date][metric];
          moodByDate[date][metric] = values.length > 0
            ? values.reduce((a, b) => a + b, 0) / values.length
            : null;
        });
      });

      // Organize biometric data by date and type
      const biometricByDateType = {};
      biometricData.forEach(data => {
        const date = data.data_date instanceof Date
          ? data.data_date.toISOString().split('T')[0]
          : data.data_date;
        const type = data.data_type;

        if (!biometricByDateType[type]) {
          biometricByDateType[type] = {};
        }

        biometricByDateType[type][date] = parseFloat(data.value_numeric);
      });

      // Calculate correlations for each biometric-mood pair
      const correlations = [];

      for (const biometricType of Object.keys(biometricByDateType)) {
        for (const moodMetric of this.MOOD_METRICS) {
          // Get matched pairs (dates where we have both values)
          const biometricValues = [];
          const moodValues = [];

          Object.keys(moodByDate).forEach(date => {
            const moodValue = moodByDate[date][moodMetric];
            const biometricValue = biometricByDateType[biometricType]?.[date];

            if (moodValue != null && biometricValue != null) {
              biometricValues.push(biometricValue);
              moodValues.push(moodValue);
            }
          });

          // Skip if insufficient matched data
          if (biometricValues.length < this.MIN_SAMPLE_SIZE) {
            continue;
          }

          // Calculate correlation
          const { coefficient, meanX, meanY } = this.calculatePearsonCorrelation(
            biometricValues,
            moodValues
          );

          if (coefficient === null) continue;

          // Calculate p-value
          const pValue = this.calculatePValue(coefficient, biometricValues.length);

          // Classify
          const strength = this.classifyCorrelationStrength(coefficient);
          const direction = this.getCorrelationDirection(coefficient);
          const isSignificant = pValue < this.SIGNIFICANCE_THRESHOLD;

          // Calculate confidence level based on sample size and p-value
          const confidenceLevel = Math.min(
            0.99,
            (1 - pValue) * Math.min(1, biometricValues.length / 30)
          );

          const correlation = {
            biometricType,
            moodMetric,
            pearsonCoefficient: coefficient,
            pValue: Math.round(pValue * 100000000) / 100000000,
            sampleSize: biometricValues.length,
            correlationStrength: strength,
            direction,
            confidenceLevel: Math.round(confidenceLevel * 100) / 100,
            isSignificant,
            dateRangeStart: startDateStr,
            dateRangeEnd: endDateStr
          };

          correlations.push(correlation);

          // Save to database
          await WearableConnection.saveCorrelation(userId, correlation);
        }
      }

      // Generate insights from significant correlations
      const insights = await this.generateInsightsFromCorrelations(userId, correlations);

      logger.info(`Calculated ${correlations.length} correlations for user ${userId}, ${insights.length} insights generated`);

      return {
        success: true,
        correlationsCalculated: correlations.length,
        significantCorrelations: correlations.filter(c => c.isSignificant).length,
        insightsGenerated: insights.length,
        correlations,
        insights
      };
    } catch (error) {
      logger.error('Error calculating user correlations:', error);
      throw error;
    }
  }

  /**
   * Generate insights from calculated correlations
   */
  static async generateInsightsFromCorrelations(userId, correlations) {
    const insights = [];

    // Filter to significant correlations only
    const significantCorrelations = correlations.filter(c => c.isSignificant);

    for (const correlation of significantCorrelations) {
      const insight = this.createInsightFromCorrelation(correlation);

      if (insight) {
        // Save insight to database
        await WearableConnection.saveInsight(userId, insight);
        insights.push(insight);
      }
    }

    // Generate composite insights if multiple related correlations exist
    const compositeInsights = this.generateCompositeInsights(significantCorrelations);
    for (const insight of compositeInsights) {
      await WearableConnection.saveInsight(userId, insight);
      insights.push(insight);
    }

    return insights;
  }

  /**
   * Create a single insight from a correlation
   */
  static createInsightFromCorrelation(correlation) {
    const { biometricType, moodMetric, pearsonCoefficient, direction, correlationStrength, confidenceLevel, sampleSize } = correlation;

    // Skip weak or no correlations
    if (correlationStrength === 'none' || correlationStrength === 'weak') {
      return null;
    }

    const biometricLabel = this.getBiometricLabel(biometricType);
    const moodLabel = this.getMoodMetricLabel(moodMetric);
    const directionWord = direction === 'positive' ? 'increases' : 'decreases';
    const inverseWord = direction === 'positive' ? 'lower' : 'higher';

    let title, description, recommendations;

    // Generate insight based on specific biometric-mood combination
    if (biometricType.includes('sleep')) {
      title = `Sleep Impacts Your ${moodLabel}`;
      description = direction === 'positive'
        ? `Your ${biometricLabel} shows a ${correlationStrength} positive correlation with ${moodLabel}. When you sleep better or longer, your ${moodLabel.toLowerCase()} tends to improve.`
        : `Your ${biometricLabel} shows a ${correlationStrength} negative correlation with ${moodLabel}. Interestingly, ${inverseWord} ${biometricLabel.toLowerCase()} is associated with better ${moodLabel.toLowerCase()}.`;
      recommendations = [
        { action: 'Maintain a consistent sleep schedule', priority: 'high' },
        { action: 'Aim for 7-9 hours of quality sleep', priority: 'medium' },
        { action: 'Create a relaxing bedtime routine', priority: 'medium' }
      ];
    } else if (biometricType.includes('hrv')) {
      title = `Heart Rate Variability Affects ${moodLabel}`;
      description = direction === 'positive'
        ? `Higher HRV is associated with better ${moodLabel.toLowerCase()} for you. This is a ${correlationStrength} correlation, suggesting your nervous system balance directly impacts your emotional state.`
        : `Your HRV shows a ${correlationStrength} inverse relationship with ${moodLabel.toLowerCase()}. This may indicate that stress responses are affecting both metrics.`;
      recommendations = [
        { action: 'Practice deep breathing exercises', priority: 'high' },
        { action: 'Consider meditation or yoga', priority: 'medium' },
        { action: 'Reduce caffeine and alcohol intake', priority: 'low' }
      ];
    } else if (biometricType.includes('heart_rate') || biometricType === 'resting_heart_rate') {
      title = `Resting Heart Rate & ${moodLabel} Connection`;
      description = direction === 'negative'
        ? `Lower resting heart rate is associated with better ${moodLabel.toLowerCase()}. This ${correlationStrength} correlation suggests cardiovascular fitness may support emotional wellbeing.`
        : `Your resting heart rate shows a ${correlationStrength} positive correlation with ${moodLabel.toLowerCase()}. This is worth monitoring with your healthcare provider.`;
      recommendations = [
        { action: 'Regular cardiovascular exercise', priority: 'high' },
        { action: 'Monitor stress levels throughout the day', priority: 'medium' },
        { action: 'Stay hydrated', priority: 'low' }
      ];
    } else if (biometricType.includes('steps') || biometricType.includes('activity')) {
      title = `Physical Activity Boosts ${moodLabel}`;
      description = direction === 'positive'
        ? `Your ${biometricLabel} has a ${correlationStrength} positive correlation with ${moodLabel.toLowerCase()}. More activity is associated with better emotional states for you.`
        : `Interestingly, your ${biometricLabel} shows a ${correlationStrength} negative correlation with ${moodLabel.toLowerCase()}. You might benefit from balanced rest and activity.`;
      recommendations = [
        { action: 'Aim for at least 30 minutes of daily movement', priority: 'high' },
        { action: 'Take walking breaks throughout the day', priority: 'medium' },
        { action: 'Find enjoyable physical activities', priority: 'medium' }
      ];
    } else if (biometricType === 'readiness_score') {
      title = `Recovery Score & ${moodLabel}`;
      description = `Your readiness/recovery score shows a ${correlationStrength} ${direction} correlation with ${moodLabel.toLowerCase()}. This suggests that physical recovery and emotional state are linked for you.`;
      recommendations = [
        { action: 'Prioritize recovery days after intense activity', priority: 'high' },
        { action: 'Listen to your body signals', priority: 'medium' },
        { action: 'Balance exertion with adequate rest', priority: 'medium' }
      ];
    } else {
      title = `${biometricLabel} Affects ${moodLabel}`;
      description = `Your ${biometricLabel.toLowerCase()} shows a ${correlationStrength} ${direction} correlation with ${moodLabel.toLowerCase()}. Based on ${sampleSize} days of data, this pattern appears consistent.`;
      recommendations = [
        { action: `Monitor your ${biometricLabel.toLowerCase()} regularly`, priority: 'medium' },
        { action: 'Note any changes in patterns', priority: 'low' }
      ];
    }

    return {
      insightType: 'correlation_discovery',
      title,
      description,
      biometricType,
      impactScore: Math.abs(pearsonCoefficient),
      confidenceScore: confidenceLevel,
      supportingData: {
        correlation: pearsonCoefficient,
        sampleSize,
        moodMetric,
        strength: correlationStrength,
        direction
      },
      recommendations,
      isActionable: true,
      priority: correlationStrength === 'very_strong' ? 3 : correlationStrength === 'strong' ? 2 : 1
    };
  }

  /**
   * Generate composite insights from multiple related correlations
   */
  static generateCompositeInsights(correlations) {
    const insights = [];

    // Check for sleep-mood pattern (multiple sleep metrics correlating with mood)
    const sleepCorrelations = correlations.filter(c =>
      c.biometricType.includes('sleep') && c.moodMetric === 'mood_score'
    );

    if (sleepCorrelations.length >= 2) {
      const avgImpact = sleepCorrelations.reduce((sum, c) => sum + Math.abs(c.pearsonCoefficient), 0) / sleepCorrelations.length;

      insights.push({
        insightType: 'pattern_detected',
        title: 'Sleep is Key to Your Mood',
        description: `Multiple sleep metrics show significant correlations with your mood. Sleep appears to be one of the strongest factors affecting your emotional wellbeing.`,
        biometricType: 'sleep_composite',
        impactScore: avgImpact,
        confidenceScore: 0.85,
        supportingData: {
          relatedCorrelations: sleepCorrelations.map(c => ({
            type: c.biometricType,
            correlation: c.pearsonCoefficient
          }))
        },
        recommendations: [
          { action: 'Make sleep your top priority for mood improvement', priority: 'high' },
          { action: 'Track sleep quality alongside mood entries', priority: 'medium' }
        ],
        isActionable: true,
        priority: 3
      });
    }

    // Check for activity-energy correlation
    const activityEnergyCorrelations = correlations.filter(c =>
      (c.biometricType.includes('steps') || c.biometricType.includes('activity')) &&
      c.moodMetric === 'energy_level' &&
      c.direction === 'positive'
    );

    if (activityEnergyCorrelations.length > 0) {
      insights.push({
        insightType: 'improvement_opportunity',
        title: 'Movement Energizes You',
        description: 'Physical activity has a clear positive effect on your energy levels. Even small increases in daily movement could help boost how energized you feel.',
        biometricType: 'activity_composite',
        impactScore: activityEnergyCorrelations[0].pearsonCoefficient,
        confidenceScore: 0.80,
        supportingData: {
          correlation: activityEnergyCorrelations[0].pearsonCoefficient
        },
        recommendations: [
          { action: 'Start with short 10-minute walks', priority: 'high' },
          { action: 'Gradually increase daily step goal', priority: 'medium' }
        ],
        isActionable: true,
        priority: 2
      });
    }

    // Check for HRV-stress/anxiety pattern
    const hrvStressCorrelations = correlations.filter(c =>
      c.biometricType.includes('hrv') &&
      (c.moodMetric === 'stress_level' || c.moodMetric === 'anxiety_level')
    );

    if (hrvStressCorrelations.length > 0 && hrvStressCorrelations.some(c => c.direction === 'negative')) {
      insights.push({
        insightType: 'hrv_insight',
        title: 'Your HRV Reflects Stress Levels',
        description: 'Heart rate variability drops when you experience more stress or anxiety. Monitoring HRV can serve as an early warning system for elevated stress.',
        biometricType: 'hrv',
        impactScore: Math.abs(hrvStressCorrelations[0].pearsonCoefficient),
        confidenceScore: 0.82,
        supportingData: {
          correlations: hrvStressCorrelations.map(c => ({
            metric: c.moodMetric,
            correlation: c.pearsonCoefficient
          }))
        },
        recommendations: [
          { action: 'Use HRV as a stress early warning indicator', priority: 'high' },
          { action: 'Practice stress reduction when HRV drops', priority: 'medium' },
          { action: 'Try breathing exercises to improve HRV', priority: 'medium' }
        ],
        isActionable: true,
        priority: 2
      });
    }

    return insights;
  }

  /**
   * Update user's biometric baselines
   */
  static async updateBaselines(userId) {
    try {
      const days = 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get biometric data
      const biometricData = await WearableConnection.getBiometricData(userId, {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        limit: 10000
      });

      // Group by type
      const byType = {};
      biometricData.forEach(data => {
        if (!byType[data.data_type]) {
          byType[data.data_type] = [];
        }
        byType[data.data_type].push(parseFloat(data.value_numeric));
      });

      // Calculate baselines for each type
      const baselines = [];
      for (const [dataType, values] of Object.entries(byType)) {
        if (values.length < 3) continue;

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        const stddev = Math.sqrt(variance);
        const min = Math.min(...values);
        const max = Math.max(...values);

        // Optimal range is typically within 1 standard deviation of mean
        const optimalLow = mean - stddev;
        const optimalHigh = mean + stddev;

        const baseline = {
          biometricType: dataType,
          baselineMean: Math.round(mean * 10000) / 10000,
          baselineStddev: Math.round(stddev * 10000) / 10000,
          baselineMin: Math.round(min * 10000) / 10000,
          baselineMax: Math.round(max * 10000) / 10000,
          optimalRangeLow: Math.round(optimalLow * 10000) / 10000,
          optimalRangeHigh: Math.round(optimalHigh * 10000) / 10000,
          sampleCount: values.length
        };

        await WearableConnection.updateBaseline(userId, baseline);
        baselines.push(baseline);
      }

      logger.info(`Updated ${baselines.length} baselines for user ${userId}`);
      return baselines;
    } catch (error) {
      logger.error('Error updating baselines:', error);
      throw error;
    }
  }

  /**
   * Check for anomalies in latest biometric data
   */
  static async checkForAnomalies(userId) {
    try {
      // Get baselines
      const baselines = await WearableConnection.getBaselines(userId);
      if (baselines.length === 0) {
        return { anomalies: [], message: 'No baselines established yet' };
      }

      // Get latest biometrics
      const latestData = await WearableConnection.getLatestBiometrics(userId);
      if (latestData.length === 0) {
        return { anomalies: [], message: 'No recent biometric data' };
      }

      const anomalies = [];

      for (const data of latestData) {
        const baseline = baselines.find(b => b.biometric_type === data.data_type);
        if (!baseline || !baseline.baseline_mean || !baseline.baseline_stddev) continue;

        const value = parseFloat(data.value_numeric);
        const mean = parseFloat(baseline.baseline_mean);
        const stddev = parseFloat(baseline.baseline_stddev);

        if (stddev === 0) continue;

        // Calculate z-score
        const zScore = (value - mean) / stddev;

        // Flag if more than 2 standard deviations from mean
        if (Math.abs(zScore) > 2) {
          anomalies.push({
            dataType: data.data_type,
            currentValue: value,
            baselineMean: mean,
            baselineStddev: stddev,
            zScore: Math.round(zScore * 100) / 100,
            direction: zScore > 0 ? 'high' : 'low',
            severity: Math.abs(zScore) > 3 ? 'significant' : 'moderate',
            recordedAt: data.recorded_at
          });
        }
      }

      // Generate alerts for significant anomalies
      if (anomalies.some(a => a.severity === 'significant')) {
        await this.generateAnomalyAlert(userId, anomalies.filter(a => a.severity === 'significant'));
      }

      return { anomalies };
    } catch (error) {
      logger.error('Error checking for anomalies:', error);
      throw error;
    }
  }

  /**
   * Generate alert insight for significant anomalies
   */
  static async generateAnomalyAlert(userId, anomalies) {
    for (const anomaly of anomalies) {
      const label = this.getBiometricLabel(anomaly.dataType);
      const insight = {
        insightType: 'threshold_alert',
        title: `Unusual ${label} Detected`,
        description: `Your ${label.toLowerCase()} is ${anomaly.direction === 'high' ? 'significantly higher' : 'significantly lower'} than your normal range. Current value: ${anomaly.currentValue}, typical range: ${Math.round(anomaly.baselineMean - anomaly.baselineStddev)} - ${Math.round(anomaly.baselineMean + anomaly.baselineStddev)}.`,
        biometricType: anomaly.dataType,
        impactScore: Math.min(1, Math.abs(anomaly.zScore) / 4),
        confidenceScore: 0.90,
        supportingData: anomaly,
        recommendations: [
          { action: 'Note any unusual circumstances today', priority: 'medium' },
          { action: 'Check if this trend continues', priority: 'medium' }
        ],
        isActionable: true,
        priority: 3,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
      };

      await WearableConnection.saveInsight(userId, insight);
    }
  }

  /**
   * Get user-friendly label for biometric type
   */
  static getBiometricLabel(type) {
    const labels = {
      'sleep_duration': 'Sleep Duration',
      'sleep_quality': 'Sleep Quality',
      'sleep_stages': 'Sleep Stages',
      'hrv': 'Heart Rate Variability',
      'hrv_rmssd': 'HRV (RMSSD)',
      'hrv_sdnn': 'HRV (SDNN)',
      'resting_heart_rate': 'Resting Heart Rate',
      'heart_rate_variability': 'Heart Rate Variability',
      'steps': 'Daily Steps',
      'active_minutes': 'Active Minutes',
      'calories_burned': 'Calories Burned',
      'activity_score': 'Activity Score',
      'readiness_score': 'Readiness Score',
      'stress_level': 'Stress Level',
      'body_battery': 'Body Battery',
      'respiratory_rate': 'Respiratory Rate',
      'spo2': 'Blood Oxygen (SpO2)'
    };
    return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get user-friendly label for mood metric
   */
  static getMoodMetricLabel(metric) {
    const labels = {
      'mood_score': 'Mood',
      'energy_level': 'Energy Level',
      'stress_level': 'Stress Level',
      'anxiety_level': 'Anxiety Level',
      'sleep_quality': 'Sleep Quality'
    };
    return labels[metric] || metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get correlation summary for dashboard display
   */
  static async getCorrelationSummary(userId) {
    try {
      const correlations = await WearableConnection.getCorrelations(userId);

      // Get significant correlations only
      const significant = correlations.filter(c => c.is_significant);

      // Group by mood metric
      const byMoodMetric = {};
      significant.forEach(c => {
        if (!byMoodMetric[c.mood_metric]) {
          byMoodMetric[c.mood_metric] = [];
        }
        byMoodMetric[c.mood_metric].push({
          biometricType: c.biometric_type,
          coefficient: parseFloat(c.pearson_coefficient),
          strength: c.correlation_strength,
          direction: c.direction
        });
      });

      // Sort each group by absolute correlation strength
      Object.keys(byMoodMetric).forEach(metric => {
        byMoodMetric[metric].sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
      });

      // Find strongest overall correlations
      const strongest = significant
        .sort((a, b) => Math.abs(parseFloat(b.pearson_coefficient)) - Math.abs(parseFloat(a.pearson_coefficient)))
        .slice(0, 5)
        .map(c => ({
          biometricType: c.biometric_type,
          moodMetric: c.mood_metric,
          coefficient: parseFloat(c.pearson_coefficient),
          strength: c.correlation_strength,
          direction: c.direction
        }));

      return {
        totalCorrelations: correlations.length,
        significantCount: significant.length,
        byMoodMetric,
        strongestCorrelations: strongest
      };
    } catch (error) {
      logger.error('Error getting correlation summary:', error);
      throw error;
    }
  }
}

module.exports = BiometricCorrelationService;

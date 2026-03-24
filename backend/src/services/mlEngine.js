/**
 * ML Engine Service
 * Provides statistical analysis and ML-like features using pure JavaScript
 * Structured for future TensorFlow.js integration
 */

/**
 * Calculate linear regression coefficients
 * @param {Array<number>} x - Independent variable values
 * @param {Array<number>} y - Dependent variable values
 * @returns {Object} slope, intercept, r2
 */
const linearRegression = (x, y) => {
  if (x.length !== y.length || x.length < 2) {
    return { slope: 0, intercept: 0, r2: 0 };
  }

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return { slope: 0, intercept: sumY / n, r2: 0 };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const ssTotal = y.reduce((acc, yi) => acc + Math.pow(yi - yMean, 2), 0);
  const ssResidual = y.reduce((acc, yi, i) => {
    const predicted = slope * x[i] + intercept;
    return acc + Math.pow(yi - predicted, 2);
  }, 0);

  const r2 = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  return { slope, intercept, r2: Math.max(0, r2) };
};

/**
 * Calculate Pearson correlation coefficient
 * @param {Array<number>} x - First variable
 * @param {Array<number>} y - Second variable
 * @returns {number} Correlation coefficient (-1 to 1)
 */
const pearsonCorrelation = (x, y) => {
  if (x.length !== y.length || x.length < 2) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
};

/**
 * Calculate Spearman rank correlation (for non-linear relationships)
 * @param {Array<number>} x - First variable
 * @param {Array<number>} y - Second variable
 * @returns {number} Spearman correlation coefficient
 */
const spearmanCorrelation = (x, y) => {
  if (x.length !== y.length || x.length < 2) return 0;

  const rankArray = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return arr.map(v => sorted.indexOf(v) + 1);
  };

  const rankX = rankArray(x);
  const rankY = rankArray(y);

  return pearsonCorrelation(rankX, rankY);
};

/**
 * Calculate moving average
 * @param {Array<number>} data - Data points
 * @param {number} window - Window size
 * @returns {Array<number>} Moving averages
 */
const movingAverage = (data, window = 3) => {
  if (data.length < window) return data;

  const result = [];
  for (let i = window - 1; i < data.length; i++) {
    const windowData = data.slice(i - window + 1, i + 1);
    result.push(windowData.reduce((a, b) => a + b, 0) / window);
  }
  return result;
};

/**
 * Calculate exponential moving average
 * @param {Array<number>} data - Data points
 * @param {number} alpha - Smoothing factor (0-1)
 * @returns {Array<number>} EMA values
 */
const exponentialMovingAverage = (data, alpha = 0.3) => {
  if (data.length === 0) return [];

  const result = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
};

/**
 * Detect anomalies using Z-score method
 * @param {Array<number>} data - Data points
 * @param {number} threshold - Z-score threshold (default 2)
 * @returns {Array<{index: number, value: number, zScore: number}>} Anomalies
 */
const detectAnomalies = (data, threshold = 2) => {
  if (data.length < 3) return [];

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const stdDev = Math.sqrt(
    data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length
  );

  if (stdDev === 0) return [];

  const anomalies = [];
  data.forEach((value, index) => {
    const zScore = (value - mean) / stdDev;
    if (Math.abs(zScore) > threshold) {
      anomalies.push({ index, value, zScore });
    }
  });

  return anomalies;
};

/**
 * K-means clustering
 * @param {Array<Array<number>>} data - Data points (2D array)
 * @param {number} k - Number of clusters
 * @param {number} maxIterations - Maximum iterations
 * @returns {Object} clusters, centroids, assignments
 */
const kMeansClustering = (data, k = 3, maxIterations = 100) => {
  if (data.length < k) {
    return { clusters: [data], centroids: [data[0] || []], assignments: data.map(() => 0) };
  }

  // Euclidean distance
  const distance = (a, b) => {
    return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
  };

  // Initialize centroids randomly
  let centroids = [];
  const indices = new Set();
  while (indices.size < k) {
    indices.add(Math.floor(Math.random() * data.length));
  }
  centroids = Array.from(indices).map(i => [...data[i]]);

  let assignments = new Array(data.length).fill(0);
  let changed = true;
  let iterations = 0;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    // Assign points to nearest centroid
    data.forEach((point, i) => {
      let minDist = Infinity;
      let minCluster = 0;

      centroids.forEach((centroid, j) => {
        const dist = distance(point, centroid);
        if (dist < minDist) {
          minDist = dist;
          minCluster = j;
        }
      });

      if (assignments[i] !== minCluster) {
        assignments[i] = minCluster;
        changed = true;
      }
    });

    // Update centroids
    centroids = centroids.map((_, j) => {
      const clusterPoints = data.filter((_, i) => assignments[i] === j);
      if (clusterPoints.length === 0) return centroids[j];

      return clusterPoints[0].map((_, dim) =>
        clusterPoints.reduce((sum, p) => sum + p[dim], 0) / clusterPoints.length
      );
    });
  }

  // Group data by cluster
  const clusters = centroids.map((_, j) =>
    data.filter((_, i) => assignments[i] === j)
  );

  return { clusters, centroids, assignments };
};

/**
 * Calculate statistics for a dataset
 * @param {Array<number>} data - Data points
 * @returns {Object} Statistics
 */
const calculateStatistics = (data) => {
  if (data.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, variance: 0 };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  return {
    mean,
    median,
    stdDev,
    variance,
    min: sorted[0],
    max: sorted[n - 1],
    count: n
  };
};

/**
 * Predict next value using weighted moving average
 * @param {Array<number>} data - Historical data
 * @param {number} window - Number of points to consider
 * @returns {Object} predicted value and confidence
 */
const predictNextValue = (data, window = 5) => {
  if (data.length < 2) {
    return { predicted: data[0] || 5, confidence: 0 };
  }

  const recentData = data.slice(-window);

  // Weighted average (more recent = higher weight)
  let weightedSum = 0;
  let weightTotal = 0;
  recentData.forEach((val, i) => {
    const weight = i + 1;
    weightedSum += val * weight;
    weightTotal += weight;
  });

  const predicted = weightedSum / weightTotal;

  // Calculate trend
  const regression = linearRegression(
    recentData.map((_, i) => i),
    recentData
  );

  // Adjust prediction based on trend
  const trendAdjusted = predicted + regression.slope;

  // Confidence based on R-squared and data consistency
  const stats = calculateStatistics(recentData);
  const coefficientOfVariation = stats.mean === 0 ? 1 : stats.stdDev / Math.abs(stats.mean);
  const consistency = Math.max(0, 1 - coefficientOfVariation);
  const confidence = (regression.r2 + consistency) / 2;

  return {
    predicted: Math.max(1, Math.min(10, trendAdjusted)),
    confidence: Math.min(1, Math.max(0, confidence)),
    trend: regression.slope > 0.1 ? 'improving' : regression.slope < -0.1 ? 'declining' : 'stable'
  };
};

/**
 * Find patterns in time series data
 * @param {Array<{date: string, value: number}>} data - Time series data
 * @returns {Object} Patterns found
 */
const findPatterns = (data) => {
  if (data.length < 7) {
    return { weekdayPattern: null, trendPattern: null, volatility: 'unknown' };
  }

  const values = data.map(d => d.value);

  // Analyze by day of week
  const weekdayValues = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  data.forEach(d => {
    const dayOfWeek = new Date(d.date).getDay();
    weekdayValues[dayOfWeek].push(d.value);
  });

  const weekdayAverages = {};
  Object.entries(weekdayValues).forEach(([day, vals]) => {
    if (vals.length > 0) {
      weekdayAverages[day] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  });

  // Find best and worst days
  let bestDay = null, worstDay = null;
  let bestAvg = -Infinity, worstAvg = Infinity;

  Object.entries(weekdayAverages).forEach(([day, avg]) => {
    if (avg > bestAvg) {
      bestAvg = avg;
      bestDay = parseInt(day);
    }
    if (avg < worstAvg) {
      worstAvg = avg;
      worstDay = parseInt(day);
    }
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Calculate volatility
  const stats = calculateStatistics(values);
  const volatility = stats.stdDev < 1 ? 'low' :
    stats.stdDev < 2 ? 'moderate' : 'high';

  // Overall trend
  const x = values.map((_, i) => i);
  const regression = linearRegression(x, values);
  const trendPattern = regression.slope > 0.1 ? 'improving' :
    regression.slope < -0.1 ? 'declining' : 'stable';

  return {
    weekdayPattern: bestDay !== null ? {
      bestDay: dayNames[bestDay],
      bestAverage: bestAvg,
      worstDay: dayNames[worstDay],
      worstAverage: worstAvg,
      variance: bestAvg - worstAvg
    } : null,
    trendPattern,
    volatility,
    statistics: stats
  };
};

/**
 * Calculate correlation matrix for multiple variables
 * @param {Object} variables - Object with variable names as keys and arrays as values
 * @returns {Object} Correlation matrix
 */
const correlationMatrix = (variables) => {
  const names = Object.keys(variables);
  const matrix = {};

  names.forEach(name1 => {
    matrix[name1] = {};
    names.forEach(name2 => {
      if (name1 === name2) {
        matrix[name1][name2] = 1;
      } else {
        matrix[name1][name2] = pearsonCorrelation(variables[name1], variables[name2]);
      }
    });
  });

  return matrix;
};

/**
 * Generate personalized insights using ML techniques
 * @param {Array<Object>} moodEntries - User's mood entries
 * @returns {Array<Object>} Insights
 */
const generateMLInsights = (moodEntries) => {
  if (moodEntries.length < 5) {
    return [{
      type: 'data_needed',
      title: 'More Data Needed',
      description: 'Continue tracking your mood for more personalized insights.',
      confidence: 0
    }];
  }

  const insights = [];

  // Extract data series
  const moods = moodEntries.map(e => e.mood_score);
  const stress = moodEntries.map(e => e.stress_level || 5);
  const energy = moodEntries.map(e => e.energy_level || 5);
  const anxiety = moodEntries.map(e => e.anxiety_level || 5);
  const sleep = moodEntries.map(e => e.sleep_hours || 7);

  // Predict next mood
  const moodPrediction = predictNextValue(moods);
  if (moodPrediction.confidence > 0.3) {
    insights.push({
      type: 'prediction',
      title: 'Mood Forecast',
      description: `Based on your recent patterns, your mood is likely to be ${moodPrediction.trend}. ` +
        `Expected score around ${moodPrediction.predicted.toFixed(1)}/10.`,
      confidence: moodPrediction.confidence,
      data: moodPrediction
    });
  }

  // Find correlations
  const correlations = correlationMatrix({ moods, stress, energy, sleep });

  // Sleep-mood correlation
  const sleepMoodCorr = correlations.moods?.sleep || 0;
  if (Math.abs(sleepMoodCorr) > 0.3) {
    insights.push({
      type: 'correlation',
      title: 'Sleep Impacts Your Mood',
      description: sleepMoodCorr > 0
        ? `Better sleep is associated with better moods for you (r=${sleepMoodCorr.toFixed(2)}).`
        : `Interestingly, sleep hours don't strongly correlate with your mood.`,
      confidence: Math.abs(sleepMoodCorr),
      data: { correlation: sleepMoodCorr, variable1: 'sleep', variable2: 'mood' }
    });
  }

  // Stress-mood correlation
  const stressMoodCorr = correlations.moods?.stress || 0;
  if (stressMoodCorr < -0.3) {
    insights.push({
      type: 'correlation',
      title: 'Stress Affects Your Mood',
      description: `Higher stress levels correlate with lower mood scores (r=${stressMoodCorr.toFixed(2)}). ` +
        `Stress management could significantly improve your wellbeing.`,
      confidence: Math.abs(stressMoodCorr),
      data: { correlation: stressMoodCorr, variable1: 'stress', variable2: 'mood' }
    });
  }

  // Detect anomalies
  const moodAnomalies = detectAnomalies(moods, 1.5);
  if (moodAnomalies.length > 0) {
    const lowAnomalies = moodAnomalies.filter(a => a.zScore < 0);
    if (lowAnomalies.length > 0) {
      insights.push({
        type: 'anomaly',
        title: 'Unusual Mood Dips Detected',
        description: `We noticed ${lowAnomalies.length} days with unusually low moods. ` +
          `Consider what might have triggered these dips.`,
        confidence: 0.7,
        data: lowAnomalies
      });
    }
  }

  // Pattern analysis
  const patterns = findPatterns(
    moodEntries.map(e => ({ date: e.entry_date, value: e.mood_score }))
  );

  if (patterns.weekdayPattern && patterns.weekdayPattern.variance > 1) {
    insights.push({
      type: 'pattern',
      title: 'Day of Week Pattern',
      description: `Your mood tends to be better on ${patterns.weekdayPattern.bestDay}s ` +
        `(avg: ${patterns.weekdayPattern.bestAverage.toFixed(1)}) ` +
        `and lower on ${patterns.weekdayPattern.worstDay}s ` +
        `(avg: ${patterns.weekdayPattern.worstAverage.toFixed(1)}).`,
      confidence: 0.6,
      data: patterns.weekdayPattern
    });
  }

  // Volatility insight
  if (patterns.volatility === 'high') {
    insights.push({
      type: 'volatility',
      title: 'Mood Variability',
      description: 'Your mood shows significant day-to-day variation. ' +
        'This is common but establishing routines can help stabilize it.',
      confidence: 0.8,
      data: { volatility: patterns.volatility, stdDev: patterns.statistics?.stdDev }
    });
  }

  return insights.sort((a, b) => b.confidence - a.confidence);
};

module.exports = {
  linearRegression,
  pearsonCorrelation,
  spearmanCorrelation,
  movingAverage,
  exponentialMovingAverage,
  detectAnomalies,
  kMeansClustering,
  calculateStatistics,
  predictNextValue,
  findPatterns,
  correlationMatrix,
  generateMLInsights
};

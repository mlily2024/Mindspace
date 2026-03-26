/**
 * Predictive Engine Service
 * Per-user mood prediction using weighted linear regression.
 *
 * Collects feature vectors from mood history, sleep, day-of-week, activities,
 * weather, voice deviations, and EMA variability. Trains a simple statistical
 * model per user (no external ML library) and generates 1-3 day forward
 * predictions with confidence intervals and preventive action suggestions.
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');
const { format, subDays, addDays, differenceInDays, getDay } = require('date-fns');

// Maps risk factors to preventive action suggestions
const PREVENTIVE_ACTIONS = {
  sleep_deficit: 'Prioritise 7+ hours of sleep tonight',
  low_activity: 'Try a 20-minute walk or light exercise',
  high_stress_trend: 'Schedule a 10-minute decompression break',
  social_isolation: 'Reach out to a friend or join a peer support group',
  weather_overcast: 'Plan an indoor activity you enjoy',
  day_of_week_risk: 'This day is historically harder for you — pre-load with a mood-boosting activity',
  high_variability: 'Your mood has been volatile — try a grounding exercise this morning'
};

class PredictiveEngineService {
  /**
   * Assemble a feature vector for a given user and date from multiple tables.
   * @param {string} userId
   * @param {string} date - ISO date string (YYYY-MM-DD)
   * @returns {object|null} feature vector or null if insufficient data
   */
  static async buildFeatureVector(userId, date) {
    try {
      const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
      const dayOfWeek = getDay(new Date(dateStr));

      // Mood history: average of last 3 days, last 7 days, and the day itself
      const moodResult = await db.query(
        `SELECT
           (SELECT AVG(mood_score) FROM mood_entries
            WHERE user_id = $1 AND DATE(created_at) = $2) AS mood_today,
           (SELECT AVG(mood_score) FROM mood_entries
            WHERE user_id = $1 AND DATE(created_at) BETWEEN ($2::date - INTERVAL '3 days') AND ($2::date - INTERVAL '1 day')) AS mood_avg_3d,
           (SELECT AVG(mood_score) FROM mood_entries
            WHERE user_id = $1 AND DATE(created_at) BETWEEN ($2::date - INTERVAL '7 days') AND ($2::date - INTERVAL '1 day')) AS mood_avg_7d,
           (SELECT STDDEV(mood_score) FROM mood_entries
            WHERE user_id = $1 AND DATE(created_at) BETWEEN ($2::date - INTERVAL '7 days') AND ($2::date - INTERVAL '1 day')) AS mood_variability_7d`,
        [userId, dateStr]
      );

      // Sleep data
      const sleepResult = await db.query(
        `SELECT duration_hours, quality_score
         FROM sleep_records
         WHERE user_id = $1 AND DATE(date) = $2
         LIMIT 1`,
        [userId, dateStr]
      );

      // Activity count
      const activityResult = await db.query(
        `SELECT COUNT(*) AS activity_count
         FROM activities
         WHERE user_id = $1 AND DATE(created_at) = $2`,
        [userId, dateStr]
      );

      // Weather conditions
      const weatherResult = await db.query(
        `SELECT condition, temperature
         FROM weather_records
         WHERE user_id = $1 AND DATE(recorded_at) = $2
         ORDER BY recorded_at DESC LIMIT 1`,
        [userId, dateStr]
      );

      // Voice deviation score (average for the day)
      const voiceResult = await db.query(
        `SELECT AVG(deviation_score) AS avg_deviation
         FROM voice_signature_samples
         WHERE user_id = $1 AND DATE(recorded_at) = $2`,
        [userId, dateStr]
      );

      // EMA variability (standard deviation of intra-day mood check-ins)
      const emaResult = await db.query(
        `SELECT STDDEV(mood_score) AS ema_variability
         FROM mood_entries
         WHERE user_id = $1 AND DATE(created_at) = $2`,
        [userId, dateStr]
      );

      const mood = moodResult.rows[0];
      const sleep = sleepResult.rows[0] || {};
      const activity = activityResult.rows[0] || {};
      const weather = weatherResult.rows[0] || {};
      const voice = voiceResult.rows[0] || {};
      const ema = emaResult.rows[0] || {};

      // One-hot encode day of week (7 features)
      const dayFeatures = {};
      for (let d = 0; d < 7; d++) {
        dayFeatures[`day_${d}`] = dayOfWeek === d ? 1 : 0;
      }

      // Weather encoded as overcast flag
      const isOvercast = weather.condition
        ? ['overcast', 'cloudy', 'rain', 'storm'].some(c => weather.condition.toLowerCase().includes(c))
        : false;

      return {
        date: dateStr,
        mood_today: mood.mood_today ? parseFloat(mood.mood_today) : null,
        mood_avg_3d: mood.mood_avg_3d ? parseFloat(mood.mood_avg_3d) : null,
        mood_avg_7d: mood.mood_avg_7d ? parseFloat(mood.mood_avg_7d) : null,
        mood_variability_7d: mood.mood_variability_7d ? parseFloat(mood.mood_variability_7d) : null,
        sleep_hours: sleep.duration_hours ? parseFloat(sleep.duration_hours) : null,
        sleep_quality: sleep.quality_score ? parseFloat(sleep.quality_score) : null,
        activity_count: parseInt(activity.activity_count) || 0,
        weather_overcast: isOvercast ? 1 : 0,
        temperature: weather.temperature ? parseFloat(weather.temperature) : null,
        voice_deviation: voice.avg_deviation ? parseFloat(voice.avg_deviation) : null,
        ema_variability: ema.ema_variability ? parseFloat(ema.ema_variability) : null,
        ...dayFeatures
      };
    } catch (error) {
      logger.error('Error building feature vector', { userId, date, error: error.message });
      throw error;
    }
  }

  /**
   * Train or update the user's prediction model using weighted linear regression
   * with exponential decay (recent data weighted more).
   * Requires at least 14 days of data.
   * @param {string} userId
   * @returns {object} training result with model metadata
   */
  static async trainModel(userId) {
    try {
      // Gather training data: one feature vector per day for last 90 days
      const endDate = new Date();
      const startDate = subDays(endDate, 90);
      const vectors = [];

      for (let d = new Date(startDate); d <= subDays(endDate, 1); d = addDays(d, 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        const vec = await this.buildFeatureVector(userId, dateStr);

        // We need the NEXT day's mood as the target
        const nextDateStr = format(addDays(d, 1), 'yyyy-MM-dd');
        const targetResult = await db.query(
          `SELECT AVG(mood_score) AS target_mood
           FROM mood_entries
           WHERE user_id = $1 AND DATE(created_at) = $2`,
          [userId, nextDateStr]
        );

        const targetMood = targetResult.rows[0]?.target_mood;
        if (targetMood != null && vec && vec.mood_avg_3d != null) {
          vectors.push({ features: vec, target: parseFloat(targetMood) });
        }
      }

      if (vectors.length < 14) {
        return {
          status: 'insufficient_data',
          message: `Need at least 14 days of data to train. You have ${vectors.length}.`,
          dataPointsNeeded: 14 - vectors.length
        };
      }

      // Select numeric feature keys (exclude date and null-heavy columns)
      const featureKeys = this._selectFeatureKeys(vectors);

      // Build design matrix X and target vector y with exponential decay weights
      const n = vectors.length;
      const decayRate = 0.03; // lambda for exponential decay
      const X = [];
      const y = [];
      const weights = [];

      for (let i = 0; i < n; i++) {
        const row = [1]; // bias term
        for (const key of featureKeys) {
          row.push(vectors[i].features[key] ?? 0);
        }
        X.push(row);
        y.push(vectors[i].target);
        // More recent data gets higher weight
        weights.push(Math.exp(-decayRate * (n - 1 - i)));
      }

      // Weighted linear regression: (X^T W X)^{-1} X^T W y
      const coefficients = this._weightedLinearRegression(X, y, weights);

      // Compute in-sample accuracy (R-squared and MAE)
      const predictions = X.map(row => this._dotProduct(row, coefficients));
      const meanY = y.reduce((s, v) => s + v, 0) / y.length;
      let ssRes = 0;
      let ssTot = 0;
      let absErrors = 0;

      for (let i = 0; i < y.length; i++) {
        ssRes += (y[i] - predictions[i]) ** 2;
        ssTot += (y[i] - meanY) ** 2;
        absErrors += Math.abs(y[i] - predictions[i]);
      }

      const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
      const mae = absErrors / y.length;
      const residualStd = Math.sqrt(ssRes / Math.max(1, y.length - featureKeys.length - 1));

      // Store model parameters as JSONB
      const modelData = {
        coefficients,
        featureKeys,
        rSquared,
        mae,
        residualStd,
        trainingDataPoints: n,
        trainedAt: new Date().toISOString()
      };

      await db.query(
        `INSERT INTO predictive_engine_models (id, user_id, model_data, accuracy_r2, accuracy_mae, training_data_points, trained_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           model_data = $3,
           accuracy_r2 = $4,
           accuracy_mae = $5,
           training_data_points = $6,
           trained_at = NOW()`,
        [uuidv4(), userId, JSON.stringify(modelData), rSquared, mae, n]
      );

      logger.info('Prediction model trained', { userId, dataPoints: n, rSquared, mae });

      return {
        status: 'trained',
        dataPoints: n,
        features: featureKeys.length,
        accuracy: { rSquared, mae },
        residualStd
      };
    } catch (error) {
      logger.error('Error training prediction model', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Predict mood for a specific target date.
   * @param {string} userId
   * @param {string|Date} targetDate
   * @returns {object} {predictedMood, confidence, contributingFactors[], preventiveActions[]}
   */
  static async predict(userId, targetDate) {
    try {
      const targetDateStr = typeof targetDate === 'string' ? targetDate : format(targetDate, 'yyyy-MM-dd');

      // Load model
      const modelResult = await db.query(
        `SELECT model_data, accuracy_r2, training_data_points FROM predictive_engine_models WHERE user_id = $1`,
        [userId]
      );

      if (modelResult.rows.length === 0) {
        return { status: 'no_model', message: 'No trained model found. Call trainModel first.' };
      }

      const model = typeof modelResult.rows[0].model_data === 'string'
        ? JSON.parse(modelResult.rows[0].model_data)
        : modelResult.rows[0].model_data;

      // Build feature vector for the day before the target (to predict target day)
      const inputDate = subDays(new Date(targetDateStr), 1);
      const features = await this.buildFeatureVector(userId, format(inputDate, 'yyyy-MM-dd'));

      if (!features) {
        return { status: 'insufficient_features', message: 'Cannot build features for prediction input date.' };
      }

      // Assemble input row
      const row = [1]; // bias
      for (const key of model.featureKeys) {
        row.push(features[key] ?? 0);
      }

      const predictedMood = Math.min(10, Math.max(1, this._dotProduct(row, model.coefficients)));

      // Confidence scoring
      const trainingPoints = model.trainingDataPoints || parseInt(modelResult.rows[0].training_data_points) || 0;
      const accuracy = model.rSquared || parseFloat(modelResult.rows[0].accuracy_r2) || 0;
      const confidence = Math.min(0.95, 0.4 + (trainingPoints / 100) * 0.3 + accuracy * 0.3);

      // Confidence interval using residual std
      const residualStd = model.residualStd || 1;
      const ciHalf = 1.96 * residualStd;

      // Identify risk factors and contributing factors
      const { contributingFactors, riskFactors } = this._identifyFactors(features, model);

      // Map risk factors to preventive actions
      const preventiveActions = riskFactors.map(rf => ({
        riskFactor: rf,
        action: PREVENTIVE_ACTIONS[rf] || `Address ${rf.replace(/_/g, ' ')}`
      }));

      return {
        status: 'ok',
        targetDate: targetDateStr,
        predictedMood: Math.round(predictedMood * 100) / 100,
        confidence: Math.round(confidence * 1000) / 1000,
        confidenceInterval: {
          low: Math.max(1, Math.round((predictedMood - ciHalf) * 100) / 100),
          high: Math.min(10, Math.round((predictedMood + ciHalf) * 100) / 100)
        },
        contributingFactors,
        preventiveActions
      };
    } catch (error) {
      logger.error('Error predicting mood', { userId, targetDate, error: error.message });
      throw error;
    }
  }

  /**
   * Generate predictions for the next N days.
   * @param {string} userId
   * @param {number} daysAhead - 1 to 3 recommended
   * @returns {object} array of predictions
   */
  static async generatePredictions(userId, daysAhead = 3) {
    try {
      const predictions = [];
      const today = new Date();

      for (let i = 1; i <= daysAhead; i++) {
        const targetDate = addDays(today, i);
        const prediction = await this.predict(userId, targetDate);

        if (prediction.status === 'ok') {
          // Persist prediction for later accuracy evaluation
          await db.query(
            `INSERT INTO predictive_engine_predictions
               (id, user_id, target_date, predicted_mood, confidence, confidence_low, confidence_high,
                contributing_factors, preventive_actions, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            [
              uuidv4(),
              userId,
              prediction.targetDate,
              prediction.predictedMood,
              prediction.confidence,
              prediction.confidenceInterval.low,
              prediction.confidenceInterval.high,
              JSON.stringify(prediction.contributingFactors),
              JSON.stringify(prediction.preventiveActions)
            ]
          );
        }

        predictions.push(prediction);
      }

      logger.info('Predictions generated', { userId, count: predictions.length });

      return { predictions };
    } catch (error) {
      logger.error('Error generating predictions', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Evaluate accuracy by comparing past predictions with actual mood entries.
   * @param {string} userId
   * @returns {object} accuracy metrics
   */
  static async evaluateAccuracy(userId) {
    try {
      const result = await db.query(
        `SELECT p.target_date, p.predicted_mood, p.confidence,
                AVG(m.mood_score) AS actual_mood
         FROM predictive_engine_predictions p
         JOIN mood_entries m ON m.user_id = p.user_id AND DATE(m.created_at) = p.target_date
         WHERE p.user_id = $1
         GROUP BY p.target_date, p.predicted_mood, p.confidence
         ORDER BY p.target_date DESC`,
        [userId]
      );

      const rows = result.rows;
      if (rows.length === 0) {
        return { status: 'no_evaluated_predictions', message: 'No past predictions with matching actual mood data yet.' };
      }

      let totalAbsError = 0;
      let totalSquaredError = 0;
      let withinOnePoint = 0;

      for (const row of rows) {
        const predicted = parseFloat(row.predicted_mood);
        const actual = parseFloat(row.actual_mood);
        const error = Math.abs(predicted - actual);

        totalAbsError += error;
        totalSquaredError += error ** 2;
        if (error <= 1) withinOnePoint++;
      }

      const mae = totalAbsError / rows.length;
      const rmse = Math.sqrt(totalSquaredError / rows.length);
      const withinOnePointPct = (withinOnePoint / rows.length) * 100;

      return {
        status: 'ok',
        evaluatedPredictions: rows.length,
        mae: Math.round(mae * 1000) / 1000,
        rmse: Math.round(rmse * 1000) / 1000,
        withinOnePointPct: Math.round(withinOnePointPct * 10) / 10,
        recentPredictions: rows.slice(0, 10).map(r => ({
          date: r.target_date,
          predicted: parseFloat(r.predicted_mood),
          actual: parseFloat(r.actual_mood),
          error: Math.abs(parseFloat(r.predicted_mood) - parseFloat(r.actual_mood))
        }))
      };
    } catch (error) {
      logger.error('Error evaluating accuracy', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get model metadata for a user.
   * @param {string} userId
   * @returns {object} model info
   */
  static async getModelInfo(userId) {
    try {
      const result = await db.query(
        `SELECT model_data, accuracy_r2, accuracy_mae, training_data_points, trained_at
         FROM predictive_engine_models
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return { status: 'no_model', message: 'No model trained yet for this user.' };
      }

      const row = result.rows[0];
      const model = typeof row.model_data === 'string' ? JSON.parse(row.model_data) : row.model_data;

      return {
        status: 'ok',
        trainingDataPoints: row.training_data_points,
        accuracy: {
          rSquared: parseFloat(row.accuracy_r2),
          mae: parseFloat(row.accuracy_mae)
        },
        featureCount: model.featureKeys ? model.featureKeys.length : 0,
        features: model.featureKeys || [],
        lastTrained: row.trained_at
      };
    } catch (error) {
      logger.error('Error fetching model info', { userId, error: error.message });
      throw error;
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────

  /**
   * Select feature keys that have enough non-null values across training vectors.
   */
  static _selectFeatureKeys(vectors) {
    const candidateKeys = [
      'mood_avg_3d', 'mood_avg_7d', 'mood_variability_7d',
      'sleep_hours', 'sleep_quality', 'activity_count',
      'weather_overcast', 'voice_deviation', 'ema_variability',
      'day_0', 'day_1', 'day_2', 'day_3', 'day_4', 'day_5', 'day_6'
    ];

    // Keep features where at least 50% of vectors have non-null values
    const threshold = vectors.length * 0.5;
    return candidateKeys.filter(key => {
      const nonNull = vectors.filter(v => v.features[key] != null).length;
      return nonNull >= threshold;
    });
  }

  /**
   * Weighted linear regression using normal equations.
   * Solves: (X^T W X)^{-1} X^T W y
   */
  static _weightedLinearRegression(X, y, weights) {
    const p = X[0].length; // number of parameters (including bias)
    const n = X.length;

    // XtWX = X^T * W * X  (p x p)
    const XtWX = Array.from({ length: p }, () => Array(p).fill(0));
    // XtWy = X^T * W * y  (p x 1)
    const XtWy = Array(p).fill(0);

    for (let i = 0; i < n; i++) {
      const w = weights[i];
      for (let j = 0; j < p; j++) {
        XtWy[j] += X[i][j] * w * y[i];
        for (let k = 0; k < p; k++) {
          XtWX[j][k] += X[i][j] * w * X[i][k];
        }
      }
    }

    // Add small ridge term for numerical stability
    for (let j = 0; j < p; j++) {
      XtWX[j][j] += 1e-6;
    }

    // Solve via Gauss-Jordan elimination
    return this._solveLinearSystem(XtWX, XtWy);
  }

  /**
   * Solve a linear system Ax = b using Gauss-Jordan elimination with partial pivoting.
   */
  static _solveLinearSystem(A, b) {
    const n = A.length;
    // Augmented matrix
    const aug = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col++) {
      // Partial pivoting
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
          maxRow = row;
        }
      }
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

      const pivot = aug[col][col];
      if (Math.abs(pivot) < 1e-12) continue;

      // Scale pivot row
      for (let j = col; j <= n; j++) {
        aug[col][j] /= pivot;
      }

      // Eliminate column
      for (let row = 0; row < n; row++) {
        if (row === col) continue;
        const factor = aug[row][col];
        for (let j = col; j <= n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }

    return aug.map(row => row[n]);
  }

  /**
   * Dot product of two arrays.
   */
  static _dotProduct(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += (a[i] || 0) * (b[i] || 0);
    }
    return sum;
  }

  /**
   * Identify contributing factors and risk flags from features and model coefficients.
   */
  static _identifyFactors(features, model) {
    const contributingFactors = [];
    const riskFactors = [];

    // Sleep deficit
    if (features.sleep_hours != null && features.sleep_hours < 6) {
      contributingFactors.push({ factor: 'sleep_deficit', value: features.sleep_hours, impact: 'negative' });
      riskFactors.push('sleep_deficit');
    }

    // Low activity
    if (features.activity_count != null && features.activity_count === 0) {
      contributingFactors.push({ factor: 'low_activity', value: features.activity_count, impact: 'negative' });
      riskFactors.push('low_activity');
    }

    // High stress trend (mood trending down over 3 days)
    if (features.mood_avg_3d != null && features.mood_avg_7d != null && features.mood_avg_3d < features.mood_avg_7d - 0.5) {
      contributingFactors.push({ factor: 'high_stress_trend', value: features.mood_avg_3d, impact: 'negative' });
      riskFactors.push('high_stress_trend');
    }

    // Social isolation proxy: no activities
    if (features.activity_count != null && features.activity_count <= 1 && features.mood_avg_3d != null && features.mood_avg_3d < 5) {
      riskFactors.push('social_isolation');
    }

    // Weather overcast
    if (features.weather_overcast === 1) {
      contributingFactors.push({ factor: 'weather_overcast', value: 1, impact: 'negative' });
      riskFactors.push('weather_overcast');
    }

    // Day of week risk: check if this day historically scores lower
    const dayIndex = Object.keys(features).find(k => k.startsWith('day_') && features[k] === 1);
    if (dayIndex) {
      const idx = model.featureKeys.indexOf(dayIndex);
      if (idx !== -1 && model.coefficients[idx + 1] < -0.3) {
        contributingFactors.push({ factor: 'day_of_week_risk', value: dayIndex, impact: 'negative' });
        riskFactors.push('day_of_week_risk');
      }
    }

    // High mood variability
    if (features.mood_variability_7d != null && features.mood_variability_7d > 1.5) {
      contributingFactors.push({ factor: 'high_variability', value: features.mood_variability_7d, impact: 'negative' });
      riskFactors.push('high_variability');
    }

    // Positive factors
    if (features.sleep_hours != null && features.sleep_hours >= 7) {
      contributingFactors.push({ factor: 'good_sleep', value: features.sleep_hours, impact: 'positive' });
    }
    if (features.activity_count != null && features.activity_count >= 3) {
      contributingFactors.push({ factor: 'active_day', value: features.activity_count, impact: 'positive' });
    }
    if (features.mood_avg_3d != null && features.mood_avg_3d > 7) {
      contributingFactors.push({ factor: 'positive_trend', value: features.mood_avg_3d, impact: 'positive' });
    }

    return { contributingFactors, riskFactors };
  }
}

module.exports = PredictiveEngineService;

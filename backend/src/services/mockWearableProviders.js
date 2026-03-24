const { v4: uuidv4 } = require('uuid');

/**
 * Mock Wearable Providers
 * Simulates OAuth flows and data from Apple HealthKit, Oura Ring, and Fitbit
 * Used for development and testing without real API credentials
 */

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Generate random number within range
 */
const randomInRange = (min, max, decimals = 0) => {
  const value = Math.random() * (max - min) + min;
  return decimals > 0 ? parseFloat(value.toFixed(decimals)) : Math.round(value);
};

/**
 * Generate random variation around a base value
 */
const randomVariation = (base, variationPercent = 0.1) => {
  const variation = base * variationPercent;
  return base + (Math.random() * variation * 2 - variation);
};

/**
 * Generate dates for a range
 */
const generateDateRange = (startDate, endDate) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(new Date(current).toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

// ===========================================
// BASE MOCK PROVIDER
// ===========================================

class BaseMockProvider {
  constructor(deviceType) {
    this.deviceType = deviceType;
  }

  /**
   * Simulate OAuth authorization
   */
  async authorize(userId) {
    // Simulate OAuth delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      accessToken: `mock_${this.deviceType}_token_${uuidv4()}`,
      refreshToken: `mock_${this.deviceType}_refresh_${uuidv4()}`,
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      permissionsGranted: this.getDefaultPermissions()
    };
  }

  /**
   * Simulate token refresh
   */
  async refreshToken(refreshToken) {
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      accessToken: `mock_${this.deviceType}_token_${uuidv4()}`,
      refreshToken: refreshToken, // Keep same refresh token
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }

  /**
   * Get default permissions for device type
   */
  getDefaultPermissions() {
    return ['sleep', 'heart_rate', 'activity', 'hrv'];
  }

  /**
   * Simulate sync delay
   */
  async simulateSyncDelay() {
    const delay = randomInRange(500, 1500);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// ===========================================
// APPLE HEALTHKIT MOCK PROVIDER
// ===========================================

class MockAppleHealthProvider extends BaseMockProvider {
  constructor() {
    super('apple_health');
  }

  getDefaultPermissions() {
    return [
      'sleep_analysis',
      'heart_rate',
      'heart_rate_variability',
      'step_count',
      'active_energy_burned',
      'workout',
      'mindfulness',
      'respiratory_rate'
    ];
  }

  /**
   * Generate mock HealthKit data
   */
  async fetchData(userId, startDate, endDate) {
    await this.simulateSyncDelay();

    const dates = generateDateRange(startDate, endDate);
    const data = [];

    // Generate user-specific base values for consistency
    const userSeed = userId.charCodeAt(0) / 255;
    const baseHRV = 35 + userSeed * 30; // 35-65 ms
    const baseRestingHR = 55 + userSeed * 20; // 55-75 bpm
    const baseSleepHours = 6.5 + userSeed * 2; // 6.5-8.5 hours

    for (const date of dates) {
      // Sleep data
      const sleepHours = randomVariation(baseSleepHours, 0.15);
      const sleepQuality = Math.min(10, Math.max(1, Math.round(sleepHours * 1.2 + randomInRange(-1, 1))));

      data.push({
        dataDate: date,
        dataType: 'sleep_duration',
        valueNumeric: parseFloat(sleepHours.toFixed(1)),
        unit: 'hours',
        source: 'apple_health',
        recordedAt: new Date(`${date}T07:00:00Z`),
        qualityScore: 0.95
      });

      data.push({
        dataDate: date,
        dataType: 'sleep_quality',
        valueNumeric: sleepQuality,
        unit: 'score',
        source: 'apple_health',
        recordedAt: new Date(`${date}T07:00:00Z`),
        qualityScore: 0.9
      });

      // Sleep stages
      const deepSleep = sleepHours * randomInRange(15, 25) / 100; // 15-25% deep
      const remSleep = sleepHours * randomInRange(20, 30) / 100; // 20-30% REM
      const lightSleep = sleepHours - deepSleep - remSleep;

      data.push({
        dataDate: date,
        dataType: 'sleep_stages',
        valueJson: {
          deep: parseFloat(deepSleep.toFixed(2)),
          rem: parseFloat(remSleep.toFixed(2)),
          light: parseFloat(lightSleep.toFixed(2)),
          awake: parseFloat(randomInRange(0.2, 0.8, 2))
        },
        unit: 'hours',
        source: 'apple_health',
        recordedAt: new Date(`${date}T07:00:00Z`),
        qualityScore: 0.85
      });

      // Heart rate variability (HRV)
      const hrvValue = randomVariation(baseHRV, 0.2);
      data.push({
        dataDate: date,
        dataType: 'hrv',
        valueNumeric: parseFloat(hrvValue.toFixed(1)),
        unit: 'ms',
        source: 'apple_health',
        recordedAt: new Date(`${date}T08:00:00Z`),
        qualityScore: 0.92
      });

      // HRV RMSSD (more specific metric)
      data.push({
        dataDate: date,
        dataType: 'hrv_rmssd',
        valueNumeric: parseFloat((hrvValue * 1.1).toFixed(1)),
        unit: 'ms',
        source: 'apple_health',
        recordedAt: new Date(`${date}T08:00:00Z`),
        qualityScore: 0.92
      });

      // Resting heart rate
      const restingHR = randomVariation(baseRestingHR, 0.1);
      data.push({
        dataDate: date,
        dataType: 'resting_heart_rate',
        valueNumeric: Math.round(restingHR),
        unit: 'bpm',
        source: 'apple_health',
        recordedAt: new Date(`${date}T09:00:00Z`),
        qualityScore: 0.98
      });

      // Steps
      const steps = randomInRange(4000, 15000);
      data.push({
        dataDate: date,
        dataType: 'steps',
        valueNumeric: steps,
        unit: 'steps',
        source: 'apple_health',
        recordedAt: new Date(`${date}T23:59:00Z`),
        qualityScore: 0.99
      });

      // Active minutes
      const activeMinutes = randomInRange(15, 90);
      data.push({
        dataDate: date,
        dataType: 'active_minutes',
        valueNumeric: activeMinutes,
        unit: 'minutes',
        source: 'apple_health',
        recordedAt: new Date(`${date}T23:59:00Z`),
        qualityScore: 0.95
      });

      // Calories burned
      const calories = 1800 + steps * 0.04 + activeMinutes * 5;
      data.push({
        dataDate: date,
        dataType: 'calories_burned',
        valueNumeric: Math.round(calories),
        unit: 'kcal',
        source: 'apple_health',
        recordedAt: new Date(`${date}T23:59:00Z`),
        qualityScore: 0.85
      });

      // Respiratory rate (during sleep)
      data.push({
        dataDate: date,
        dataType: 'respiratory_rate',
        valueNumeric: randomInRange(12, 18, 1),
        unit: 'breaths/min',
        source: 'apple_health',
        recordedAt: new Date(`${date}T06:00:00Z`),
        qualityScore: 0.88
      });
    }

    return data;
  }
}

// ===========================================
// OURA RING MOCK PROVIDER
// ===========================================

class MockOuraProvider extends BaseMockProvider {
  constructor() {
    super('oura');
  }

  getDefaultPermissions() {
    return [
      'daily_sleep',
      'daily_readiness',
      'daily_activity',
      'heart_rate',
      'daily_spo2'
    ];
  }

  /**
   * Generate mock Oura Ring data
   */
  async fetchData(userId, startDate, endDate) {
    await this.simulateSyncDelay();

    const dates = generateDateRange(startDate, endDate);
    const data = [];

    // Oura-specific user baselines
    const userSeed = userId.charCodeAt(0) / 255;
    const baseReadiness = 70 + userSeed * 20; // 70-90
    const baseHRV = 30 + userSeed * 35; // 30-65 ms
    const baseSleepScore = 75 + userSeed * 15; // 75-90

    for (const date of dates) {
      // Readiness score (Oura's unique metric)
      const readinessScore = Math.round(randomVariation(baseReadiness, 0.12));
      data.push({
        dataDate: date,
        dataType: 'readiness_score',
        valueNumeric: Math.min(100, Math.max(0, readinessScore)),
        valueJson: {
          contributors: {
            sleep_balance: randomInRange(70, 95),
            previous_night: randomInRange(60, 95),
            activity_balance: randomInRange(65, 95),
            body_temperature: randomInRange(80, 100),
            hrv_balance: randomInRange(70, 95),
            recovery_index: randomInRange(75, 98)
          }
        },
        unit: 'score',
        source: 'oura',
        recordedAt: new Date(`${date}T08:00:00Z`),
        qualityScore: 0.95
      });

      // Activity score
      const activityScore = randomInRange(50, 100);
      data.push({
        dataDate: date,
        dataType: 'activity_score',
        valueNumeric: activityScore,
        valueJson: {
          steps: randomInRange(4000, 15000),
          active_calories: randomInRange(200, 800),
          total_calories: randomInRange(1800, 3000),
          low_activity_time: randomInRange(300, 600),
          medium_activity_time: randomInRange(20, 120),
          high_activity_time: randomInRange(0, 60),
          met_min_inactive: randomInRange(50, 200),
          met_min_low: randomInRange(100, 400),
          met_min_medium: randomInRange(50, 300),
          met_min_high: randomInRange(0, 200)
        },
        unit: 'score',
        source: 'oura',
        recordedAt: new Date(`${date}T23:00:00Z`),
        qualityScore: 0.93
      });

      // Sleep data
      const sleepScore = Math.round(randomVariation(baseSleepScore, 0.1));
      const totalSleep = 6 + (sleepScore / 100) * 3; // Higher score = more sleep

      data.push({
        dataDate: date,
        dataType: 'sleep_duration',
        valueNumeric: parseFloat(totalSleep.toFixed(1)),
        unit: 'hours',
        source: 'oura',
        recordedAt: new Date(`${date}T07:00:00Z`),
        qualityScore: 0.96
      });

      data.push({
        dataDate: date,
        dataType: 'sleep_quality',
        valueNumeric: Math.round(sleepScore / 10), // Convert to 1-10 scale
        valueJson: {
          sleep_score: sleepScore,
          efficiency: randomInRange(75, 98),
          restfulness: randomInRange(70, 95),
          rem_sleep_duration: parseFloat((totalSleep * randomInRange(18, 28) / 100).toFixed(2)),
          deep_sleep_duration: parseFloat((totalSleep * randomInRange(12, 22) / 100).toFixed(2)),
          light_sleep_duration: parseFloat((totalSleep * randomInRange(45, 60) / 100).toFixed(2)),
          awake_time: parseFloat(randomInRange(0.2, 1.0, 2)),
          latency: randomInRange(5, 30)
        },
        unit: 'score',
        source: 'oura',
        recordedAt: new Date(`${date}T07:00:00Z`),
        qualityScore: 0.94
      });

      // HRV (average during sleep)
      const hrvAverage = randomVariation(baseHRV, 0.2);
      data.push({
        dataDate: date,
        dataType: 'hrv',
        valueNumeric: parseFloat(hrvAverage.toFixed(1)),
        valueJson: {
          average: parseFloat(hrvAverage.toFixed(1)),
          max: parseFloat((hrvAverage * 1.5).toFixed(1)),
          min: parseFloat((hrvAverage * 0.6).toFixed(1))
        },
        unit: 'ms',
        source: 'oura',
        recordedAt: new Date(`${date}T06:00:00Z`),
        qualityScore: 0.91
      });

      // Resting heart rate
      data.push({
        dataDate: date,
        dataType: 'resting_heart_rate',
        valueNumeric: randomInRange(50, 70),
        valueJson: {
          lowest: randomInRange(45, 60),
          average: randomInRange(55, 68)
        },
        unit: 'bpm',
        source: 'oura',
        recordedAt: new Date(`${date}T06:00:00Z`),
        qualityScore: 0.97
      });

      // SpO2 (blood oxygen)
      data.push({
        dataDate: date,
        dataType: 'spo2',
        valueNumeric: randomInRange(95, 100, 1),
        valueJson: {
          average: randomInRange(96, 99, 1),
          lowest: randomInRange(92, 97, 1)
        },
        unit: '%',
        source: 'oura',
        recordedAt: new Date(`${date}T06:00:00Z`),
        qualityScore: 0.88
      });

      // Body temperature deviation
      data.push({
        dataDate: date,
        dataType: 'body_battery',
        valueNumeric: randomInRange(-0.5, 0.5, 2),
        unit: 'celsius_deviation',
        source: 'oura',
        recordedAt: new Date(`${date}T06:00:00Z`),
        qualityScore: 0.85
      });
    }

    return data;
  }
}

// ===========================================
// FITBIT MOCK PROVIDER
// ===========================================

class MockFitbitProvider extends BaseMockProvider {
  constructor() {
    super('fitbit');
  }

  getDefaultPermissions() {
    return [
      'sleep',
      'heartrate',
      'activity',
      'weight',
      'nutrition',
      'oxygen_saturation'
    ];
  }

  /**
   * Generate mock Fitbit data
   */
  async fetchData(userId, startDate, endDate) {
    await this.simulateSyncDelay();

    const dates = generateDateRange(startDate, endDate);
    const data = [];

    // Fitbit-specific user baselines
    const userSeed = userId.charCodeAt(0) / 255;
    const baseRestingHR = 58 + userSeed * 18; // 58-76 bpm
    const baseSleepHours = 6.5 + userSeed * 2;

    for (const date of dates) {
      // Sleep data
      const sleepMinutes = Math.round(randomVariation(baseSleepHours * 60, 0.15));
      const sleepHours = sleepMinutes / 60;
      const sleepEfficiency = randomInRange(80, 98);

      data.push({
        dataDate: date,
        dataType: 'sleep_duration',
        valueNumeric: parseFloat(sleepHours.toFixed(1)),
        valueJson: {
          total_minutes: sleepMinutes,
          time_in_bed: Math.round(sleepMinutes / (sleepEfficiency / 100)),
          efficiency: sleepEfficiency,
          start_time: `${date}T23:00:00`,
          end_time: `${date}T07:00:00`
        },
        unit: 'hours',
        source: 'fitbit',
        recordedAt: new Date(`${date}T07:00:00Z`),
        qualityScore: 0.93
      });

      // Sleep stages (Fitbit format)
      const deepMinutes = Math.round(sleepMinutes * randomInRange(10, 20) / 100);
      const remMinutes = Math.round(sleepMinutes * randomInRange(15, 25) / 100);
      const lightMinutes = Math.round(sleepMinutes * randomInRange(50, 65) / 100);
      const awakeMinutes = sleepMinutes - deepMinutes - remMinutes - lightMinutes;

      data.push({
        dataDate: date,
        dataType: 'sleep_stages',
        valueJson: {
          deep: deepMinutes,
          rem: remMinutes,
          light: lightMinutes,
          wake: Math.max(0, awakeMinutes),
          summary: {
            deep_percent: Math.round(deepMinutes / sleepMinutes * 100),
            rem_percent: Math.round(remMinutes / sleepMinutes * 100),
            light_percent: Math.round(lightMinutes / sleepMinutes * 100)
          }
        },
        unit: 'minutes',
        source: 'fitbit',
        recordedAt: new Date(`${date}T07:00:00Z`),
        qualityScore: 0.90
      });

      // Sleep quality score
      const sleepScore = Math.round(
        (sleepEfficiency / 100) * 40 +
        (deepMinutes / sleepMinutes) * 30 +
        (remMinutes / sleepMinutes) * 30
      );
      data.push({
        dataDate: date,
        dataType: 'sleep_quality',
        valueNumeric: Math.min(10, Math.round(sleepScore / 10)),
        valueJson: { fitbit_sleep_score: sleepScore },
        unit: 'score',
        source: 'fitbit',
        recordedAt: new Date(`${date}T07:00:00Z`),
        qualityScore: 0.88
      });

      // Resting heart rate
      const restingHR = Math.round(randomVariation(baseRestingHR, 0.08));
      data.push({
        dataDate: date,
        dataType: 'resting_heart_rate',
        valueNumeric: restingHR,
        unit: 'bpm',
        source: 'fitbit',
        recordedAt: new Date(`${date}T08:00:00Z`),
        qualityScore: 0.96
      });

      // HRV (Fitbit Premium feature simulation)
      const hrvValue = Math.round(randomVariation(40 + (70 - restingHR) * 0.8, 0.15));
      data.push({
        dataDate: date,
        dataType: 'hrv',
        valueNumeric: hrvValue,
        valueJson: {
          deep_sleep_hrv: hrvValue + randomInRange(5, 15),
          daily_range: {
            low: hrvValue - randomInRange(10, 20),
            high: hrvValue + randomInRange(15, 30)
          }
        },
        unit: 'ms',
        source: 'fitbit',
        recordedAt: new Date(`${date}T06:00:00Z`),
        qualityScore: 0.87
      });

      // Steps
      const steps = randomInRange(3000, 18000);
      data.push({
        dataDate: date,
        dataType: 'steps',
        valueNumeric: steps,
        valueJson: {
          goal: 10000,
          goal_percentage: Math.round(steps / 100)
        },
        unit: 'steps',
        source: 'fitbit',
        recordedAt: new Date(`${date}T23:59:00Z`),
        qualityScore: 0.99
      });

      // Active zone minutes
      const fatBurnMinutes = randomInRange(10, 60);
      const cardioMinutes = randomInRange(0, 30);
      const peakMinutes = randomInRange(0, 15);

      data.push({
        dataDate: date,
        dataType: 'active_minutes',
        valueNumeric: fatBurnMinutes + cardioMinutes * 2 + peakMinutes * 2,
        valueJson: {
          fat_burn_minutes: fatBurnMinutes,
          cardio_minutes: cardioMinutes,
          peak_minutes: peakMinutes,
          total_active_zone_minutes: fatBurnMinutes + cardioMinutes * 2 + peakMinutes * 2
        },
        unit: 'minutes',
        source: 'fitbit',
        recordedAt: new Date(`${date}T23:59:00Z`),
        qualityScore: 0.94
      });

      // Calories
      const bmr = 1500 + userSeed * 500;
      const activityCalories = steps * 0.04 + (fatBurnMinutes + cardioMinutes + peakMinutes) * 8;
      data.push({
        dataDate: date,
        dataType: 'calories_burned',
        valueNumeric: Math.round(bmr + activityCalories),
        valueJson: {
          bmr: Math.round(bmr),
          activity_calories: Math.round(activityCalories),
          total: Math.round(bmr + activityCalories)
        },
        unit: 'kcal',
        source: 'fitbit',
        recordedAt: new Date(`${date}T23:59:00Z`),
        qualityScore: 0.82
      });

      // SpO2
      data.push({
        dataDate: date,
        dataType: 'spo2',
        valueNumeric: randomInRange(95, 100, 1),
        valueJson: {
          average: randomInRange(96, 99, 1),
          low: randomInRange(93, 97, 1),
          high: randomInRange(98, 100, 1)
        },
        unit: '%',
        source: 'fitbit',
        recordedAt: new Date(`${date}T06:00:00Z`),
        qualityScore: 0.86
      });

      // Stress management score (Fitbit Premium)
      const stressScore = randomInRange(50, 95);
      data.push({
        dataDate: date,
        dataType: 'stress_level',
        valueNumeric: Math.round(100 - stressScore), // Invert: higher = more stress
        valueJson: {
          stress_management_score: stressScore,
          responsiveness: randomInRange(60, 95),
          exertion_balance: randomInRange(50, 90),
          sleep_patterns: randomInRange(60, 95)
        },
        unit: 'score',
        source: 'fitbit',
        recordedAt: new Date(`${date}T23:59:00Z`),
        qualityScore: 0.75
      });
    }

    return data;
  }
}

// ===========================================
// MOCK PROVIDER FACTORY
// ===========================================

const MockProviders = {
  apple_health: MockAppleHealthProvider,
  oura: MockOuraProvider,
  fitbit: MockFitbitProvider,
  mock: MockAppleHealthProvider // Default mock uses Apple format
};

/**
 * Get mock provider instance for device type
 */
const getMockProvider = (deviceType) => {
  const ProviderClass = MockProviders[deviceType];
  if (!ProviderClass) {
    throw new Error(`Unknown device type: ${deviceType}`);
  }
  return new ProviderClass();
};

/**
 * Check if we should use mock providers
 */
const shouldUseMock = () => {
  return process.env.NODE_ENV !== 'production' ||
         process.env.USE_MOCK_WEARABLES === 'true';
};

module.exports = {
  MockAppleHealthProvider,
  MockOuraProvider,
  MockFitbitProvider,
  getMockProvider,
  shouldUseMock,
  // Utility exports for testing
  randomInRange,
  randomVariation,
  generateDateRange
};

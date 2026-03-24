/**
 * User Segmentation Service
 * Classifies users into behavioral segments for personalized recommendations
 */

const db = require('../config/database');
const { kMeansClustering, calculateStatistics } = require('./mlEngine');

/**
 * User segment definitions
 */
const USER_SEGMENTS = {
  STABLE_THRIVING: {
    id: 'stable_thriving',
    name: 'Stable & Thriving',
    description: 'Consistently positive moods with low stress',
    recommendationFocus: ['maintenance', 'growth', 'prevention']
  },
  IMPROVING: {
    id: 'improving',
    name: 'On the Rise',
    description: 'Showing improvement over time',
    recommendationFocus: ['encouragement', 'momentum', 'skill_building']
  },
  STRUGGLING: {
    id: 'struggling',
    name: 'Needs Support',
    description: 'Currently experiencing difficulties',
    recommendationFocus: ['immediate_relief', 'coping', 'professional_help']
  },
  VOLATILE: {
    id: 'volatile',
    name: 'Variable Patterns',
    description: 'Significant mood fluctuations',
    recommendationFocus: ['stabilization', 'triggers', 'routine']
  },
  NEW_USER: {
    id: 'new_user',
    name: 'Getting Started',
    description: 'Not enough data for segmentation',
    recommendationFocus: ['engagement', 'education', 'habit_formation']
  },
  STRESS_DOMINANT: {
    id: 'stress_dominant',
    name: 'Stress-Focused',
    description: 'High stress despite reasonable mood',
    recommendationFocus: ['stress_management', 'relaxation', 'boundaries']
  },
  ENERGY_DEPLETED: {
    id: 'energy_depleted',
    name: 'Low Energy',
    description: 'Consistently low energy levels',
    recommendationFocus: ['energy_boost', 'sleep', 'nutrition']
  }
};

/**
 * Calculate user profile features from mood data
 * @param {Array<Object>} entries - Mood entries
 * @returns {Object} Feature vector for segmentation
 */
const calculateUserFeatures = (entries) => {
  if (entries.length === 0) {
    return null;
  }

  const moods = entries.map(e => e.mood_score);
  const stress = entries.map(e => e.stress_level || 5);
  const energy = entries.map(e => e.energy_level || 5);
  const anxiety = entries.map(e => e.anxiety_level || 5);
  const sleep = entries.map(e => e.sleep_hours || 7);

  const moodStats = calculateStatistics(moods);
  const stressStats = calculateStatistics(stress);
  const energyStats = calculateStatistics(energy);
  const anxietyStats = calculateStatistics(anxiety);
  const sleepStats = calculateStatistics(sleep);

  // Calculate trend (positive slope = improving)
  const n = moods.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = moodStats.mean;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - meanX) * (moods[i] - meanY);
    denominator += Math.pow(x[i] - meanX, 2);
  }
  const trend = denominator === 0 ? 0 : numerator / denominator;

  // Consistency score (inverse of coefficient of variation)
  const consistencyScore = moodStats.mean === 0 ? 0 :
    Math.max(0, 1 - (moodStats.stdDev / moodStats.mean));

  // Weekend vs weekday difference
  const weekdayEntries = entries.filter(e => {
    const day = new Date(e.entry_date).getDay();
    return day >= 1 && day <= 5;
  });
  const weekendEntries = entries.filter(e => {
    const day = new Date(e.entry_date).getDay();
    return day === 0 || day === 6;
  });

  const weekdayMoodAvg = weekdayEntries.length > 0
    ? weekdayEntries.reduce((sum, e) => sum + e.mood_score, 0) / weekdayEntries.length
    : moodStats.mean;
  const weekendMoodAvg = weekendEntries.length > 0
    ? weekendEntries.reduce((sum, e) => sum + e.mood_score, 0) / weekendEntries.length
    : moodStats.mean;

  return {
    moodMean: moodStats.mean,
    moodStdDev: moodStats.stdDev,
    stressMean: stressStats.mean,
    energyMean: energyStats.mean,
    anxietyMean: anxietyStats.mean,
    sleepMean: sleepStats.mean,
    trend,
    consistencyScore,
    weekdayWeekendDiff: weekendMoodAvg - weekdayMoodAvg,
    entryCount: entries.length
  };
};

/**
 * Classify a user into a segment based on their features
 * @param {Object} features - User features from calculateUserFeatures
 * @returns {Object} Segment classification
 */
const classifyUser = (features) => {
  if (!features || features.entryCount < 5) {
    return {
      segment: USER_SEGMENTS.NEW_USER,
      confidence: 0.5,
      features
    };
  }

  let segment;
  let confidence = 0.7;
  const reasons = [];

  // High volatility check
  if (features.moodStdDev > 2.5) {
    segment = USER_SEGMENTS.VOLATILE;
    reasons.push('High mood variability');
    confidence = Math.min(0.9, 0.6 + features.moodStdDev / 10);
  }
  // Improving trend
  else if (features.trend > 0.15 && features.moodMean >= 4) {
    segment = USER_SEGMENTS.IMPROVING;
    reasons.push('Positive mood trend');
    confidence = Math.min(0.9, 0.6 + features.trend);
  }
  // Stable and thriving
  else if (features.moodMean >= 6.5 && features.stressMean <= 5 && features.moodStdDev < 1.5) {
    segment = USER_SEGMENTS.STABLE_THRIVING;
    reasons.push('Consistently positive moods', 'Low stress levels');
    confidence = 0.85;
  }
  // High stress but ok mood
  else if (features.stressMean >= 7 && features.moodMean >= 5) {
    segment = USER_SEGMENTS.STRESS_DOMINANT;
    reasons.push('High stress levels despite reasonable mood');
    confidence = 0.75;
  }
  // Low energy
  else if (features.energyMean < 4 && features.moodMean >= 4) {
    segment = USER_SEGMENTS.ENERGY_DEPLETED;
    reasons.push('Consistently low energy');
    confidence = 0.75;
  }
  // Struggling
  else if (features.moodMean < 5 || features.stressMean > 7 || features.anxietyMean > 7) {
    segment = USER_SEGMENTS.STRUGGLING;
    reasons.push('Currently experiencing difficulties');
    confidence = 0.8;
  }
  // Default to improving if slight positive trend
  else if (features.trend > 0.05) {
    segment = USER_SEGMENTS.IMPROVING;
    reasons.push('Slight positive trend');
    confidence = 0.65;
  }
  // Otherwise volatile or stable
  else {
    segment = features.moodStdDev > 1.5 ? USER_SEGMENTS.VOLATILE : USER_SEGMENTS.STABLE_THRIVING;
    reasons.push(features.moodStdDev > 1.5 ? 'Moderate mood variability' : 'Generally stable patterns');
    confidence = 0.6;
  }

  return {
    segment,
    confidence,
    features,
    reasons
  };
};

/**
 * Get segment-specific recommendations
 * @param {string} segmentId - Segment ID
 * @returns {Array<Object>} Recommended activities for segment
 */
const getSegmentRecommendations = (segmentId) => {
  const recommendations = {
    stable_thriving: [
      {
        type: 'growth',
        title: 'Try Something New',
        description: 'Challenge yourself with a new hobby or skill to maintain growth.',
        effortLevel: 'medium'
      },
      {
        type: 'social',
        title: 'Share Your Strategies',
        description: 'Consider mentoring others or sharing what works for you.',
        effortLevel: 'medium'
      },
      {
        type: 'prevention',
        title: 'Build Resilience',
        description: 'Practice stress inoculation techniques for future challenges.',
        effortLevel: 'medium'
      }
    ],
    improving: [
      {
        type: 'encouragement',
        title: 'Celebrate Your Progress',
        description: 'Acknowledge how far you\'ve come - every step matters!',
        effortLevel: 'low'
      },
      {
        type: 'momentum',
        title: 'Build on Success',
        description: 'Identify what\'s been working and do more of it.',
        effortLevel: 'low'
      },
      {
        type: 'skill_building',
        title: 'Learn a Coping Strategy',
        description: 'Add a new tool to your mental health toolkit.',
        effortLevel: 'medium'
      }
    ],
    struggling: [
      {
        type: 'immediate_relief',
        title: 'Grounding Exercise',
        description: 'Try the 5-4-3-2-1 technique to feel present and calm.',
        effortLevel: 'low',
        priority: 1
      },
      {
        type: 'coping',
        title: 'Reach Out',
        description: 'Talk to someone you trust about how you\'re feeling.',
        effortLevel: 'medium',
        priority: 1
      },
      {
        type: 'professional_help',
        title: 'Consider Professional Support',
        description: 'A therapist can provide tools tailored to your situation.',
        effortLevel: 'medium',
        priority: 2
      }
    ],
    volatile: [
      {
        type: 'stabilization',
        title: 'Establish a Routine',
        description: 'Consistent sleep and meal times can help stabilize mood.',
        effortLevel: 'medium'
      },
      {
        type: 'triggers',
        title: 'Identify Patterns',
        description: 'Note what happens before mood changes to spot triggers.',
        effortLevel: 'low'
      },
      {
        type: 'routine',
        title: 'Morning Anchoring',
        description: 'Start each day with the same calming activity.',
        effortLevel: 'low'
      }
    ],
    new_user: [
      {
        type: 'engagement',
        title: 'Daily Check-In',
        description: 'Log your mood daily to build self-awareness.',
        effortLevel: 'low'
      },
      {
        type: 'education',
        title: 'Learn About Emotions',
        description: 'Understanding emotions helps you manage them better.',
        effortLevel: 'low'
      },
      {
        type: 'habit_formation',
        title: 'Set a Reminder',
        description: 'Schedule a daily reminder to track your mood.',
        effortLevel: 'low'
      }
    ],
    stress_dominant: [
      {
        type: 'stress_management',
        title: 'Deep Breathing',
        description: 'Practice box breathing: 4 seconds in, hold, out, hold.',
        effortLevel: 'low',
        priority: 1
      },
      {
        type: 'relaxation',
        title: 'Progressive Muscle Relaxation',
        description: 'Release tension by tensing and relaxing muscle groups.',
        effortLevel: 'low'
      },
      {
        type: 'boundaries',
        title: 'Review Your Commitments',
        description: 'Are you saying yes too often? It\'s OK to set limits.',
        effortLevel: 'medium'
      }
    ],
    energy_depleted: [
      {
        type: 'energy_boost',
        title: 'Short Walk',
        description: 'Even 10 minutes of movement can boost energy.',
        effortLevel: 'low',
        priority: 1
      },
      {
        type: 'sleep',
        title: 'Sleep Audit',
        description: 'Review your sleep habits - aim for 7-9 hours consistently.',
        effortLevel: 'low'
      },
      {
        type: 'nutrition',
        title: 'Hydration Check',
        description: 'Drink a full glass of water - dehydration causes fatigue.',
        effortLevel: 'low'
      }
    ]
  };

  return recommendations[segmentId] || recommendations.new_user;
};

/**
 * Segment a user based on their historical data
 * @param {string} userId - User ID
 * @returns {Object} Segmentation result
 */
const segmentUser = async (userId) => {
  // Get recent mood entries
  const query = `
    SELECT * FROM mood_entries
    WHERE user_id = $1
    AND entry_date >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY entry_date DESC
  `;

  const result = await db.query(query, [userId]);
  const entries = result.rows;

  const features = calculateUserFeatures(entries);
  const classification = classifyUser(features);

  // Get segment-specific recommendations
  const recommendations = getSegmentRecommendations(classification.segment.id);

  return {
    ...classification,
    recommendations,
    dataPoints: entries.length,
    analyzedPeriod: '30 days'
  };
};

/**
 * Get segment distribution across all users (for admin analytics)
 * @returns {Object} Segment distribution
 */
const getSegmentDistribution = async () => {
  const query = `
    SELECT user_id FROM users WHERE is_active = true
  `;

  const users = await db.query(query);
  const distribution = {};

  // Initialize counts
  Object.values(USER_SEGMENTS).forEach(seg => {
    distribution[seg.id] = { count: 0, users: [] };
  });

  for (const user of users.rows) {
    try {
      const segmentation = await segmentUser(user.user_id);
      const segId = segmentation.segment.id;
      distribution[segId].count++;
    } catch (err) {
      // Skip users with errors
      distribution.new_user.count++;
    }
  }

  return distribution;
};

module.exports = {
  USER_SEGMENTS,
  calculateUserFeatures,
  classifyUser,
  getSegmentRecommendations,
  segmentUser,
  getSegmentDistribution
};

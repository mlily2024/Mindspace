const db = require('../config/database');

// ── Pattern Cluster Definitions ─────────────────────────────────────────────
// 0 = stable-high, 1 = stable-low, 2 = volatile, 3 = declining, 4 = improving

const EXERCISE_TYPES = [
  'gratitude_round',
  'coping_strategy_share',
  'weekly_challenge',
  'check_in_circle',
  'mindful_moment'
];

// ── Helper Functions ────────────────────────────────────────────────────────

function classifyPattern(avgMood, variability, trendSlope) {
  // High variability overrides other classifications
  if (variability > 2.0) return 2; // volatile

  // Trend-based classification
  if (trendSlope < -0.05) return 3; // declining
  if (trendSlope > 0.05) return 4;  // improving

  // Stable patterns based on average mood level
  if (avgMood >= 6) return 0; // stable-high
  return 1;                    // stable-low
}

function computeLinearTrendSlope(values) {
  const n = values.length;
  if (n < 2) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return 0;

  return (n * sumXY - sumX * sumY) / denominator;
}

// ── Service ─────────────────────────────────────────────────────────────────

const enhancedPeerService = {
  /**
   * Analyzes last 30 days of mood data to compute a pattern profile.
   * Returns peak day, trough day, avg variability, primary triggers, and pattern cluster.
   */
  async computePatternProfile(userId) {
    const rows = await db.all(
      `SELECT date, mood_score, triggers
       FROM mood_entries
       WHERE user_id = ? AND date >= date('now', '-30 days')
       ORDER BY date ASC`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      return {
        pattern_cluster: null,
        avg_mood: null,
        variability: null,
        trend_slope: null,
        peak_day: null,
        trough_day: null,
        primary_triggers: [],
        data_points: 0
      };
    }

    const moodValues = rows.map(r => r.mood_score);

    // Averages
    const avgMood = moodValues.reduce((a, b) => a + b, 0) / moodValues.length;

    // Variability (standard deviation)
    const variance = moodValues.reduce((sum, v) => sum + Math.pow(v - avgMood, 2), 0) / moodValues.length;
    const variability = Math.sqrt(variance);

    // Trend slope
    const trendSlope = computeLinearTrendSlope(moodValues);

    // Peak and trough
    let peakDay = rows[0];
    let troughDay = rows[0];
    for (const row of rows) {
      if (row.mood_score > peakDay.mood_score) peakDay = row;
      if (row.mood_score < troughDay.mood_score) troughDay = row;
    }

    // Primary triggers — aggregate from entries
    const triggerCounts = {};
    for (const row of rows) {
      if (row.triggers) {
        let triggers;
        try {
          triggers = JSON.parse(row.triggers);
        } catch {
          triggers = row.triggers.split(',').map(t => t.trim());
        }
        if (Array.isArray(triggers)) {
          for (const t of triggers) {
            const key = String(t).toLowerCase().trim();
            if (key) {
              triggerCounts[key] = (triggerCounts[key] || 0) + 1;
            }
          }
        }
      }
    }

    const primaryTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([trigger, count]) => ({ trigger, count }));

    const patternCluster = classifyPattern(avgMood, variability, trendSlope);

    // Save the computed profile
    await db.run(
      `INSERT OR REPLACE INTO peer_pattern_profiles
         (user_id, pattern_cluster, avg_mood, variability, trend_slope, peak_day, trough_day, primary_triggers, computed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        userId,
        patternCluster,
        Math.round(avgMood * 100) / 100,
        Math.round(variability * 100) / 100,
        Math.round(trendSlope * 1000) / 1000,
        peakDay.date,
        troughDay.date,
        JSON.stringify(primaryTriggers)
      ]
    );

    return {
      pattern_cluster: patternCluster,
      avg_mood: Math.round(avgMood * 100) / 100,
      variability: Math.round(variability * 100) / 100,
      trend_slope: Math.round(trendSlope * 1000) / 1000,
      peak_day: peakDay.date,
      trough_day: troughDay.date,
      primary_triggers: primaryTriggers,
      data_points: rows.length
    };
  },

  /**
   * Returns users in the same pattern cluster (excluding the current user).
   */
  async findPatternMatches(userId, limit = 10) {
    // Get the current user's cluster
    const profile = await db.get(
      `SELECT pattern_cluster FROM peer_pattern_profiles
       WHERE user_id = ?
       ORDER BY computed_at DESC LIMIT 1`,
      [userId]
    );

    if (!profile || profile.pattern_cluster === null) {
      return [];
    }

    const matches = await db.all(
      `SELECT pp.user_id, pp.pattern_cluster, pp.avg_mood, pp.variability,
              pp.trend_slope, pp.computed_at
       FROM peer_pattern_profiles pp
       WHERE pp.pattern_cluster = ? AND pp.user_id != ?
       ORDER BY pp.computed_at DESC
       LIMIT ?`,
      [profile.pattern_cluster, userId, limit]
    );

    return matches;
  },

  /**
   * Suggests a peer group based on pattern matching.
   */
  async suggestGroup(userId) {
    const profile = await db.get(
      `SELECT pattern_cluster FROM peer_pattern_profiles
       WHERE user_id = ?
       ORDER BY computed_at DESC LIMIT 1`,
      [userId]
    );

    if (!profile || profile.pattern_cluster === null) {
      return null;
    }

    const clusterLabels = {
      0: 'Steady & Thriving',
      1: 'Building Momentum',
      2: 'Riding the Waves',
      3: 'Finding Footing',
      4: 'On the Rise'
    };

    // Check if there's an existing group for this cluster
    const existingGroup = await db.get(
      `SELECT pg.* FROM peer_groups pg
       WHERE pg.pattern_cluster = ? AND pg.is_active = 1
       ORDER BY pg.created_at DESC LIMIT 1`,
      [profile.pattern_cluster]
    );

    if (existingGroup) {
      const memberCount = await db.get(
        `SELECT COUNT(*) as count FROM peer_group_members
         WHERE group_id = ?`,
        [existingGroup.id]
      );

      return {
        group_id: existingGroup.id,
        group_name: existingGroup.name,
        pattern_cluster: profile.pattern_cluster,
        cluster_label: clusterLabels[profile.pattern_cluster],
        member_count: memberCount.count,
        already_exists: true
      };
    }

    // Suggest creating a new group
    return {
      group_id: null,
      group_name: clusterLabels[profile.pattern_cluster],
      pattern_cluster: profile.pattern_cluster,
      cluster_label: clusterLabels[profile.pattern_cluster],
      member_count: 0,
      already_exists: false
    };
  },

  /**
   * Creates a structured group exercise.
   */
  async createStructuredExercise(groupId, createdBy, exerciseType, title, description, scheduledAt) {
    if (!EXERCISE_TYPES.includes(exerciseType)) {
      throw new Error(`Invalid exercise type: ${exerciseType}. Must be one of: ${EXERCISE_TYPES.join(', ')}`);
    }

    const result = await db.run(
      `INSERT INTO peer_group_exercises
         (group_id, created_by, exercise_type, title, description, scheduled_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [groupId, createdBy, exerciseType, title, description, scheduledAt]
    );

    return {
      id: result.lastID,
      group_id: groupId,
      created_by: createdBy,
      exercise_type: exerciseType,
      title,
      description,
      scheduled_at: scheduledAt
    };
  },

  /**
   * Returns exercises for a group.
   */
  async getGroupExercises(groupId) {
    const exercises = await db.all(
      `SELECT e.*, COUNT(r.id) as response_count
       FROM peer_group_exercises e
       LEFT JOIN peer_exercise_responses r ON r.exercise_id = e.id
       WHERE e.group_id = ?
       GROUP BY e.id
       ORDER BY e.scheduled_at DESC`,
      [groupId]
    );

    return exercises;
  },

  /**
   * Records a user's participation in an exercise.
   */
  async submitExerciseResponse(exerciseId, userId, content) {
    const result = await db.run(
      `INSERT INTO peer_exercise_responses
         (exercise_id, user_id, content, submitted_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [exerciseId, userId, content]
    );

    return {
      id: result.lastID,
      exercise_id: exerciseId,
      user_id: userId,
      submitted_at: new Date().toISOString()
    };
  },

  /**
   * Returns users whose PHQ-9 improved by >= 5 points and have been active >= 30 days.
   */
  async getEligibleMentors() {
    // Find users with at least 2 PHQ-9 responses where earliest minus latest >= 5
    const mentors = await db.all(
      `SELECT
         r1.user_id,
         r1.score AS latest_score,
         r2.score AS earliest_score,
         (r2.score - r1.score) AS improvement,
         r2.completed_at AS first_assessment,
         r1.completed_at AS last_assessment
       FROM clinical_assessment_responses r1
       JOIN clinical_assessment_responses r2
         ON r1.user_id = r2.user_id AND r1.instrument = r2.instrument
       WHERE r1.instrument = 'PHQ-9'
         AND r1.completed_at = (
           SELECT MAX(completed_at) FROM clinical_assessment_responses
           WHERE user_id = r1.user_id AND instrument = 'PHQ-9'
         )
         AND r2.completed_at = (
           SELECT MIN(completed_at) FROM clinical_assessment_responses
           WHERE user_id = r1.user_id AND instrument = 'PHQ-9'
         )
         AND (r2.score - r1.score) >= 5
         AND julianday(r1.completed_at) - julianday(r2.completed_at) >= 30
       ORDER BY improvement DESC`
    );

    return mentors;
  },

  /**
   * Pairs a mentor and mentee.
   */
  async createMentorship(mentorId, menteeId) {
    if (mentorId === menteeId) {
      throw new Error('A user cannot mentor themselves');
    }

    // Check for existing active mentorship
    const existing = await db.get(
      `SELECT id FROM peer_mentorships
       WHERE mentor_id = ? AND mentee_id = ? AND is_active = 1`,
      [mentorId, menteeId]
    );

    if (existing) {
      throw new Error('An active mentorship already exists between these users');
    }

    const result = await db.run(
      `INSERT INTO peer_mentorships
         (mentor_id, mentee_id, is_active, created_at)
       VALUES (?, ?, 1, datetime('now'))`,
      [mentorId, menteeId]
    );

    return {
      id: result.lastID,
      mentor_id: mentorId,
      mentee_id: menteeId,
      is_active: true,
      created_at: new Date().toISOString()
    };
  },

  /**
   * Returns active mentorships for a user (as mentor or mentee).
   */
  async getUserMentorships(userId) {
    const mentorships = await db.all(
      `SELECT m.*,
              CASE WHEN m.mentor_id = ? THEN 'mentor' ELSE 'mentee' END AS role
       FROM peer_mentorships m
       WHERE (m.mentor_id = ? OR m.mentee_id = ?) AND m.is_active = 1
       ORDER BY m.created_at DESC`,
      [userId, userId, userId]
    );

    return mentorships;
  }
};

module.exports = enhancedPeerService;

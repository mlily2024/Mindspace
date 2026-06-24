/**
 * enhancedPeerService — peer-similarity surface (pattern profiles + matching).
 *
 * Activated 2026-06-23 (ADR-0022). Previously a non-functional SQLite stub
 * (db.all/db.get/db.run, `?` placeholders, `datetime('now')`, wrong/phantom
 * tables) wired to no controller. Reconciled to Postgres + migration 006's real
 * `peer_pattern_profiles` schema and wired to the (formerly stubbed)
 * enhancedPeerController at /api/peer-support/enhanced.
 *
 * Scope: the SIMILARITY methods only (computePatternProfile, findPatternMatches,
 * suggestGroup). The earlier structured-exercise and mentorship methods are NOT
 * activated here — they touch the LIVE `peer_support_groups` table and need a
 * `validated_assessments` remap, so they are a separate follow-on (their
 * controller handlers remain the existing stubs). The live /api/peer-support path
 * (peerSupportController + peerModerationService) is untouched.
 *
 * This pattern profile is the substrate the deferred A.3 embedding model would
 * replace the rule-based cluster with.
 */

const crypto = require('crypto');
const db = require('../config/database');

// Cluster ids: 0 stable-high, 1 stable-low, 2 volatile, 3 declining, 4 improving.
const CLUSTER_LABELS = {
  0: 'Steady & Thriving',
  1: 'Building Momentum',
  2: 'Riding the Waves',
  3: 'Finding Footing',
  4: 'On the Rise',
};

// Allowed structured-exercise types.
const EXERCISE_TYPES = [
  'gratitude_round',
  'coping_strategy_share',
  'weekly_challenge',
  'check_in_circle',
  'mindful_moment',
];

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function classifyPattern(avgMood, variability, trendSlope) {
  if (variability > 2.0) return 2; // volatile (overrides)
  if (trendSlope < -0.05) return 3; // declining
  if (trendSlope > 0.05) return 4; // improving
  if (avgMood >= 6) return 0; // stable-high
  return 1; // stable-low
}

function computeLinearTrendSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

/** jsonb `triggers` arrives parsed from pg; tolerate string/legacy shapes too. */
function normaliseTriggers(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.length) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return raw.split(',').map((t) => t.trim());
    }
  }
  return [];
}

/** Read-only membership check against the LIVE group_members table (never mutated here). */
async function isActiveGroupMember(userId, groupId) {
  const { rows } = await db.query(
    `SELECT 1 FROM group_members
      WHERE group_id = $1 AND user_id = $2 AND is_active = TRUE
      LIMIT 1`,
    [groupId, userId]
  );
  return rows.length > 0;
}

const enhancedPeerService = {
  /**
   * Compute (and upsert) the user's 30-day mood pattern profile.
   */
  async computePatternProfile(userId) {
    const { rows } = await db.query(
      `SELECT entry_date, mood_score, triggers
         FROM mood_entries
        WHERE user_id = $1 AND entry_date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY entry_date ASC`,
      [userId]
    );

    if (rows.length === 0) {
      return {
        pattern_cluster: null, cluster_label: null, avg_mood: null, variability: null,
        trend_slope: null, peak_day: null, trough_day: null, primary_triggers: [], data_points: 0,
      };
    }

    const moods = rows.map((r) => Number(r.mood_score));
    const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length;
    const variability = Math.sqrt(moods.reduce((s, v) => s + (v - avgMood) ** 2, 0) / moods.length);
    const trendSlope = computeLinearTrendSlope(moods);

    let peak = rows[0];
    let trough = rows[0];
    const triggerCounts = {};
    for (const row of rows) {
      if (Number(row.mood_score) > Number(peak.mood_score)) peak = row;
      if (Number(row.mood_score) < Number(trough.mood_score)) trough = row;
      for (const t of normaliseTriggers(row.triggers)) {
        const k = String(t).toLowerCase().trim();
        if (k) triggerCounts[k] = (triggerCounts[k] || 0) + 1;
      }
    }

    const primaryTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([trigger, count]) => ({ trigger, count }));

    const cluster = classifyPattern(avgMood, variability, trendSlope);
    const peakDay = String(peak.entry_date).slice(0, 10);
    const troughDay = String(trough.entry_date).slice(0, 10);
    const avgVariability = Math.round(variability * 100) / 100;
    const patternHash = crypto
      .createHash('sha256')
      .update(`${cluster}:${avgVariability}:${peakDay}:${troughDay}`)
      .digest('hex')
      .slice(0, 64);

    // Persist what the schema holds (no avg_mood/trend_slope columns — those are
    // returned for the API but derived, not stored).
    await db.query(
      `INSERT INTO peer_pattern_profiles
         (user_id, mood_pattern_cluster, peak_day, trough_day, avg_variability,
          primary_triggers, pattern_hash, last_computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         mood_pattern_cluster = EXCLUDED.mood_pattern_cluster,
         peak_day = EXCLUDED.peak_day,
         trough_day = EXCLUDED.trough_day,
         avg_variability = EXCLUDED.avg_variability,
         primary_triggers = EXCLUDED.primary_triggers,
         pattern_hash = EXCLUDED.pattern_hash,
         last_computed_at = NOW()`,
      [userId, cluster, peakDay, troughDay, avgVariability, JSON.stringify(primaryTriggers), patternHash]
    );

    return {
      pattern_cluster: cluster,
      cluster_label: CLUSTER_LABELS[cluster],
      avg_mood: Math.round(avgMood * 100) / 100,
      variability: avgVariability,
      trend_slope: Math.round(trendSlope * 1000) / 1000,
      peak_day: peakDay,
      trough_day: troughDay,
      primary_triggers: primaryTriggers,
      data_points: rows.length,
    };
  },

  /**
   * Other users in the same pattern cluster (excluding the requester).
   * Returns no PII — pattern metadata only, for anonymous peer matching.
   */
  async findPatternMatches(userId, limit = 10) {
    const me = await db.query(
      `SELECT mood_pattern_cluster FROM peer_pattern_profiles WHERE user_id = $1`,
      [userId]
    );
    const cluster = me.rows[0]?.mood_pattern_cluster;
    if (cluster === undefined || cluster === null) return [];

    const { rows } = await db.query(
      `SELECT user_id, mood_pattern_cluster, avg_variability, peak_day, trough_day, last_computed_at
         FROM peer_pattern_profiles
        WHERE mood_pattern_cluster = $1 AND user_id <> $2
        ORDER BY last_computed_at DESC
        LIMIT $3`,
      [cluster, userId, limit]
    );
    return rows.map((r) => ({
      user_id: r.user_id,
      pattern_cluster: r.mood_pattern_cluster,
      cluster_label: CLUSTER_LABELS[r.mood_pattern_cluster],
      avg_variability: r.avg_variability,
      last_computed_at: r.last_computed_at,
    }));
  },

  /**
   * Suggest the peer archetype for the user's current cluster. Pure cluster->label
   * (does not touch the live peer_support_groups table).
   */
  async suggestGroup(userId) {
    const me = await db.query(
      `SELECT mood_pattern_cluster FROM peer_pattern_profiles WHERE user_id = $1`,
      [userId]
    );
    const cluster = me.rows[0]?.mood_pattern_cluster;
    if (cluster === undefined || cluster === null) {
      return { pattern_cluster: null, cluster_label: null, message: 'Check in for a few days so we can find your pattern.' };
    }
    return {
      pattern_cluster: cluster,
      cluster_label: CLUSTER_LABELS[cluster],
      message: `You fit the "${CLUSTER_LABELS[cluster]}" pattern — peers here share a similar mood rhythm.`,
    };
  },

  // ── Structured group exercises (members only) ────────────────────────────────

  /**
   * Create a structured exercise for a group. The caller must be an active member.
   * group_id is an FK into the LIVE peer_support_groups (referenced, not modified).
   */
  async createStructuredExercise(userId, groupId, exerciseType, title, description, scheduledAt) {
    if (!EXERCISE_TYPES.includes(exerciseType)) {
      throw httpError(400, `Invalid exercise type. Must be one of: ${EXERCISE_TYPES.join(', ')}`);
    }
    if (!(await isActiveGroupMember(userId, groupId))) {
      throw httpError(403, 'You must be a member of this group to create an exercise.');
    }
    const { rows } = await db.query(
      `INSERT INTO peer_structured_exercises
         (group_id, exercise_type, title, description, scheduled_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING exercise_id, group_id, exercise_type, title, description,
                 scheduled_at, status, participation_count, created_at`,
      [groupId, exerciseType, title, description ?? null, scheduledAt ?? null, userId]
    );
    return rows[0];
  },

  /** List a group's exercises (members only), each with a response count. */
  async getGroupExercises(userId, groupId) {
    if (!(await isActiveGroupMember(userId, groupId))) {
      throw httpError(403, 'You must be a member of this group to view its exercises.');
    }
    const { rows } = await db.query(
      `SELECT e.exercise_id, e.group_id, e.exercise_type, e.title, e.description,
              e.scheduled_at, e.status, e.created_at,
              COUNT(r.response_id)::int AS response_count
         FROM peer_structured_exercises e
         LEFT JOIN peer_exercise_responses r ON r.exercise_id = e.exercise_id
        WHERE e.group_id = $1
        GROUP BY e.exercise_id
        ORDER BY e.scheduled_at DESC NULLS LAST, e.created_at DESC`,
      [groupId]
    );
    return rows;
  },

  /** Record a response to an exercise. Caller must be a member of the exercise's group. */
  async submitExerciseResponse(userId, exerciseId, content) {
    const ex = await db.query(
      `SELECT group_id FROM peer_structured_exercises WHERE exercise_id = $1`,
      [exerciseId]
    );
    if (ex.rows.length === 0) throw httpError(404, 'Exercise not found.');
    if (!(await isActiveGroupMember(userId, ex.rows[0].group_id))) {
      throw httpError(403, 'You must be a member of this group to respond.');
    }
    const { rows } = await db.query(
      `INSERT INTO peer_exercise_responses (exercise_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING response_id, exercise_id, user_id, created_at`,
      [exerciseId, userId, content]
    );
    return rows[0];
  },

  // ── Mentorships (read-only here) ─────────────────────────────────────────────

  /**
   * The current user's active mentorships (as mentor or mentee). Read-only.
   * Mentor matching/creation is a separate privacy-gated follow-on (it would read
   * others' clinical improvement from validated_assessments, which conflicts with
   * the anonymous peer model — needs an opt-in design).
   */
  async getUserMentorships(userId) {
    const { rows } = await db.query(
      `SELECT mentorship_id, mentor_id, mentee_id, status, started_at, ended_at,
              CASE WHEN mentor_id = $1 THEN 'mentor' ELSE 'mentee' END AS role
         FROM peer_mentorships
        WHERE (mentor_id = $1 OR mentee_id = $1) AND status = 'active'
        ORDER BY started_at DESC`,
      [userId]
    );
    return rows;
  },

  // Exposed for tests.
  _classifyPattern: classifyPattern,
  _computeLinearTrendSlope: computeLinearTrendSlope,
  CLUSTER_LABELS,
  EXERCISE_TYPES,
};

module.exports = enhancedPeerService;

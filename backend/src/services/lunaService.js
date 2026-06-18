/**
 * Luna 2.0 — Enhanced Chatbot Service
 *
 * Provides longitudinal memory, adaptive therapeutic matching,
 * data-informed conversations, emotional granularity training,
 * user profiling, and conversation processing with crisis detection.
 */

const db = require('../config/database');
const logger = require('../config/logger');
const safetyFilter = require('./safetyFilter');
const responseGeneratorFactory = require('./responseGeneratorFactory');
const RuleBasedResponseGenerator = require('./ruleBasedResponseGenerator');
const aiAudit = require('./aiAuditService');

// ─── Keyword dictionaries ─────────────────────────────────────────────────────
// NOTE: Crisis keywords now live in safetyFilter (UK_CRISIS_KEYWORDS).
//       _detectCrisis delegates to safetyFilter.detect() so the safety
//       contract is centralised and externally auditable.

const NEGATIVE_KEYWORDS = [
  'sad', 'depressed', 'anxious', 'worried', 'stressed',
  'hopeless', 'lonely', 'angry', 'frustrated', 'overwhelmed',
  'tired', 'exhausted'
];

const POSITIVE_KEYWORDS = [
  'happy', 'good', 'great', 'better', 'calm',
  'grateful', 'hopeful', 'peaceful', 'excited', 'proud'
];

// ─── Emotional granularity map ─────────────────────────────────────────────────

const EMOTION_REFINEMENTS = {
  bad:      ['drained', 'overwhelmed', 'disappointed', 'frustrated', 'lonely', 'numb', 'irritable'],
  sad:      ['melancholic', 'grief-stricken', 'homesick', 'heartbroken', 'wistful', 'discouraged'],
  anxious:  ['apprehensive', 'panicky', 'restless', 'on-edge', 'dread', 'hypervigilant'],
  angry:    ['resentful', 'bitter', 'indignant', 'rageful', 'hostile', 'exasperated'],
  happy:    ['content', 'elated', 'grateful', 'serene', 'enthusiastic', 'relieved'],
  stressed: ['pressured', 'burned-out', 'stretched-thin', 'tense', 'frazzled']
};

// ─── Response strategy templates ───────────────────────────────────────────────

const RESPONSE_STRATEGIES = {
  cbt_thought_challenge: {
    name: 'CBT Thought Challenging',
    type: 'cbt',
    template: (theme) =>
      `I hear you. Sometimes our minds tell us stories that feel absolutely true in the moment. ` +
      `Let's gently examine that thought about "${theme}." What evidence supports it? And what ` +
      `evidence might point the other way? Often, when we slow down and look at both sides, ` +
      `the picture is more nuanced than our first reaction suggests. You don't have to change ` +
      `how you feel — just notice if there's another angle you hadn't considered.`
  },
  act_defusion: {
    name: 'ACT Defusion / Acceptance',
    type: 'act',
    template: (theme) =>
      `It sounds like the thought "${theme}" has a strong grip right now. What if, instead of ` +
      `fighting it, you tried holding it a little more lightly? Imagine placing that thought on ` +
      `a leaf floating down a stream. It's still there — you're not pretending it away — but you're ` +
      `watching it rather than being swept up in it. Acceptance doesn't mean approval. It means ` +
      `making room so the thought doesn't have to control what you do next.`
  },
  dbt_distress_tolerance: {
    name: 'DBT Distress Tolerance (TIPP)',
    type: 'dbt',
    template: () =>
      `When emotions feel this intense, your nervous system needs a reset. Try the TIPP technique: ` +
      `Temperature — splash cold water on your face or hold ice cubes for 30 seconds. ` +
      `Intense exercise — even 5 minutes of jumping jacks or brisk walking. ` +
      `Paced breathing — inhale for 4 counts, exhale for 6. ` +
      `Paired muscle relaxation — tense and release each muscle group. ` +
      `Pick whichever feels most doable right now. You don't need all four — one can shift things.`
  },
  behavioral_activation: {
    name: 'Behavioral Activation',
    type: 'behavioral',
    template: () =>
      `When energy is low, our instinct is to withdraw — but that often deepens the low mood. ` +
      `Let's try something small. Think of one tiny action that used to bring you even a flicker ` +
      `of satisfaction or connection: texting a friend, a short walk, making tea, watering a plant. ` +
      `It doesn't have to feel appealing right now — that's normal. The trick with behavioral ` +
      `activation is: action comes first, motivation follows. Start with just five minutes.`
  },
  mindfulness_grounding: {
    name: 'Mindfulness Grounding',
    type: 'mindfulness',
    template: () =>
      `Let's anchor you to the present moment. Try the 5-4-3-2-1 grounding exercise: ` +
      `Name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, and ` +
      `1 you can taste. Take your time with each one. This gently brings your awareness ` +
      `out of spinning thoughts and back into your body and surroundings. ` +
      `You're safe right here, right now.`
  },
  emotional_validation: {
    name: 'Emotional Validation',
    type: 'validation',
    template: (theme) =>
      `What you're feeling about "${theme}" makes complete sense given what you're going through. ` +
      `Your emotions are valid — they're signals, not flaws. You don't have to fix how you feel ` +
      `right this second. Sometimes the bravest thing is simply to sit with it and say, ` +
      `"This is hard, and I'm allowed to feel this way." I'm here with you in that.`
  }
};

// ─── Service class ─────────────────────────────────────────────────────────────

class LunaService {

  // ═══════════════════════════════════════════════════════════════════════════
  //  Longitudinal Memory
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Retrieve recent therapeutic journal entries for a user.
   *
   * @param {number} userId
   * @param {number} [limit=20]
   * @returns {Array<Object>}
   */
  static async getTherapeuticJournal(userId, limit = 20) {
    try {
      const query = `
        SELECT *
        FROM luna_journal_entries
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `;
      const result = await db.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching therapeutic journal', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Add a journal entry (theme, breakthrough, concern, etc.)
   *
   * @param {number} userId
   * @param {string} entryType - e.g. 'theme', 'breakthrough', 'concern', 'session_summary'
   * @param {string} content
   * @param {string|null} sessionId
   * @returns {Object} the created entry
   */
  static async addJournalEntry(userId, entryType, content, sessionId = null) {
    try {
      const query = `
        INSERT INTO luna_journal_entries (user_id, entry_type, content, session_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      const result = await db.query(query, [userId, entryType, content, sessionId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error adding journal entry', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Build a context object from the last session summary, key themes,
   * and recent mood data.
   *
   * @param {number} userId
   * @returns {Object} session context
   */
  static async getSessionContext(userId) {
    try {
      // Last session summary
      const summaryQuery = `
        SELECT content, created_at
        FROM luna_journal_entries
        WHERE user_id = $1 AND entry_type = 'session_summary'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const summaryResult = await db.query(summaryQuery, [userId]);
      const lastSummary = summaryResult.rows[0] || null;

      // Key themes (last 5)
      const themesQuery = `
        SELECT content, created_at
        FROM luna_journal_entries
        WHERE user_id = $1 AND entry_type = 'theme'
        ORDER BY created_at DESC
        LIMIT 5
      `;
      const themesResult = await db.query(themesQuery, [userId]);
      const themes = themesResult.rows.map(r => r.content);

      // Recent mood data (last 7 days)
      const moodQuery = `
        SELECT entry_date, mood_score, energy_level, anxiety_level
        FROM mood_entries
        WHERE user_id = $1
          AND entry_date >= CURRENT_DATE - INTERVAL '7 days'
        ORDER BY entry_date DESC
      `;
      const moodResult = await db.query(moodQuery, [userId]);

      // 2026-06-18: most recent unacknowledged crisis_indicator alert in
      // the last 24 hours. Drives Luna's session-open greeting so a user
      // who just submitted PHQ-9 with Q9 flagged (or any future crisis
      // trigger written via insightsEngine / assessmentController) is
      // greeted with a knowing, gentler opener rather than the default
      // "How are you feeling right now?". Failure here MUST NOT crash
      // context — if the safety_alerts query throws, we just hand back
      // null for this field and let the rest of the context populate.
      let recentCrisisAlert = null;
      try {
        const alertResult = await db.query(
          `SELECT alert_id, alert_type, severity, alert_data, triggered_at
           FROM safety_alerts
           WHERE user_id = $1
             AND alert_type = 'crisis_indicator'
             AND is_acknowledged = false
             AND triggered_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
           ORDER BY triggered_at DESC
           LIMIT 1`,
          [userId]
        );
        const row = alertResult.rows[0];
        if (row) {
          recentCrisisAlert = {
            alert_id:     row.alert_id,
            triggered_at: row.triggered_at,
            severity:     row.severity,
            source:       row.alert_data?.source       || null,
            instrument:   row.alert_data?.instrument   || null,
          };
        }
      } catch (alertErr) {
        logger.warn('Could not load recentCrisisAlert for Luna context', {
          userId, error: alertErr.message,
        });
      }

      return {
        lastSessionSummary: lastSummary ? lastSummary.content : null,
        lastSessionDate: lastSummary ? lastSummary.created_at : null,
        keyThemes: themes,
        recentMood: moodResult.rows,
        recentCrisisAlert,
      };
    } catch (error) {
      logger.error('Error building session context', { error: error.message, userId });
      return {
        lastSessionSummary: null, lastSessionDate: null,
        keyThemes: [], recentMood: [], recentCrisisAlert: null,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Adaptive Therapeutic Matching
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get ranked technique effectiveness for a user.
   *
   * @param {number} userId
   * @returns {Array<Object>} techniques sorted by effectiveness_score desc
   */
  static async getTechniqueEffectiveness(userId) {
    try {
      const query = `
        SELECT
          technique_type,
          technique_name,
          times_offered,
          times_accepted,
          times_completed,
          effectiveness_score,
          updated_at
        FROM luna_technique_effectiveness
        WHERE user_id = $1
        ORDER BY effectiveness_score DESC
      `;
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting technique effectiveness', { error: error.message, userId });
      return [];
    }
  }

  /**
   * Record the outcome of a suggested technique.
   *
   * @param {number} userId
   * @param {string} techniqueType
   * @param {string} techniqueName
   * @param {boolean} accepted
   * @param {boolean} completed
   * @param {number|null} moodBefore
   * @param {number|null} moodAfter
   * @returns {Object} updated effectiveness row
   */
  static async recordTechniqueOutcome(userId, techniqueType, techniqueName, accepted, completed, moodBefore, moodAfter) {
    try {
      // Calculate mood improvement if both values present
      const moodDelta = (moodBefore != null && moodAfter != null)
        ? moodAfter - moodBefore
        : 0;

      // Upsert effectiveness record
      const query = `
        INSERT INTO luna_technique_effectiveness (
          user_id, technique_type, technique_name,
          times_offered, times_accepted, times_completed,
          total_mood_delta, effectiveness_score,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3,
          1,
          CASE WHEN $4 THEN 1 ELSE 0 END,
          CASE WHEN $5 THEN 1 ELSE 0 END,
          $6,
          CASE WHEN $5 AND $6 > 0 THEN 1.0 ELSE 0.0 END,
          NOW(), NOW()
        )
        ON CONFLICT (user_id, technique_type, technique_name)
        DO UPDATE SET
          times_offered   = luna_technique_effectiveness.times_offered + 1,
          times_accepted  = luna_technique_effectiveness.times_accepted + CASE WHEN $4 THEN 1 ELSE 0 END,
          times_completed = luna_technique_effectiveness.times_completed + CASE WHEN $5 THEN 1 ELSE 0 END,
          total_mood_delta = luna_technique_effectiveness.total_mood_delta + $6,
          effectiveness_score = CASE
            WHEN (luna_technique_effectiveness.times_completed + CASE WHEN $5 THEN 1 ELSE 0 END) > 0
            THEN (luna_technique_effectiveness.total_mood_delta + $6)::float
                 / (luna_technique_effectiveness.times_completed + CASE WHEN $5 THEN 1 ELSE 0 END)
            ELSE 0
          END,
          updated_at = NOW()
        RETURNING *
      `;
      const result = await db.query(query, [
        userId, techniqueType, techniqueName,
        accepted, completed, moodDelta
      ]);

      logger.info('Technique outcome recorded', { userId, techniqueType, techniqueName, moodDelta });
      return result.rows[0];
    } catch (error) {
      logger.error('Error recording technique outcome', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Recommend the best technique for a user given their current mood.
   *
   * @param {number} userId
   * @param {number} currentMood - 1-5
   * @returns {Object} recommended strategy
   */
  static async recommendTechnique(userId, currentMood) {
    try {
      const effectiveness = await this.getTechniqueEffectiveness(userId);

      // If user has proven techniques, prefer the best one
      const proven = effectiveness.filter(t => t.times_completed >= 2 && t.effectiveness_score > 0);
      if (proven.length > 0) {
        const best = proven[0];
        const strategy = RESPONSE_STRATEGIES[best.technique_type] || null;
        return {
          technique_type: best.technique_type,
          technique_name: best.technique_name,
          effectiveness_score: best.effectiveness_score,
          source: 'personalized',
          strategy
        };
      }

      // Fallback: pick based on mood level
      let techniqueKey;
      if (currentMood <= 1) {
        techniqueKey = 'dbt_distress_tolerance';
      } else if (currentMood <= 2) {
        techniqueKey = 'emotional_validation';
      } else if (currentMood <= 3) {
        techniqueKey = 'cbt_thought_challenge';
      } else {
        techniqueKey = 'behavioral_activation';
      }

      const strategy = RESPONSE_STRATEGIES[techniqueKey];
      return {
        technique_type: techniqueKey,
        technique_name: strategy.name,
        effectiveness_score: null,
        source: 'default',
        strategy
      };
    } catch (error) {
      logger.error('Error recommending technique', { error: error.message, userId });
      return {
        technique_type: 'emotional_validation',
        technique_name: 'Emotional Validation',
        effectiveness_score: null,
        source: 'fallback',
        strategy: RESPONSE_STRATEGIES.emotional_validation
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Data-Informed Conversations
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pull recent mood trends, sleep correlation, and identified patterns
   * to ground conversation in data.
   *
   * @param {number} userId
   * @returns {Object} data context
   */
  static async generateDataContext(userId) {
    try {
      // Mood trend (last 14 days)
      const trendQuery = `
        SELECT entry_date, mood_score, energy_level, sleep_quality, anxiety_level
        FROM mood_entries
        WHERE user_id = $1
          AND entry_date >= CURRENT_DATE - INTERVAL '14 days'
        ORDER BY entry_date ASC
      `;
      const trendResult = await db.query(trendQuery, [userId]);
      const entries = trendResult.rows;

      // Calculate trend direction
      let trendDirection = 'insufficient_data';
      if (entries.length >= 4) {
        const firstHalf = entries.slice(0, Math.floor(entries.length / 2));
        const secondHalf = entries.slice(Math.floor(entries.length / 2));
        const avgFirst = firstHalf.reduce((s, e) => s + parseFloat(e.mood_score), 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((s, e) => s + parseFloat(e.mood_score), 0) / secondHalf.length;
        const diff = avgSecond - avgFirst;
        if (diff > 0.3) trendDirection = 'improving';
        else if (diff < -0.3) trendDirection = 'declining';
        else trendDirection = 'stable';
      }

      // Sleep-mood correlation
      const sleepCorrelation = await this.detectMoodSleepCorrelation(userId);

      // Recent patterns from journal
      const patternsQuery = `
        SELECT content
        FROM luna_journal_entries
        WHERE user_id = $1 AND entry_type = 'theme'
        ORDER BY created_at DESC
        LIMIT 3
      `;
      const patternsResult = await db.query(patternsQuery, [userId]);

      return {
        recentEntries: entries,
        trendDirection,
        averageMood: entries.length > 0
          ? Math.round((entries.reduce((s, e) => s + parseFloat(e.mood_score), 0) / entries.length) * 100) / 100
          : null,
        sleepCorrelation,
        identifiedPatterns: patternsResult.rows.map(r => r.content)
      };
    } catch (error) {
      logger.error('Error generating data context', { error: error.message, userId });
      return { recentEntries: [], trendDirection: 'unknown', averageMood: null, sleepCorrelation: null, identifiedPatterns: [] };
    }
  }

  /**
   * Check whether sleep quality predicts mood for this user
   * using a simple correlation of sleep_quality vs next-day mood_score.
   *
   * @param {number} userId
   * @returns {Object|null} { correlation, strength, description }
   */
  static async detectMoodSleepCorrelation(userId) {
    try {
      const query = `
        SELECT
          a.sleep_quality,
          b.mood_score AS next_day_mood
        FROM mood_entries a
        JOIN mood_entries b
          ON b.user_id = a.user_id
          AND b.entry_date = a.entry_date + INTERVAL '1 day'
        WHERE a.user_id = $1
          AND a.sleep_quality IS NOT NULL
          AND b.mood_score IS NOT NULL
        ORDER BY a.entry_date DESC
        LIMIT 30
      `;
      const result = await db.query(query, [userId]);
      const pairs = result.rows;

      if (pairs.length < 5) return null;

      // Pearson correlation
      const n = pairs.length;
      const sleeps = pairs.map(p => parseFloat(p.sleep_quality));
      const moods = pairs.map(p => parseFloat(p.next_day_mood));

      const meanS = sleeps.reduce((a, b) => a + b, 0) / n;
      const meanM = moods.reduce((a, b) => a + b, 0) / n;

      let num = 0, denS = 0, denM = 0;
      for (let i = 0; i < n; i++) {
        const ds = sleeps[i] - meanS;
        const dm = moods[i] - meanM;
        num += ds * dm;
        denS += ds * ds;
        denM += dm * dm;
      }

      const denom = Math.sqrt(denS * denM);
      if (denom === 0) return null;

      const r = num / denom;
      const absR = Math.abs(r);

      let strength, description;
      if (absR >= 0.6) {
        strength = 'strong';
        description = r > 0
          ? 'Better sleep is strongly linked to better mood for you.'
          : 'Interestingly, longer sleep seems to coincide with lower mood — worth exploring.';
      } else if (absR >= 0.3) {
        strength = 'moderate';
        description = r > 0
          ? 'There appears to be a moderate link between your sleep and next-day mood.'
          : 'There may be a moderate inverse relationship between your sleep and mood.';
      } else {
        strength = 'weak';
        description = 'Sleep and mood don\'t show a clear connection for you yet.';
      }

      return {
        correlation: Math.round(r * 1000) / 1000,
        strength,
        description,
        sample_size: n
      };
    } catch (error) {
      logger.error('Error detecting mood-sleep correlation', { error: error.message, userId });
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Emotional Granularity
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Log when a user refines a broad emotion label into a more specific one.
   *
   * @param {number} userId
   * @param {string} initialLabel
   * @param {string} refinedLabel
   * @param {string} category
   * @returns {Object}
   */
  static async refineEmotion(userId, initialLabel, refinedLabel, category) {
    try {
      const query = `
        INSERT INTO luna_emotion_granularity (
          user_id, initial_label, refined_label, category, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;
      const result = await db.query(query, [userId, initialLabel, refinedLabel, category]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error logging emotion refinement', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Return the user's current emotional vocabulary level based on how many
   * distinct refined labels they've used.
   *
   * @param {number} userId
   * @returns {Object} { level, distinctLabels, totalRefinements }
   */
  static async getGranularityLevel(userId) {
    try {
      const query = `
        SELECT
          COUNT(DISTINCT refined_label) AS distinct_labels,
          COUNT(*)                      AS total_refinements
        FROM luna_emotion_granularity
        WHERE user_id = $1
      `;
      const result = await db.query(query, [userId]);
      const row = result.rows[0];
      const distinct = parseInt(row.distinct_labels, 10);

      let level;
      if (distinct >= 15) level = 'advanced';
      else if (distinct >= 8) level = 'intermediate';
      else if (distinct >= 3) level = 'developing';
      else level = 'beginner';

      return {
        level,
        distinctLabels: distinct,
        totalRefinements: parseInt(row.total_refinements, 10)
      };
    } catch (error) {
      logger.error('Error getting granularity level', { error: error.message, userId });
      return { level: 'beginner', distinctLabels: 0, totalRefinements: 0 };
    }
  }

  /**
   * Given a broad emotion label, return possible refined alternatives.
   *
   * @param {string} initialLabel
   * @returns {Array<string>}
   */
  static suggestRefinements(initialLabel) {
    const key = (initialLabel || '').toLowerCase().trim();
    return EMOTION_REFINEMENTS[key] || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  User Profile
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get or create a therapeutic profile for the user.
   *
   * @param {number} userId
   * @returns {Object} profile
   */
  static async getProfile(userId) {
    try {
      const query = `
        SELECT * FROM luna_profiles
        WHERE user_id = $1
      `;
      const result = await db.query(query, [userId]);

      if (result.rows.length > 0) {
        return result.rows[0];
      }

      // Create default profile
      const defaultProfile = {
        communication_style: 'warm',
        preferred_modality: 'cbt',
        session_count: 0,
        crisis_protocol_shown: false,
        preferred_name: null
      };

      const insertQuery = `
        INSERT INTO luna_profiles (user_id, profile_data, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        RETURNING *
      `;
      const insertResult = await db.query(insertQuery, [userId, JSON.stringify(defaultProfile)]);
      return insertResult.rows[0];
    } catch (error) {
      logger.error('Error getting Luna profile', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update the user's therapeutic profile.
   *
   * @param {number} userId
   * @param {Object} updates
   * @returns {Object} updated profile
   */
  static async updateProfile(userId, updates) {
    try {
      await this.getProfile(userId); // ensure exists

      const query = `
        UPDATE luna_profiles
        SET profile_data = profile_data || $2::jsonb,
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
      `;
      const result = await db.query(query, [userId, JSON.stringify(updates)]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating Luna profile', { error: error.message, userId });
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Conversation Processing (Main Entry Point)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Process an incoming user message and return a structured response.
   *
   * @param {number} userId
   * @param {string} message
   * @param {string|null} sessionId
   * @returns {Object} { response, suggestedTechnique, moodDetected, crisisDetected, sessionContext }
   */
  static async processMessage(userId, message, sessionId = null) {
    try {
      const lowerMsg = (message || '').toLowerCase();

      // 1. Crisis detection (highest priority — NEVER delegated to a provider).
      const crisisDetected = this._detectCrisis(lowerMsg);
      if (crisisDetected) {
        await this.addJournalEntry(userId, 'concern', 'Crisis language detected in conversation', sessionId);
        const crisisResponse = safetyFilter.buildResponse();
        aiAudit.safeAppend({
          userId,
          conversationId: sessionId,
          provider: 'crisis_filter',
          userMessage: message,
          modelResponse: crisisResponse,
          safetyVerdict: { crisisDetected: true },
          outputClassification: 'crisis_response',
          latencyMs: 0
        });
        return {
          response: crisisResponse,
          suggestedTechnique: null,
          moodDetected: 'crisis',
          crisisDetected: true,
          sessionContext: null
        };
      }

      // 2. Sentiment + theme (one extraction, reused for journaling and provider input).
      const moodDetected = this._analyzeSentiment(lowerMsg);
      const theme = this._extractTheme(lowerMsg);

      // 3. Context (session, data, profile in parallel).
      const [sessionContext, dataContext, profile] = await Promise.all([
        this.getSessionContext(userId),
        this.generateDataContext(userId),
        this.getProfile(userId)
      ]);

      // 4. Mood score → technique recommendation.
      const moodScore = this._moodToScore(moodDetected);
      let suggestedTechnique = null;
      if (moodScore <= 3) {
        suggestedTechnique = await this.recommendTechnique(userId, moodScore);
      }

      // 5. Parse profile data — needed for per-user LLM opt-in AND session counter.
      const profileData = typeof profile.profile_data === 'string'
        ? JSON.parse(profile.profile_data)
        : (profile.profile_data || {});

      // 6. Delegate response generation. Two-tier consent for the LLM provider:
      //    (a) LUNA_PROVIDER env enables the LLM provider at the deployment level
      //    (b) profile.llm_opted_in === true enables it for THIS user
      //    If EITHER is missing, the user transparently gets rule-based.
      //    A provider error falls through to a fresh rule-based instance.
      const providerInput = {
        userId,
        message,
        mood: moodDetected,
        theme,
        sessionContext,
        dataContext,
        technique: suggestedTechnique
      };
      const userOptedIn = profileData.llm_opted_in === true;
      const provider = userOptedIn
        ? responseGeneratorFactory.getProvider()
        : new RuleBasedResponseGenerator();
      let response;
      let usedFallback = false;
      const auditStart = Date.now();
      try {
        response = await provider.generate(providerInput);
      } catch (providerError) {
        usedFallback = true;
        logger.warn('Luna response provider failed; falling back to rule_based', {
          provider: provider.name,
          error: providerError.message,
          userId
        });
        // Direct instantiation avoids polluting the factory cache.
        const fallback = new RuleBasedResponseGenerator();
        response = await fallback.generate(providerInput);
      }
      const auditLatencyMs = Date.now() - auditStart;
      aiAudit.safeAppend({
        userId,
        conversationId: sessionId,
        provider: usedFallback ? 'rule_based' : provider.name,
        modelVersion: (!usedFallback && provider.name === 'anthropic')
          ? (process.env.LUNA_LLM_MODEL || 'claude-haiku-4-5-20251001')
          : null,
        userMessage: message,
        modelResponse: response,
        safetyVerdict: { crisisDetected: false },
        outputClassification: usedFallback
          ? 'fallback'
          : (provider.name === 'anthropic' ? 'llm' : 'rule_based'),
        latencyMs: auditLatencyMs
      });

      // 7. Log theme (best-effort — must never block the response).
      if (theme) {
        try {
          await this.addJournalEntry(userId, 'theme', theme, sessionId);
        } catch (journalErr) {
          logger.warn('Failed to log theme to journal', { error: journalErr.message, userId });
        }
      }

      // 8. Update session count.
      await this.updateProfile(userId, {
        session_count: (profileData.session_count || 0) + 1
      });

      return {
        response,
        suggestedTechnique: suggestedTechnique
          ? { type: suggestedTechnique.technique_type, name: suggestedTechnique.technique_name }
          : null,
        moodDetected,
        crisisDetected: false,
        sessionContext: {
          themes: sessionContext.keyThemes,
          trendDirection: dataContext.trendDirection,
          averageMood: dataContext.averageMood
        }
      };
    } catch (error) {
      logger.error('Error processing Luna message', { error: error.message, userId });
      return {
        response: "I'm here with you. Could you tell me a bit more about how you're feeling right now?",
        suggestedTechnique: null,
        moodDetected: 'unknown',
        crisisDetected: false,
        sessionContext: null
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Private Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check message for crisis keywords.
   *
   * Delegates to the centralised UK-localised SafetyFilter so all
   * Luna response paths (rule-based + future LLM-backed) share an
   * identical, externally-auditable detection contract.
   *
   * @private
   */
  static _detectCrisis(lowerMsg) {
    return safetyFilter.detect(lowerMsg);
  }

  /**
   * Simple keyword-based sentiment analysis.
   * @private
   */
  static _analyzeSentiment(lowerMsg) {
    const negCount = NEGATIVE_KEYWORDS.filter(kw => lowerMsg.includes(kw)).length;
    const posCount = POSITIVE_KEYWORDS.filter(kw => lowerMsg.includes(kw)).length;

    if (negCount > posCount) {
      // Return the most specific negative keyword found
      const found = NEGATIVE_KEYWORDS.filter(kw => lowerMsg.includes(kw));
      return found[0] || 'negative';
    }
    if (posCount > negCount) {
      const found = POSITIVE_KEYWORDS.filter(kw => lowerMsg.includes(kw));
      return found[0] || 'positive';
    }
    if (negCount > 0 && posCount > 0) return 'mixed';
    return 'neutral';
  }

  /**
   * Map a detected mood label to a 1-5 score.
   * @private
   */
  static _moodToScore(mood) {
    const map = {
      crisis: 1,
      hopeless: 1,
      depressed: 1,
      sad: 2,
      anxious: 2,
      lonely: 2,
      angry: 2,
      frustrated: 2,
      overwhelmed: 2,
      worried: 2,
      stressed: 3,
      tired: 3,
      exhausted: 3,
      negative: 2,
      mixed: 3,
      neutral: 3,
      calm: 4,
      better: 4,
      good: 4,
      grateful: 4,
      hopeful: 4,
      peaceful: 4,
      happy: 5,
      great: 5,
      excited: 5,
      proud: 5,
      positive: 4
    };
    return map[mood] || 3;
  }

  /**
   * Extract a rough "theme" from the message for journaling.
   * @private
   */
  static _extractTheme(lowerMsg) {
    const themePatterns = [
      { pattern: /(?:work|job|boss|career|colleague)/,   theme: 'work stress' },
      { pattern: /(?:relationship|partner|boyfriend|girlfriend|spouse|marriage)/, theme: 'relationship concerns' },
      { pattern: /(?:family|parent|mother|father|sibling|child)/, theme: 'family dynamics' },
      { pattern: /(?:sleep|insomnia|tired|exhausted)/,   theme: 'sleep difficulties' },
      { pattern: /(?:lonely|alone|isolated|no friends)/,  theme: 'loneliness' },
      { pattern: /(?:money|financial|debt|bills)/,         theme: 'financial stress' },
      { pattern: /(?:health|sick|pain|illness)/,           theme: 'health concerns' },
      { pattern: /(?:school|study|exam|grades|class)/,     theme: 'academic pressure' },
      { pattern: /(?:future|purpose|meaning|direction)/,   theme: 'existential concerns' },
      { pattern: /(?:grief|loss|death|died|passed away)/,  theme: 'grief and loss' }
    ];

    for (const { pattern, theme } of themePatterns) {
      if (pattern.test(lowerMsg)) return theme;
    }

    return null;
  }
}

module.exports = LunaService;

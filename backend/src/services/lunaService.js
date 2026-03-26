/**
 * Luna 2.0 — Enhanced Chatbot Service
 *
 * Provides longitudinal memory, adaptive therapeutic matching,
 * data-informed conversations, emotional granularity training,
 * user profiling, and conversation processing with crisis detection.
 */

const db = require('../config/database');
const logger = require('../config/logger');

// ─── Keyword dictionaries ─────────────────────────────────────────────────────

const CRISIS_KEYWORDS = [
  'suicide', 'kill myself', 'end it all', 'self-harm',
  'cutting', 'overdose', 'die', 'no point living'
];

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

      return {
        lastSessionSummary: lastSummary ? lastSummary.content : null,
        lastSessionDate: lastSummary ? lastSummary.created_at : null,
        keyThemes: themes,
        recentMood: moodResult.rows
      };
    } catch (error) {
      logger.error('Error building session context', { error: error.message, userId });
      return { lastSessionSummary: null, lastSessionDate: null, keyThemes: [], recentMood: [] };
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

      // 1. Crisis detection (highest priority)
      const crisisDetected = this._detectCrisis(lowerMsg);

      if (crisisDetected) {
        // Log the crisis event
        await this.addJournalEntry(userId, 'concern', 'Crisis language detected in conversation', sessionId);

        return {
          response:
            'I\'m really concerned about what you\'re sharing, and I want you to know you\'re not alone. ' +
            'What you\'re feeling is serious, and you deserve immediate support from someone trained to help. ' +
            'Please reach out to the 988 Suicide & Crisis Lifeline by calling or texting 988, or contact the ' +
            'Crisis Text Line by texting HOME to 741741. If you\'re in immediate danger, please call 911. ' +
            'I care about your safety — will you reach out to one of these resources right now?',
          suggestedTechnique: null,
          moodDetected: 'crisis',
          crisisDetected: true,
          sessionContext: null
        };
      }

      // 2. Sentiment analysis
      const moodDetected = this._analyzeSentiment(lowerMsg);

      // 3. Get session context & data context
      const [sessionContext, dataContext, profile] = await Promise.all([
        this.getSessionContext(userId),
        this.generateDataContext(userId),
        this.getProfile(userId)
      ]);

      // 4. Determine mood score for technique recommendation
      const moodScore = this._moodToScore(moodDetected);

      // 5. Get recommended technique
      let suggestedTechnique = null;
      if (moodScore <= 3) {
        suggestedTechnique = await this.recommendTechnique(userId, moodScore);
      }

      // 6. Build response
      const response = this._buildResponse(message, moodDetected, sessionContext, dataContext, suggestedTechnique);

      // 7. Log theme if we can extract one
      const theme = this._extractTheme(lowerMsg);
      if (theme) {
        await this.addJournalEntry(userId, 'theme', theme, sessionId);
      }

      // 8. Update session count
      const profileData = typeof profile.profile_data === 'string'
        ? JSON.parse(profile.profile_data)
        : (profile.profile_data || {});
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
        response: 'I\'m here with you. Could you tell me a bit more about how you\'re feeling right now?',
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
   * @private
   */
  static _detectCrisis(lowerMsg) {
    return CRISIS_KEYWORDS.some(kw => lowerMsg.includes(kw));
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
   * Build the final text response based on mood, context, and suggested technique.
   * @private
   */
  static _buildResponse(message, mood, sessionContext, dataContext, technique) {
    const parts = [];

    // Opening — empathetic acknowledgement
    if (mood === 'neutral' || mood === 'unknown') {
      parts.push('Thank you for sharing. I\'m here and listening.');
    } else if (['happy', 'good', 'great', 'excited', 'proud', 'positive', 'calm', 'grateful', 'hopeful', 'peaceful', 'better'].includes(mood)) {
      parts.push('It\'s really good to hear that. I\'m glad you\'re in that space right now.');
    } else {
      parts.push('I hear you, and I\'m sorry you\'re going through this. What you\'re feeling is real and it matters.');
    }

    // Data-informed observation (if we have trend data)
    if (dataContext.trendDirection === 'improving' && !['happy', 'good', 'great', 'positive'].includes(mood)) {
      parts.push('I also want you to know that looking at your recent data, things have been gradually trending upward, even if today feels hard.');
    } else if (dataContext.trendDirection === 'declining') {
      parts.push('I\'ve noticed your mood has been dipping over the past couple of weeks. That takes courage to sit with, and it\'s exactly why checking in matters.');
    }

    // Continuity from previous sessions
    if (sessionContext.keyThemes && sessionContext.keyThemes.length > 0) {
      parts.push(`Last time, we touched on "${sessionContext.keyThemes[0]}." Would you like to pick that thread back up, or is something else more present for you today?`);
    }

    // Technique suggestion
    if (technique && technique.strategy) {
      const theme = this._extractTheme((message || '').toLowerCase()) || 'what you\'re experiencing';
      const strategyText = technique.strategy.template(theme);
      parts.push(strategyText);
    }

    // Combine and trim to ~200 words
    let response = parts.join(' ');
    const words = response.split(/\s+/);
    if (words.length > 200) {
      response = words.slice(0, 200).join(' ') + '...';
    }

    return response;
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

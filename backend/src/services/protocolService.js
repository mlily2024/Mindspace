/**
 * Digital Therapeutic Protocols Service
 * Manages predefined therapeutic protocols, user enrollment,
 * session progression, and completion tracking.
 */

const db = require('../config/database');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

class ProtocolService {
  /**
   * Seed the 6 predefined therapeutic protocols if they don't already exist.
   */
  static async seedProtocols() {
    try {
      const existing = await db.query(`SELECT COUNT(*) AS count FROM therapeutic_protocols`);
      if (parseInt(existing.rows[0].count) >= 6) {
        logger.info('Protocols already seeded, skipping');
        return { status: 'already_seeded', count: parseInt(existing.rows[0].count) };
      }

      const protocols = this._getProtocolDefinitions();

      for (const proto of protocols) {
        const existsCheck = await db.query(
          `SELECT id FROM therapeutic_protocols WHERE slug = $1`,
          [proto.slug]
        );

        if (existsCheck.rows.length > 0) continue;

        await db.query(
          `INSERT INTO therapeutic_protocols
             (id, slug, name, approach, duration_weeks, total_sessions, target_condition,
              description, sessions, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())`,
          [
            uuidv4(),
            proto.slug,
            proto.name,
            proto.approach,
            proto.duration_weeks,
            proto.total_sessions,
            proto.target_condition,
            proto.description,
            JSON.stringify(proto.sessions)
          ]
        );
      }

      logger.info('Therapeutic protocols seeded', { count: protocols.length });
      return { status: 'seeded', count: protocols.length };
    } catch (error) {
      logger.error('Error seeding protocols', { error: error.message });
      throw error;
    }
  }

  /**
   * Return all active protocols.
   */
  static async getAvailableProtocols() {
    try {
      const result = await db.query(
        `SELECT id, slug, name, approach, duration_weeks, total_sessions,
                target_condition, description, is_active, created_at
         FROM therapeutic_protocols
         WHERE is_active = true
         ORDER BY name`
      );

      return result.rows;
    } catch (error) {
      logger.error('Error fetching protocols', { error: error.message });
      throw error;
    }
  }

  /**
   * Enroll a user in a protocol.
   * @param {string} userId
   * @param {string} protocolId
   * @param {number|null} preAssessmentScore
   * @returns {object} enrollment record
   */
  static async enrollUser(userId, protocolId, preAssessmentScore = null) {
    try {
      // Check protocol exists
      const protocol = await db.query(
        `SELECT * FROM therapeutic_protocols WHERE id = $1 AND is_active = true`,
        [protocolId]
      );
      if (protocol.rows.length === 0) {
        throw new Error('Protocol not found or inactive');
      }

      // Check not already enrolled
      const existingEnrollment = await db.query(
        `SELECT id, status FROM protocol_enrollments
         WHERE user_id = $1 AND protocol_id = $2 AND status = 'active'`,
        [userId, protocolId]
      );
      if (existingEnrollment.rows.length > 0) {
        throw new Error('User is already enrolled in this protocol');
      }

      const enrollmentId = uuidv4();
      const result = await db.query(
        `INSERT INTO protocol_enrollments
           (id, user_id, protocol_id, status, current_session, current_week,
            pre_assessment_score, enrolled_at)
         VALUES ($1, $2, $3, 'active', 1, 1, $4, NOW())
         RETURNING *`,
        [enrollmentId, userId, protocolId, preAssessmentScore]
      );

      logger.info('User enrolled in protocol', {
        userId,
        protocolId,
        protocolName: protocol.rows[0].name
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Error enrolling user', { userId, protocolId, error: error.message });
      throw error;
    }
  }

  /**
   * Get the current session content for a user's enrollment in a protocol.
   * @param {string} userId
   * @param {string} protocolId
   * @returns {object} current session content
   */
  static async getCurrentSession(userId, protocolId) {
    try {
      const enrollment = await db.query(
        `SELECT e.*, p.sessions, p.name AS protocol_name, p.total_sessions
         FROM protocol_enrollments e
         JOIN therapeutic_protocols p ON p.id = e.protocol_id
         WHERE e.user_id = $1 AND e.protocol_id = $2 AND e.status = 'active'`,
        [userId, protocolId]
      );

      if (enrollment.rows.length === 0) {
        return { status: 'not_enrolled', message: 'No active enrollment found for this protocol.' };
      }

      const row = enrollment.rows[0];
      const sessions = typeof row.sessions === 'string' ? JSON.parse(row.sessions) : row.sessions;
      const currentSessionNum = row.current_session;

      const session = sessions.find(s => s.session_number === currentSessionNum);
      if (!session) {
        return { status: 'completed', message: 'All sessions have been completed.' };
      }

      return {
        status: 'ok',
        protocolName: row.protocol_name,
        currentSession: currentSessionNum,
        totalSessions: row.total_sessions,
        currentWeek: row.current_week,
        session
      };
    } catch (error) {
      logger.error('Error fetching current session', { userId, protocolId, error: error.message });
      throw error;
    }
  }

  /**
   * Mark a session as complete and advance to the next session.
   * @param {string} userId
   * @param {string} protocolId
   * @param {number} sessionNumber
   * @param {object} data - session completion data (responses, notes, etc.)
   * @returns {object} updated enrollment
   */
  static async completeSession(userId, protocolId, sessionNumber, data = {}) {
    try {
      const enrollment = await db.query(
        `SELECT e.*, p.total_sessions, p.sessions, p.name AS protocol_name
         FROM protocol_enrollments e
         JOIN therapeutic_protocols p ON p.id = e.protocol_id
         WHERE e.user_id = $1 AND e.protocol_id = $2 AND e.status = 'active'`,
        [userId, protocolId]
      );

      if (enrollment.rows.length === 0) {
        throw new Error('No active enrollment found');
      }

      const row = enrollment.rows[0];

      if (row.current_session !== sessionNumber) {
        throw new Error(`Expected session ${row.current_session}, got ${sessionNumber}`);
      }

      // Record session completion
      await db.query(
        `INSERT INTO protocol_session_completions
           (id, enrollment_id, user_id, protocol_id, session_number, completion_data, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [uuidv4(), row.id, userId, protocolId, sessionNumber, JSON.stringify(data)]
      );

      const totalSessions = row.total_sessions;
      const isLastSession = sessionNumber >= totalSessions;

      // Determine next session and week
      const sessions = typeof row.sessions === 'string' ? JSON.parse(row.sessions) : row.sessions;
      const nextSessionNum = sessionNumber + 1;
      const nextSession = sessions.find(s => s.session_number === nextSessionNum);
      const nextWeek = nextSession ? nextSession.week : row.current_week;

      if (isLastSession) {
        // Complete the enrollment
        const updated = await db.query(
          `UPDATE protocol_enrollments
           SET status = 'completed', current_session = $3, completed_at = NOW()
           WHERE user_id = $1 AND protocol_id = $2 AND status = 'active'
           RETURNING *`,
          [userId, protocolId, sessionNumber]
        );

        logger.info('Protocol completed', { userId, protocolId, protocolName: row.protocol_name });

        return {
          status: 'protocol_completed',
          enrollment: updated.rows[0],
          message: `Congratulations! You have completed the ${row.protocol_name} protocol.`
        };
      }

      // Advance to next session
      const updated = await db.query(
        `UPDATE protocol_enrollments
         SET current_session = $3, current_week = $4
         WHERE user_id = $1 AND protocol_id = $2 AND status = 'active'
         RETURNING *`,
        [userId, protocolId, nextSessionNum, nextWeek]
      );

      logger.info('Session completed, advanced to next', {
        userId,
        protocolId,
        completedSession: sessionNumber,
        nextSession: nextSessionNum
      });

      return {
        status: 'session_completed',
        enrollment: updated.rows[0],
        completedSession: sessionNumber,
        nextSession: nextSessionNum,
        nextWeek
      };
    } catch (error) {
      logger.error('Error completing session', { userId, protocolId, sessionNumber, error: error.message });
      throw error;
    }
  }

  /**
   * Get enrollment progress for a specific protocol.
   * @param {string} userId
   * @param {string} protocolId
   * @returns {object} progress details
   */
  static async getProgress(userId, protocolId) {
    try {
      const enrollment = await db.query(
        `SELECT e.*, p.total_sessions, p.duration_weeks, p.name AS protocol_name
         FROM protocol_enrollments e
         JOIN therapeutic_protocols p ON p.id = e.protocol_id
         WHERE e.user_id = $1 AND e.protocol_id = $2
         ORDER BY e.enrolled_at DESC LIMIT 1`,
        [userId, protocolId]
      );

      if (enrollment.rows.length === 0) {
        return { status: 'not_enrolled', message: 'No enrollment found for this protocol.' };
      }

      const row = enrollment.rows[0];

      // Count completed sessions
      const completions = await db.query(
        `SELECT COUNT(*) AS completed_count
         FROM protocol_session_completions
         WHERE enrollment_id = $1`,
        [row.id]
      );

      const completedCount = parseInt(completions.rows[0].completed_count);
      const totalSessions = row.total_sessions;

      // Calculate adherence: completed sessions / expected sessions based on elapsed time
      const enrolledAt = new Date(row.enrolled_at);
      const now = new Date();
      const daysSinceEnrollment = Math.max(1, Math.floor((now - enrolledAt) / (1000 * 60 * 60 * 24)));
      const sessionsPerWeek = totalSessions / row.duration_weeks;
      const expectedSessions = Math.min(totalSessions, Math.floor((daysSinceEnrollment / 7) * sessionsPerWeek) + 1);
      const adherencePct = expectedSessions > 0
        ? Math.min(100, Math.round((completedCount / expectedSessions) * 100))
        : 100;

      return {
        status: 'ok',
        protocolName: row.protocol_name,
        enrollmentStatus: row.status,
        currentSession: row.current_session,
        currentWeek: row.current_week,
        totalSessions,
        completedSessions: completedCount,
        progressPct: Math.round((completedCount / totalSessions) * 100),
        adherencePct,
        enrolledAt: row.enrolled_at,
        completedAt: row.completed_at
      };
    } catch (error) {
      logger.error('Error fetching progress', { userId, protocolId, error: error.message });
      throw error;
    }
  }

  /**
   * Get all protocol enrollments for a user with progress info.
   * @param {string} userId
   * @returns {object[]} enrollments with progress
   */
  static async getUserProtocols(userId) {
    try {
      const result = await db.query(
        `SELECT e.*, p.name AS protocol_name, p.approach, p.duration_weeks,
                p.total_sessions, p.target_condition,
                (SELECT COUNT(*) FROM protocol_session_completions c WHERE c.enrollment_id = e.id) AS completed_sessions
         FROM protocol_enrollments e
         JOIN therapeutic_protocols p ON p.id = e.protocol_id
         WHERE e.user_id = $1
         ORDER BY e.enrolled_at DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        enrollmentId: row.id,
        protocolId: row.protocol_id,
        protocolName: row.protocol_name,
        approach: row.approach,
        targetCondition: row.target_condition,
        status: row.status,
        currentSession: row.current_session,
        currentWeek: row.current_week,
        totalSessions: row.total_sessions,
        completedSessions: parseInt(row.completed_sessions),
        progressPct: Math.round((parseInt(row.completed_sessions) / row.total_sessions) * 100),
        enrolledAt: row.enrolled_at,
        completedAt: row.completed_at
      }));
    } catch (error) {
      logger.error('Error fetching user protocols', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Unenroll a user from a protocol (mark as abandoned).
   * @param {string} userId
   * @param {string} protocolId
   * @returns {object} updated enrollment
   */
  static async unenroll(userId, protocolId) {
    try {
      const result = await db.query(
        `UPDATE protocol_enrollments
         SET status = 'abandoned', completed_at = NOW()
         WHERE user_id = $1 AND protocol_id = $2 AND status = 'active'
         RETURNING *`,
        [userId, protocolId]
      );

      if (result.rows.length === 0) {
        throw new Error('No active enrollment found to unenroll from');
      }

      logger.info('User unenrolled from protocol', { userId, protocolId });

      return result.rows[0];
    } catch (error) {
      logger.error('Error unenrolling user', { userId, protocolId, error: error.message });
      throw error;
    }
  }

  // ─── Protocol definitions ─────────────────────────────────────────

  static _getProtocolDefinitions() {
    return [
      {
        slug: 'behavioral-activation',
        name: 'Behavioral Activation',
        approach: 'CBT',
        duration_weeks: 4,
        total_sessions: 12,
        target_condition: 'depression',
        description: 'A structured CBT-based program that helps you re-engage with meaningful activities to improve mood. You will learn to identify mood-activity connections and gradually increase positive behaviours.',
        sessions: [
          {
            session_number: 1,
            week: 1,
            title: 'Understanding the Activity-Mood Link',
            description: 'Learn how reduced activity maintains low mood and how increasing activity can break the cycle.',
            instructions: 'Read the psychoeducation material, then log all activities from yesterday and rate your mood during each. Identify which activities were associated with better or worse moods.',
            exercise_type: 'activity_logging',
            estimated_minutes: 20,
            key_concepts: ['behavioral withdrawal', 'activity-mood cycle', 'self-monitoring']
          },
          {
            session_number: 2,
            week: 1,
            title: 'Activity Monitoring Baseline',
            description: 'Establish a baseline of your current daily activities and associated mood ratings.',
            instructions: 'For each hour of the day, record what you did and rate your mood (1-10). Note which activities felt meaningful (mastery) vs enjoyable (pleasure).',
            exercise_type: 'activity_logging',
            estimated_minutes: 15,
            key_concepts: ['mastery activities', 'pleasure activities', 'baseline measurement']
          },
          {
            session_number: 3,
            week: 1,
            title: 'Identifying Values and Goals',
            description: 'Connect activities to your personal values to find motivation for change.',
            instructions: 'List your top 5 values (e.g., family, health, creativity). For each value, brainstorm 3 activities that align with it. Rate how often you currently do each.',
            exercise_type: 'values_assessment',
            estimated_minutes: 25,
            key_concepts: ['personal values', 'value-aligned activities', 'intrinsic motivation']
          },
          {
            session_number: 4,
            week: 2,
            title: 'Pleasant Activity Scheduling',
            description: 'Plan specific pleasant activities for the coming week.',
            instructions: 'Choose 3-5 enjoyable activities from your values list. Schedule them into specific time slots this week. Start small — even 10 minutes counts. Write down potential obstacles and how you will handle them.',
            exercise_type: 'activity_scheduling',
            estimated_minutes: 20,
            key_concepts: ['activity scheduling', 'graded tasks', 'obstacle planning']
          },
          {
            session_number: 5,
            week: 2,
            title: 'Reviewing Your First Scheduled Activities',
            description: 'Review how the scheduled activities went and what you learned.',
            instructions: 'For each scheduled activity: Did you do it? Rate mood before and after. What went well? What got in the way? Adjust your plan for next week based on what you learned.',
            exercise_type: 'reflection',
            estimated_minutes: 15,
            key_concepts: ['self-reflection', 'mood tracking', 'iterative planning']
          },
          {
            session_number: 6,
            week: 2,
            title: 'Mood-Activity Correlation Review',
            description: 'Analyse the relationship between your activities and mood patterns.',
            instructions: 'Review your mood and activity logs from the past 2 weeks. Identify your top 3 mood-boosting activities and your top 3 mood-draining situations. Create a personal "mood menu" of go-to activities.',
            exercise_type: 'analysis',
            estimated_minutes: 20,
            key_concepts: ['pattern recognition', 'mood menu', 'data-driven decisions']
          },
          {
            session_number: 7,
            week: 3,
            title: 'Gradual Activity Increase',
            description: 'Systematically increase the frequency and variety of positive activities.',
            instructions: 'Add 2-3 new activities to your weekly schedule. Include at least one mastery activity (something challenging but achievable) and one social activity. Use the "just 5 minutes" rule if motivation is low.',
            exercise_type: 'activity_scheduling',
            estimated_minutes: 20,
            key_concepts: ['graded exposure', 'mastery experiences', 'social activation']
          },
          {
            session_number: 8,
            week: 3,
            title: 'Overcoming Avoidance',
            description: 'Identify and address patterns of avoidance that maintain depression.',
            instructions: 'List 3 things you have been avoiding. For each, rate your anxiety (1-10) and identify what you fear will happen. Choose the least scary one and plan a small first step to tackle it this week.',
            exercise_type: 'cognitive_exercise',
            estimated_minutes: 25,
            key_concepts: ['avoidance patterns', 'graded exposure', 'behavioural experiments']
          },
          {
            session_number: 9,
            week: 3,
            title: 'Building Routine and Structure',
            description: 'Create a sustainable daily routine that supports wellbeing.',
            instructions: 'Design your ideal daily routine including: wake time, meals, physical activity, work/productive time, social time, relaxation, and sleep time. Start implementing it gradually — pick 2-3 anchors to establish first.',
            exercise_type: 'planning',
            estimated_minutes: 20,
            key_concepts: ['daily structure', 'anchor habits', 'routine building']
          },
          {
            session_number: 10,
            week: 4,
            title: 'Social Reconnection',
            description: 'Rebuild and strengthen social connections.',
            instructions: 'Identify 3 people you value but have lost touch with. Plan one concrete social activity this week (a call, a walk, a meal). Prepare for potential awkwardness by planning a conversation topic.',
            exercise_type: 'social_planning',
            estimated_minutes: 15,
            key_concepts: ['social support', 'relationship maintenance', 'social skills']
          },
          {
            session_number: 11,
            week: 4,
            title: 'Progress Review and Patterns',
            description: 'Review your overall progress and identify lasting patterns.',
            instructions: 'Compare your current activity levels and mood with your baseline from Session 2. What has improved? What is still challenging? Identify your 3 most important learnings from this protocol.',
            exercise_type: 'reflection',
            estimated_minutes: 20,
            key_concepts: ['progress monitoring', 'self-efficacy', 'pattern consolidation']
          },
          {
            session_number: 12,
            week: 4,
            title: 'Relapse Prevention Plan',
            description: 'Create a plan to maintain gains and handle future setbacks.',
            instructions: 'Write your personal relapse prevention plan: (1) Early warning signs that mood is dropping, (2) Your go-to mood-boosting activities, (3) People you can reach out to, (4) When to seek professional help. Keep this somewhere accessible.',
            exercise_type: 'planning',
            estimated_minutes: 25,
            key_concepts: ['relapse prevention', 'early warning signs', 'maintenance plan']
          }
        ]
      },
      {
        slug: 'sleep-restriction-therapy',
        name: 'Sleep Restriction Therapy',
        approach: 'CBT-I',
        duration_weeks: 3,
        total_sessions: 9,
        target_condition: 'insomnia',
        description: 'A CBT-I based program that improves sleep efficiency by consolidating sleep into a consistent window, then gradually expanding it as sleep quality improves.',
        sessions: [
          {
            session_number: 1,
            week: 1,
            title: 'Sleep Diary Baseline',
            description: 'Establish a baseline understanding of your current sleep patterns.',
            instructions: 'For the next 3 nights, record: time you got into bed, time you think you fell asleep, number of awakenings, time of final awakening, time you got out of bed, and rate sleep quality (1-10). Also note caffeine, alcohol, and screen use.',
            exercise_type: 'sleep_diary',
            estimated_minutes: 10,
            key_concepts: ['sleep hygiene', 'sleep diary', 'baseline measurement']
          },
          {
            session_number: 2,
            week: 1,
            title: 'Calculate Your Sleep Efficiency',
            description: 'Analyse your sleep diary to determine current sleep efficiency.',
            instructions: 'Calculate your average sleep efficiency: (total sleep time / total time in bed) x 100. A healthy target is 85%+. Also calculate your average total sleep time — this will set your initial sleep window.',
            exercise_type: 'analysis',
            estimated_minutes: 15,
            key_concepts: ['sleep efficiency', 'time in bed vs sleep time', 'sleep metrics']
          },
          {
            session_number: 3,
            week: 1,
            title: 'Set Your Initial Sleep Window',
            description: 'Define a restricted sleep window based on your actual sleep time.',
            instructions: 'Your initial sleep window = your average total sleep time (minimum 5.5 hours). Choose a fixed wake time that works every day (including weekends). Count back from wake time to set bedtime. Do NOT go to bed before your scheduled bedtime, even if tired.',
            exercise_type: 'planning',
            estimated_minutes: 15,
            key_concepts: ['sleep window', 'sleep restriction', 'consistent wake time']
          },
          {
            session_number: 4,
            week: 2,
            title: 'Stimulus Control',
            description: 'Learn to associate bed with sleep only.',
            instructions: 'Follow these rules: (1) Only go to bed when sleepy, (2) Use bed only for sleep, (3) If awake for 20+ minutes, get up and do something calming in another room, (4) Return to bed only when sleepy again, (5) Keep your fixed wake time no matter what.',
            exercise_type: 'behavioral_exercise',
            estimated_minutes: 10,
            key_concepts: ['stimulus control', 'bed-sleep association', 'conditioned arousal']
          },
          {
            session_number: 5,
            week: 2,
            title: 'Sleep Window Review — Week 1',
            description: 'Review sleep diary and adjust the sleep window.',
            instructions: 'Calculate your sleep efficiency for the past week. If efficiency >= 85%, expand your sleep window by 15 minutes (go to bed 15 minutes earlier). If 80-85%, keep the same window. If < 80%, reduce by 15 minutes (but never below 5.5 hours).',
            exercise_type: 'analysis',
            estimated_minutes: 15,
            key_concepts: ['sleep titration', 'progressive adjustment', 'efficiency threshold']
          },
          {
            session_number: 6,
            week: 2,
            title: 'Managing Daytime Sleepiness',
            description: 'Learn to handle the temporary increase in daytime sleepiness.',
            instructions: 'During sleep restriction, you may feel more tired during the day. This is normal and temporary. Strategies: take a brief walk when sleepy, splash cold water on your face, avoid naps longer than 20 minutes, avoid driving if very drowsy. Track your daytime alertness (1-10) three times today.',
            exercise_type: 'psychoeducation',
            estimated_minutes: 10,
            key_concepts: ['sleep pressure', 'homeostatic drive', 'daytime coping']
          },
          {
            session_number: 7,
            week: 3,
            title: 'Sleep Window Expansion',
            description: 'Continue gradually expanding your sleep window.',
            instructions: 'Review this week\'s sleep efficiency. Apply the same adjustment rules. By now you should be noticing faster sleep onset and fewer awakenings. If you are sleeping well within your window, add another 15 minutes. Record how long it takes you to fall asleep tonight.',
            exercise_type: 'analysis',
            estimated_minutes: 15,
            key_concepts: ['gradual expansion', 'sleep consolidation', 'sleep onset latency']
          },
          {
            session_number: 8,
            week: 3,
            title: 'Cognitive Techniques for Sleep',
            description: 'Address racing thoughts and sleep anxiety.',
            instructions: 'Practice these techniques tonight: (1) Constructive worry time — spend 15 minutes before your wind-down writing down worries and one action step for each, (2) Cognitive shuffling — once in bed, think of random unrelated words/images to occupy your mind, (3) Paradoxical intention — try to stay awake with eyes open.',
            exercise_type: 'cognitive_exercise',
            estimated_minutes: 20,
            key_concepts: ['cognitive restructuring', 'worry management', 'paradoxical intention']
          },
          {
            session_number: 9,
            week: 3,
            title: 'Maintenance and Long-Term Plan',
            description: 'Consolidate gains and create a sustainable sleep plan.',
            instructions: 'Review your progress: compare current sleep efficiency with your baseline. Write your long-term sleep plan: (1) Your optimal sleep window, (2) Your non-negotiable wake time, (3) Your wind-down routine, (4) Warning signs of slipping habits, (5) What to do if insomnia returns (re-restrict for a few days).',
            exercise_type: 'planning',
            estimated_minutes: 20,
            key_concepts: ['maintenance plan', 'sleep hygiene habits', 'relapse prevention']
          }
        ]
      },
      {
        slug: 'worry-time-protocol',
        name: 'Worry Time Protocol',
        approach: 'CBT',
        duration_weeks: 2,
        total_sessions: 6,
        target_condition: 'anxiety',
        description: 'A CBT-based protocol that helps contain and manage worry by scheduling dedicated worry time and learning to categorise and restructure anxious thoughts.',
        sessions: [
          {
            session_number: 1,
            week: 1,
            title: 'Worry Logging',
            description: 'Start tracking your worries to understand their patterns.',
            instructions: 'Carry a small notebook or use the app. Every time you notice a worry, jot down: (1) the worry in one sentence, (2) the time, (3) intensity (1-10), (4) whether it is about something you can control. Do not try to solve the worry yet — just log it and move on.',
            exercise_type: 'thought_logging',
            estimated_minutes: 15,
            key_concepts: ['worry awareness', 'thought monitoring', 'externalisation']
          },
          {
            session_number: 2,
            week: 1,
            title: 'Scheduled Worry Time',
            description: 'Designate a daily 15-minute window for worry processing.',
            instructions: 'Choose a consistent 15-minute slot (not close to bedtime). During this time, review your worry log and give each worry your full attention. Outside this window, when a worry arises, note it and remind yourself: "I will deal with this during worry time." Practice postponing worries today.',
            exercise_type: 'behavioral_exercise',
            estimated_minutes: 20,
            key_concepts: ['stimulus control', 'worry postponement', 'containment']
          },
          {
            session_number: 3,
            week: 1,
            title: 'Worry Categorisation',
            description: 'Learn to sort worries into actionable and unactionable categories.',
            instructions: 'Review your worry log. For each worry, ask: "Is there something I can actually DO about this?" Sort into two lists: (A) Actionable worries — write one concrete next step for each, (B) Unactionable worries — practise saying "I notice this worry, and I choose to let it go for now." Note which category has more entries.',
            exercise_type: 'cognitive_exercise',
            estimated_minutes: 20,
            key_concepts: ['worry types', 'problem-solving vs acceptance', 'controllability']
          },
          {
            session_number: 4,
            week: 2,
            title: 'Cognitive Restructuring for Worry',
            description: 'Challenge and reframe catastrophic thinking patterns.',
            instructions: 'Pick your top 3 worries from this week. For each one, answer: (1) What is the worst that could happen? (2) What is the best that could happen? (3) What is MOST LIKELY to happen? (4) If the worst happened, could I cope? (5) What would I tell a friend with this worry?',
            exercise_type: 'cognitive_exercise',
            estimated_minutes: 25,
            key_concepts: ['cognitive restructuring', 'decatastrophising', 'perspective taking']
          },
          {
            session_number: 5,
            week: 2,
            title: 'Worry Exposure',
            description: 'Reduce worry intensity through controlled exposure.',
            instructions: 'Choose one moderate worry. Set a timer for 10 minutes and deliberately focus on the worry without trying to solve or suppress it. Notice the anxiety rise and eventually plateau or decrease. Rate your anxiety at minutes 0, 5, and 10. This demonstrates that anxiety is temporary and tolerable.',
            exercise_type: 'exposure_exercise',
            estimated_minutes: 20,
            key_concepts: ['habituation', 'exposure', 'anxiety tolerance', 'emotional surfing']
          },
          {
            session_number: 6,
            week: 2,
            title: 'Worry Management Toolkit',
            description: 'Build your personal worry management toolkit for the future.',
            instructions: 'Create your personal toolkit document: (1) Your scheduled worry time slot, (2) Your go-to worry postponement phrase, (3) 3 actionable-worry strategies, (4) 3 unactionable-worry acceptance strategies, (5) Your cognitive restructuring questions, (6) One physical relaxation technique (deep breathing, progressive muscle relaxation).',
            exercise_type: 'planning',
            estimated_minutes: 20,
            key_concepts: ['coping toolkit', 'self-management', 'maintenance']
          }
        ]
      },
      {
        slug: 'distress-tolerance-skills',
        name: 'Distress Tolerance Skills',
        approach: 'DBT',
        duration_weeks: 4,
        total_sessions: 8,
        target_condition: 'emotional crises',
        description: 'A DBT-based skills program that builds your capacity to tolerate distressing emotions without resorting to harmful coping strategies. Teaches crisis survival and reality acceptance skills.',
        sessions: [
          {
            session_number: 1,
            week: 1,
            title: 'TIPP Technique',
            description: 'Learn the TIPP technique for rapid emotional de-escalation.',
            instructions: 'TIPP stands for: Temperature (hold ice cubes, splash cold water on face), Intense exercise (run, jump, push-ups for 10 min), Paced breathing (inhale 4 counts, exhale 6 counts), Paired muscle relaxation (tense and release muscle groups). Practise each component today. Rate your distress before and after.',
            exercise_type: 'skills_practice',
            estimated_minutes: 25,
            key_concepts: ['TIPP', 'crisis survival', 'physiological regulation', 'dive reflex']
          },
          {
            session_number: 2,
            week: 1,
            title: 'Radical Acceptance',
            description: 'Learn to accept reality as it is without judgement.',
            instructions: 'Radical acceptance does NOT mean approval — it means acknowledging reality instead of fighting it. Think of one situation causing you pain that you cannot change. Practise saying: "This is what is happening right now. Fighting reality only adds suffering." Notice the difference between pain (unavoidable) and suffering (resistance to pain).',
            exercise_type: 'mindfulness_exercise',
            estimated_minutes: 20,
            key_concepts: ['radical acceptance', 'pain vs suffering', 'reality acknowledgement']
          },
          {
            session_number: 3,
            week: 2,
            title: 'Self-Soothing with Five Senses',
            description: 'Build a personalised self-soothing toolkit using all five senses.',
            instructions: 'For each sense, identify 2-3 soothing activities: Sight (nature photos, candles), Sound (calming music, rain sounds), Smell (essential oils, fresh air), Taste (herbal tea, favourite snack mindfully), Touch (soft blanket, warm bath). Create a physical or digital "comfort box" with items for each sense. Use one tonight.',
            exercise_type: 'skills_practice',
            estimated_minutes: 20,
            key_concepts: ['self-soothing', 'sensory grounding', 'comfort box']
          },
          {
            session_number: 4,
            week: 2,
            title: 'Distraction Skills (ACCEPTS)',
            description: 'Learn healthy distraction techniques for crisis moments.',
            instructions: 'ACCEPTS: Activities (hobbies, chores), Contributing (help someone), Comparisons (recall times you coped), Emotions (watch a comedy, listen to upbeat music), Pushing away (mentally put the problem in a box for later), Thoughts (count, puzzle, recite lyrics), Sensations (hold ice, snap a rubber band). Pick 3 that appeal to you and use one today.',
            exercise_type: 'skills_practice',
            estimated_minutes: 20,
            key_concepts: ['ACCEPTS', 'healthy distraction', 'crisis management']
          },
          {
            session_number: 5,
            week: 3,
            title: 'Pros and Cons Analysis',
            description: 'Use pros/cons to make wise decisions during emotional crises.',
            instructions: 'Think of an urge you experience when distressed (e.g., lashing out, withdrawing, substance use). Create a 2x2 grid: (1) Pros of acting on urge, (2) Cons of acting on urge, (3) Pros of resisting urge, (4) Cons of resisting urge. Be honest in all four quadrants. Review this grid when the urge arises.',
            exercise_type: 'cognitive_exercise',
            estimated_minutes: 20,
            key_concepts: ['pros and cons', 'urge surfing', 'wise mind decisions']
          },
          {
            session_number: 6,
            week: 3,
            title: 'Turning the Mind',
            description: 'Practise consciously choosing acceptance over and over.',
            instructions: 'Turning the mind is the CHOICE to accept, made repeatedly. Identify something you are struggling to accept. Set 3 reminders today. At each reminder, notice if you have turned away from acceptance, and gently turn back. It is normal to need to turn your mind many times — this is not failure, it is practice.',
            exercise_type: 'mindfulness_exercise',
            estimated_minutes: 15,
            key_concepts: ['turning the mind', 'repeated choice', 'willingness']
          },
          {
            session_number: 7,
            week: 4,
            title: 'Building a Crisis Survival Plan',
            description: 'Create a personalised step-by-step crisis plan.',
            instructions: 'Write your crisis plan: Step 1 — Recognise the crisis (my warning signs are...), Step 2 — TIPP to stabilise, Step 3 — ACCEPTS to distract, Step 4 — Self-soothe, Step 5 — Pros and cons if urges are strong, Step 6 — Radical acceptance, Step 7 — Reach out (list 3 people and a crisis line). Keep this plan accessible.',
            exercise_type: 'planning',
            estimated_minutes: 25,
            key_concepts: ['crisis plan', 'step-by-step protocol', 'safety planning']
          },
          {
            session_number: 8,
            week: 4,
            title: 'Integration and Practice',
            description: 'Review all skills and practise applying them to scenarios.',
            instructions: 'Review each skill learned: TIPP, radical acceptance, self-soothing, ACCEPTS, pros/cons, turning the mind. For each, rate your confidence (1-10) in using it during a crisis. Pick your weakest skill and practise it today. Write a brief reflection on which skills feel most natural and plan to strengthen the others.',
            exercise_type: 'reflection',
            estimated_minutes: 20,
            key_concepts: ['skill integration', 'confidence building', 'ongoing practice']
          }
        ]
      },
      {
        slug: 'values-clarification',
        name: 'Values Clarification',
        approach: 'ACT',
        duration_weeks: 2,
        total_sessions: 6,
        target_condition: 'meaninglessness',
        description: 'An ACT-based program that helps you clarify your core values, identify gaps between values and actions, and commit to living more consistently with what truly matters to you.',
        sessions: [
          {
            session_number: 1,
            week: 1,
            title: 'Values Card Sort',
            description: 'Discover your core values through a guided sorting exercise.',
            instructions: 'Review the following value categories and rate each as "Very Important", "Somewhat Important", or "Not Important": Family, Friendship, Romance, Health, Work/Career, Education, Spirituality, Creativity, Adventure, Community, Independence, Compassion, Honesty, Humour, Nature, Justice. Select your top 5 and rank them.',
            exercise_type: 'values_assessment',
            estimated_minutes: 25,
            key_concepts: ['core values', 'values identification', 'self-knowledge']
          },
          {
            session_number: 2,
            week: 1,
            title: 'Life Areas Assessment',
            description: 'Evaluate how well your current life aligns with your values.',
            instructions: 'For each of your top 5 values, rate two things on a 1-10 scale: (1) How important is this value to me? (2) How consistently am I living according to this value? The gap between importance and consistency reveals where to focus. Write one observation about each gap.',
            exercise_type: 'assessment',
            estimated_minutes: 20,
            key_concepts: ['values-action gap', 'life assessment', 'discrepancy awareness']
          },
          {
            session_number: 3,
            week: 1,
            title: 'Values vs Goals',
            description: 'Understand the difference between values (directions) and goals (destinations).',
            instructions: 'Values are like compass directions — you never "arrive" at them. Goals are specific achievements along the way. For each of your top 3 values, write: (1) The value as a direction (e.g., "Being a caring partner"), (2) Three specific goals that serve this value (e.g., "Plan a date night this week"). Notice that achieving goals does not "complete" the value.',
            exercise_type: 'cognitive_exercise',
            estimated_minutes: 20,
            key_concepts: ['values as directions', 'goals as milestones', 'ongoing commitment']
          },
          {
            session_number: 4,
            week: 2,
            title: 'Values-Action Gaps',
            description: 'Identify specific barriers preventing value-consistent living.',
            instructions: 'For your biggest values-action gap: (1) What specific behaviours would show this value in action? (2) What stops you? List internal barriers (fear, self-doubt, "not good enough") and external barriers (time, money, situation). (3) Which barriers are actually "reasons your mind gives you" vs real constraints?',
            exercise_type: 'analysis',
            estimated_minutes: 25,
            key_concepts: ['barriers analysis', 'psychological flexibility', 'defusion']
          },
          {
            session_number: 5,
            week: 2,
            title: 'Committed Action Plans',
            description: 'Create concrete plans for value-aligned actions.',
            instructions: 'For each of your top 3 values, plan one committed action for this week. Make it SMART: Specific, Measurable, Achievable, Relevant, Time-bound. Example: "I value Health → I will walk for 20 minutes after lunch on Monday, Wednesday, and Friday." Write down what you will do if obstacles arise.',
            exercise_type: 'planning',
            estimated_minutes: 20,
            key_concepts: ['committed action', 'SMART goals', 'willingness']
          },
          {
            session_number: 6,
            week: 2,
            title: 'Living Your Values Long-Term',
            description: 'Build a sustainable practice of values-guided living.',
            instructions: 'Reflect on this week\'s committed actions. For each: Did you do it? How did it feel? Would you do it again? Create your Values Dashboard: list your top 5 values and one weekly action for each. Schedule a 10-minute weekly review to check your values-action alignment. Remember: the goal is progress, not perfection.',
            exercise_type: 'reflection',
            estimated_minutes: 20,
            key_concepts: ['sustainability', 'weekly review', 'self-compassion', 'values dashboard']
          }
        ]
      },
      {
        slug: 'gratitude-intervention',
        name: 'Gratitude Intervention',
        approach: 'Positive Psychology',
        duration_weeks: 2,
        total_sessions: 6,
        target_condition: 'negativity bias',
        description: 'A positive psychology program that systematically trains your attention toward positive experiences, building a habit of gratitude that counters the brain\'s natural negativity bias.',
        sessions: [
          {
            session_number: 1,
            week: 1,
            title: 'Gratitude Journaling',
            description: 'Begin a daily practice of noticing and recording things you are grateful for.',
            instructions: 'Each evening, write down 3 things you are grateful for today. For each one, answer: (1) What happened? (2) Why did it happen? (3) How did it make you feel? Be specific — "I am grateful for the warm coffee my partner made me this morning" is better than "I am grateful for my partner." Try to find new things each day.',
            exercise_type: 'journaling',
            estimated_minutes: 15,
            key_concepts: ['gratitude journaling', 'specificity', 'savouring positive experiences']
          },
          {
            session_number: 2,
            week: 1,
            title: 'Gratitude Letter',
            description: 'Write a letter of gratitude to someone who has positively impacted your life.',
            instructions: 'Think of someone who did something kind, helpful, or meaningful for you that you never properly thanked. Write them a letter (300+ words) describing: what they did, how it affected you, what it meant then, and what it means now. You can choose whether to send it. The act of writing is the exercise.',
            exercise_type: 'writing_exercise',
            estimated_minutes: 30,
            key_concepts: ['gratitude expression', 'social bonds', 'positive reminiscence']
          },
          {
            session_number: 3,
            week: 1,
            title: 'Counting Blessings Review',
            description: 'Review your gratitude entries and identify patterns.',
            instructions: 'Review your gratitude journal entries so far. Categorise them: People, Experiences, Things, Personal qualities, Nature/environment, Other. Which category appears most? Which appears least? For the least-represented category, try to find 3 things to be grateful for today. Notice how deliberately looking changes what you find.',
            exercise_type: 'reflection',
            estimated_minutes: 20,
            key_concepts: ['attention training', 'gratitude categories', 'intentional noticing']
          },
          {
            session_number: 4,
            week: 2,
            title: 'Savouring Exercises',
            description: 'Learn to extend and deepen positive experiences through savouring.',
            instructions: 'Today, practise 3 savouring techniques: (1) Absorption — fully immerse in one pleasant moment (a meal, a view, music) for 5 minutes without multitasking, (2) Memory building — take a mental photograph of a good moment and replay it before bed, (3) Sharing — tell someone about a positive experience from your day and notice how sharing amplifies it.',
            exercise_type: 'mindfulness_exercise',
            estimated_minutes: 20,
            key_concepts: ['savouring', 'absorption', 'positive memory', 'social sharing']
          },
          {
            session_number: 5,
            week: 2,
            title: 'Gratitude in Difficulty',
            description: 'Find gratitude even in challenging situations.',
            instructions: 'Think of a current difficulty or a past hardship. Without minimising the pain, ask: (1) What did/can I learn from this? (2) Did this challenge reveal any strengths? (3) Did anyone help me through it? (4) How might this experience help me help others? Write a paragraph about growth through adversity. This is NOT about toxic positivity — it is about finding meaning alongside pain.',
            exercise_type: 'cognitive_exercise',
            estimated_minutes: 25,
            key_concepts: ['benefit finding', 'post-traumatic growth', 'meaning making']
          },
          {
            session_number: 6,
            week: 2,
            title: 'Building a Gratitude Habit',
            description: 'Create a sustainable gratitude practice.',
            instructions: 'Design your long-term gratitude practice: (1) Choose your daily gratitude moment (morning or evening), (2) Set a reminder, (3) Choose your format (journal, app, mental review), (4) Plan a weekly "gratitude boost" (letter, visit, gift), (5) Create a "gratitude jar" — write good moments on slips and review them monthly. Commit to 30 days and track your streak.',
            exercise_type: 'planning',
            estimated_minutes: 15,
            key_concepts: ['habit formation', 'consistency', 'gratitude practice', 'positive psychology']
          }
        ]
      }
    ];
  }
}

module.exports = ProtocolService;

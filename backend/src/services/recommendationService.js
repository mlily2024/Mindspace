const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const MoodEntry = require('../models/MoodEntry');
const { subDays, format } = require('date-fns');
const { generateMLInsights, correlationMatrix, detectAnomalies } = require('./mlEngine');
const { segmentUser, getSegmentRecommendations } = require('./userSegmentation');
const { detectWarningSignals, predictMood } = require('./trendPredictor');

/**
 * Adaptive Self-Care Recommendation Service
 */
class RecommendationService {
  /**
   * Generate personalized recommendations based on user's mood data
   */
  static async generateRecommendations(userId) {
    // Get recent mood data
    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');

    const statistics = await MoodEntry.getStatistics(userId, { startDate, endDate });
    const recentEntries = await MoodEntry.getUserEntries(userId, {
      startDate,
      endDate,
      limit: 7
    });

    const recommendations = [];

    // Recommendations based on stress level
    if (statistics.avg_stress >= 7) {
      recommendations.push({
        type: 'breathing',
        title: 'Deep Breathing Exercise',
        description: 'Try the 4-7-8 breathing technique: Inhale for 4 counts, hold for 7, exhale for 8. Repeat 4 times.',
        effortLevel: 'low',
        estimatedDuration: 5,
        priority: 1
      });

      recommendations.push({
        type: 'activity',
        title: 'Progressive Muscle Relaxation',
        description: 'Tense and release each muscle group, starting from your toes to your head.',
        effortLevel: 'low',
        estimatedDuration: 15,
        priority: 2
      });
    }

    // Recommendations based on mood
    if (statistics.avg_mood < 5) {
      recommendations.push({
        type: 'activity',
        title: 'Gratitude Journaling',
        description: 'Write down 3 things you\'re grateful for today, no matter how small.',
        effortLevel: 'low',
        estimatedDuration: 10,
        priority: 1
      });

      recommendations.push({
        type: 'social',
        title: 'Connect with a Friend',
        description: 'Reach out to a friend or family member for a chat. Social connection boosts mood.',
        effortLevel: 'medium',
        estimatedDuration: 30,
        priority: 2
      });
    }

    // Recommendations based on energy
    if (statistics.avg_energy < 5) {
      recommendations.push({
        type: 'exercise',
        title: 'Gentle Walk',
        description: 'Take a 10-15 minute walk outside. Natural light and movement can boost energy.',
        effortLevel: 'low',
        estimatedDuration: 15,
        priority: 1
      });

      recommendations.push({
        type: 'rest',
        title: 'Power Nap',
        description: 'Take a 20-minute nap to recharge. Set an alarm to avoid oversleeping.',
        effortLevel: 'low',
        estimatedDuration: 20,
        priority: 2
      });
    }

    // Recommendations based on sleep
    if (statistics.avg_sleep_hours < 6 || statistics.avg_sleep_quality < 5) {
      recommendations.push({
        type: 'rest',
        title: 'Sleep Hygiene Routine',
        description: 'Create a bedtime routine: dim lights 1 hour before bed, avoid screens, and keep room cool.',
        effortLevel: 'low',
        estimatedDuration: 60,
        priority: 1
      });
    }

    // Recommendations for anxiety
    if (statistics.avg_anxiety >= 7) {
      recommendations.push({
        type: 'breathing',
        title: 'Grounding Exercise',
        description: 'Use the 5-4-3-2-1 technique: Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.',
        effortLevel: 'low',
        estimatedDuration: 5,
        priority: 1
      });
    }

    // Recommendations for low social interaction
    if (statistics.avg_social < 5) {
      recommendations.push({
        type: 'social',
        title: 'Join a Group Activity',
        description: 'Consider joining an interest group or online community to meet people with similar interests.',
        effortLevel: 'medium',
        estimatedDuration: 60,
        priority: 3
      });
    }

    // Check for critical situations
    if (statistics.avg_mood <= 3 || statistics.avg_stress >= 9) {
      recommendations.push({
        type: 'professional_help',
        title: 'Consider Professional Support',
        description: 'You\'ve been experiencing significant distress. Speaking with a mental health professional could be beneficial.',
        effortLevel: 'medium',
        estimatedDuration: 60,
        priority: 1
      });
    }

    // Save recommendations to database
    const savedRecommendations = [];
    for (const rec of recommendations) {
      const saved = await this.saveRecommendation(userId, rec);
      savedRecommendations.push(saved);
    }

    return savedRecommendations;
  }

  /**
   * Save recommendation to database
   */
  static async saveRecommendation(userId, recData) {
    const recommendationId = uuidv4();

    // Check if similar recommendation already exists (not completed, not expired)
    const existingQuery = `
      SELECT * FROM recommendations
      WHERE user_id = $1
        AND recommendation_type = $2
        AND title = $3
        AND is_completed = false
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      LIMIT 1
    `;

    const existing = await db.query(existingQuery, [userId, recData.type, recData.title]);

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Create new recommendation
    const query = `
      INSERT INTO recommendations (
        recommendation_id, user_id, recommendation_type,
        title, description, effort_level, estimated_duration, priority,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP + INTERVAL '7 days')
      RETURNING *
    `;

    const values = [
      recommendationId,
      userId,
      recData.type,
      recData.title,
      recData.description,
      recData.effortLevel,
      recData.estimatedDuration,
      recData.priority || 1
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get user recommendations
   */
  static async getUserRecommendations(userId, { activeOnly = true, limit = 10 }) {
    let query = `
      SELECT * FROM recommendations
      WHERE user_id = $1
    `;

    const values = [userId];

    if (activeOnly) {
      query += ` AND is_completed = false
                 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`;
    }

    query += ' ORDER BY priority ASC, created_at DESC LIMIT $2';
    values.push(limit);

    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Mark recommendation as completed
   */
  static async completeRecommendation(recommendationId, userId) {
    const query = `
      UPDATE recommendations
      SET is_completed = true,
          completed_at = CURRENT_TIMESTAMP
      WHERE recommendation_id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [recommendationId, userId]);
    return result.rows[0];
  }

  /**
   * Submit feedback for recommendation
   */
  static async submitFeedback(userId, recommendationId, feedbackData) {
    const feedbackId = uuidv4();

    const query = `
      INSERT INTO recommendation_feedback (
        feedback_id, user_id, recommendation_id,
        was_helpful, was_completed, rating, feedback_text
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      feedbackId,
      userId,
      recommendationId,
      feedbackData.wasHelpful,
      feedbackData.wasCompleted,
      feedbackData.rating,
      feedbackData.feedbackText
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Get Crisis Resources (UK-focused)
   */
  static getCrisisResources() {
    return {
      emergency: {
        title: 'Emergency Services',
        phone: '999',
        description: 'For immediate life-threatening emergencies'
      },
      samaritans: {
        title: 'Samaritans',
        phone: '116 123',
        email: 'jo@samaritans.org',
        website: 'https://www.samaritans.org',
        description: '24/7 emotional support for anyone in distress',
        available: '24/7'
      },
      mindInfoline: {
        title: 'Mind Infoline',
        phone: '0300 123 3393',
        website: 'https://www.mind.org.uk',
        description: 'Mental health information and support',
        available: '9am-6pm, Monday to Friday'
      },
      shoutCrisisText: {
        title: 'Shout Crisis Text Line',
        text: '85258',
        website: 'https://giveusashout.org',
        description: 'Text SHOUT to 85258 for free, confidential 24/7 support',
        available: '24/7'
      },
      nhsUrgentMentalHealth: {
        title: 'NHS Urgent Mental Health Helpline',
        phone: '111',
        description: 'Select option 2 for urgent mental health support',
        available: '24/7'
      },
      papyrus: {
        title: 'PAPYRUS Prevention of Young Suicide',
        phone: '0800 068 4141',
        text: '07860 039967',
        email: 'pat@papyrus-uk.org',
        description: 'Support for young people under 35',
        available: '9am-midnight every day'
      }
    };
  }

  /**
   * Generate ML-enhanced recommendations
   * Combines rule-based recommendations with ML insights and user segmentation
   */
  static async generateMLEnhancedRecommendations(userId) {
    try {
      // Get user segmentation
      const segmentation = await segmentUser(userId);

      // Get recent entries for ML analysis
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');

      const entries = await MoodEntry.getUserEntries(userId, {
        startDate,
        endDate,
        limit: 30
      });

      // Generate standard rule-based recommendations
      const ruleBasedRecs = await this.generateRecommendations(userId);

      // If not enough data, return rule-based with segment recommendations
      if (entries.length < 5) {
        const segmentRecs = getSegmentRecommendations(segmentation.segment.id);
        return {
          recommendations: ruleBasedRecs,
          segmentRecommendations: segmentRecs,
          segment: segmentation.segment,
          mlInsights: [],
          predictions: null,
          warningSignals: [],
          confidence: 0.5,
          message: 'Continue tracking for more personalized ML recommendations'
        };
      }

      // Generate ML insights
      const mlInsights = generateMLInsights(entries);

      // Detect warning signals
      const warningAnalysis = detectWarningSignals(entries);

      // Generate predictions
      const predictions = predictMood(entries, 3);

      // Get segment-specific recommendations
      const segmentRecs = getSegmentRecommendations(segmentation.segment.id);

      // Combine and prioritize recommendations
      const combinedRecs = this.prioritizeRecommendations(
        ruleBasedRecs,
        segmentRecs,
        warningAnalysis,
        segmentation
      );

      // Save ML-enhanced recommendations
      for (const rec of combinedRecs.slice(0, 5)) {
        await this.saveRecommendation(userId, {
          ...rec,
          isMLEnhanced: true,
          confidenceScore: segmentation.confidence
        });
      }

      return {
        recommendations: combinedRecs,
        segment: {
          id: segmentation.segment.id,
          name: segmentation.segment.name,
          description: segmentation.segment.description
        },
        segmentConfidence: segmentation.confidence,
        mlInsights: mlInsights.slice(0, 3),
        predictions,
        warningSignals: warningAnalysis.signals,
        riskLevel: warningAnalysis.riskLevel.level,
        dataPoints: entries.length
      };
    } catch (error) {
      console.error('ML recommendation generation error:', error);
      // Fallback to standard recommendations
      return {
        recommendations: await this.generateRecommendations(userId),
        error: 'ML enhancement unavailable, using standard recommendations'
      };
    }
  }

  /**
   * Prioritize and combine recommendations from multiple sources
   */
  static prioritizeRecommendations(ruleBasedRecs, segmentRecs, warningAnalysis, segmentation) {
    const combined = [];
    const seen = new Set();

    // Add high-priority warning-based recommendations first
    if (warningAnalysis.riskLevel.level === 'critical' || warningAnalysis.riskLevel.level === 'high') {
      combined.push({
        type: 'professional_help',
        title: 'Consider Professional Support',
        description: 'Based on your recent patterns, speaking with a mental health professional could be beneficial.',
        effortLevel: 'medium',
        estimatedDuration: 60,
        priority: 1,
        source: 'warning_signal',
        confidence: 0.9
      });
      seen.add('Consider Professional Support');
    }

    // Add segment-specific recommendations
    segmentRecs.forEach((rec, index) => {
      if (!seen.has(rec.title)) {
        combined.push({
          ...rec,
          priority: rec.priority || index + 2,
          source: 'segment',
          confidence: segmentation.confidence,
          estimatedDuration: rec.estimatedDuration || 15
        });
        seen.add(rec.title);
      }
    });

    // Add rule-based recommendations
    ruleBasedRecs.forEach(rec => {
      if (!seen.has(rec.title)) {
        combined.push({
          ...rec,
          source: 'rule_based',
          confidence: 0.7
        });
        seen.add(rec.title);
      }
    });

    // Sort by priority and confidence
    combined.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (b.confidence || 0) - (a.confidence || 0);
    });

    return combined.slice(0, 10);
  }

  /**
   * Get ML insights for dashboard display
   */
  static async getMLInsights(userId) {
    try {
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');

      const entries = await MoodEntry.getUserEntries(userId, {
        startDate,
        endDate,
        limit: 30
      });

      if (entries.length < 5) {
        return {
          hasEnoughData: false,
          insights: [],
          message: 'Track your mood for at least 5 days to see ML insights'
        };
      }

      const insights = generateMLInsights(entries);
      const predictions = predictMood(entries, 3);

      return {
        hasEnoughData: true,
        insights,
        predictions,
        dataPoints: entries.length
      };
    } catch (error) {
      console.error('Get ML insights error:', error);
      return {
        hasEnoughData: false,
        insights: [],
        error: error.message
      };
    }
  }
}

module.exports = RecommendationService;

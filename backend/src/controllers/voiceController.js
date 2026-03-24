/**
 * Voice Analysis Controller
 * Handles voice emotion analysis endpoints
 */

const VoiceAnalysisService = require('../services/voiceAnalysisService');
const logger = require('../config/logger');

/**
 * Analyze voice recording for emotional content
 * POST /api/voice/analyze
 *
 * For MVP, we receive pre-extracted audio features from the frontend
 * (extracted using Web Audio API) rather than raw audio
 */
const analyzeVoice = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { audioFeatures, transcript } = req.body;

    // Validate required features
    if (!audioFeatures) {
      return res.status(400).json({
        success: false,
        error: 'Audio features are required'
      });
    }

    // Validate feature structure
    const requiredFeatures = ['pitch', 'pitchVariation', 'speechRate', 'volume'];
    const missingFeatures = requiredFeatures.filter(f => audioFeatures[f] === undefined);

    if (missingFeatures.length === requiredFeatures.length) {
      return res.status(400).json({
        success: false,
        error: 'At least one audio feature is required',
        missingFeatures
      });
    }

    const analysis = await VoiceAnalysisService.analyzeVoice(userId, audioFeatures, transcript);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    logger.error('Error analyzing voice', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get user's voice baseline
 * GET /api/voice/baseline
 */
const getBaseline = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const baseline = await VoiceAnalysisService.getUserBaseline(userId);

    if (!baseline) {
      return res.json({
        success: true,
        data: {
          status: 'no_baseline',
          message: 'No voice baseline established yet. Record more voice check-ins to build your baseline.',
          samplesNeeded: 3
        }
      });
    }

    res.json({
      success: true,
      data: {
        status: 'established',
        baseline: {
          avgPitch: baseline.avg_pitch,
          avgPitchVariation: baseline.avg_pitch_variation,
          avgSpeechRate: baseline.avg_speech_rate,
          avgVolume: baseline.avg_volume,
          avgPauseFrequency: baseline.avg_pause_frequency,
          sampleCount: baseline.sample_count,
          lastUpdated: baseline.last_updated
        },
        isReliable: baseline.sample_count >= 5
      }
    });
  } catch (error) {
    logger.error('Error getting voice baseline', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Get user's voice analysis history
 * GET /api/voice/history
 */
const getAnalysisHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 10;

    const history = await VoiceAnalysisService.getAnalysisHistory(userId, limit);

    res.json({
      success: true,
      data: history.map(h => ({
        analysisId: h.analysis_id,
        emotions: h.detected_emotions,
        acousticFeatures: h.acoustic_features,
        confidence: h.confidence_score,
        suggestedMood: h.suggested_mood,
        suggestedEnergy: h.suggested_energy,
        transcript: h.transcript,
        userConfirmed: h.user_confirmed,
        analyzedAt: h.analyzed_at
      }))
    });
  } catch (error) {
    logger.error('Error getting voice history', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

/**
 * Link voice analysis to a mood entry
 * POST /api/voice/:analysisId/link
 */
const linkToMoodEntry = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { analysisId } = req.params;
    const { entryId } = req.body;

    if (!entryId) {
      return res.status(400).json({
        success: false,
        error: 'Entry ID is required'
      });
    }

    const result = await VoiceAnalysisService.linkToMoodEntry(analysisId, entryId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Voice analysis not found'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Voice analysis linked to mood entry',
        analysisId: result.analysis_id,
        entryId: result.entry_id
      }
    });
  } catch (error) {
    logger.error('Error linking voice analysis', { error: error.message, userId: req.user?.userId });
    next(error);
  }
};

module.exports = {
  analyzeVoice,
  getBaseline,
  getAnalysisHistory,
  linkToMoodEntry
};

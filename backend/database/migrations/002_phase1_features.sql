-- MindSpace 2.0 Phase 1 Database Migration
-- Predictive Mood Intelligence, Voice Analysis, Enhanced Feedback, Micro-Interventions
-- Run this migration to add Phase 1 tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. MOOD PREDICTIONS TABLE
-- Stores predicted mood scores for future dates
-- ============================================
CREATE TABLE IF NOT EXISTS mood_predictions (
    prediction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    predicted_date DATE NOT NULL,
    predicted_mood DECIMAL(3,1) CHECK (predicted_mood BETWEEN 1 AND 10),
    predicted_energy DECIMAL(3,1) CHECK (predicted_energy BETWEEN 1 AND 10),
    confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
    factors_considered JSONB DEFAULT '{}',
    preventive_actions JSONB DEFAULT '[]',
    actual_mood DECIMAL(3,1),
    prediction_accuracy DECIMAL(3,2),
    weather_data JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, predicted_date)
);

CREATE INDEX IF NOT EXISTS idx_mood_predictions_user_date
ON mood_predictions(user_id, predicted_date);

CREATE INDEX IF NOT EXISTS idx_mood_predictions_generated
ON mood_predictions(generated_at DESC);

-- ============================================
-- 2. VOICE ANALYSES TABLE
-- Stores voice emotion analysis results
-- ============================================
CREATE TABLE IF NOT EXISTS voice_analyses (
    analysis_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    entry_id UUID,
    detected_emotions JSONB DEFAULT '{}',
    acoustic_features JSONB DEFAULT '{}',
    confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0 AND 1),
    transcript TEXT,
    duration_seconds DECIMAL(5,2),
    suggested_mood INTEGER CHECK (suggested_mood BETWEEN 1 AND 10),
    suggested_energy INTEGER CHECK (suggested_energy BETWEEN 1 AND 10),
    user_confirmed BOOLEAN DEFAULT FALSE,
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voice_analyses_user
ON voice_analyses(user_id, analyzed_at DESC);

-- ============================================
-- 3. USER VOICE BASELINES TABLE
-- Stores each user's voice baseline for comparison
-- ============================================
CREATE TABLE IF NOT EXISTS user_voice_baselines (
    baseline_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
    avg_pitch DECIMAL(6,2),
    avg_pitch_variation DECIMAL(6,2),
    avg_speech_rate DECIMAL(5,2),
    avg_volume DECIMAL(6,2),
    avg_pause_frequency DECIMAL(5,2),
    sample_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. MICRO INTERVENTIONS TABLE
-- Stores available intervention types
-- ============================================
CREATE TABLE IF NOT EXISTS micro_interventions (
    intervention_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intervention_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    intervention_type VARCHAR(30) CHECK (intervention_type IN (
        'breathing', 'grounding', 'movement', 'gratitude',
        'journaling', 'social', 'rest', 'mindfulness'
    )),
    duration_seconds INTEGER DEFAULT 60,
    trigger_conditions JSONB DEFAULT '{}',
    content JSONB DEFAULT '{}',
    icon VARCHAR(10),
    color VARCHAR(20),
    effort_level VARCHAR(10) CHECK (effort_level IN ('low', 'medium', 'high')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. USER INTERVENTIONS HISTORY TABLE
-- Tracks when users receive and complete interventions
-- ============================================
CREATE TABLE IF NOT EXISTS user_interventions (
    user_intervention_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    intervention_id UUID REFERENCES micro_interventions(intervention_id) ON DELETE CASCADE,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trigger_reason VARCHAR(100),
    trigger_context JSONB DEFAULT '{}',
    was_shown BOOLEAN DEFAULT TRUE,
    was_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    user_rating INTEGER CHECK (user_rating BETWEEN 1 AND 5),
    skipped BOOLEAN DEFAULT FALSE,
    skipped_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_interventions_user
ON user_interventions(user_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_interventions_completion
ON user_interventions(user_id, was_completed);

-- ============================================
-- 6. USER PATTERNS TABLE
-- Stores analyzed patterns for each user (for predictions)
-- ============================================
CREATE TABLE IF NOT EXISTS user_patterns (
    pattern_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
    day_of_week_patterns JSONB DEFAULT '{}',
    time_of_day_patterns JSONB DEFAULT '{}',
    sleep_mood_correlation DECIMAL(4,3),
    stress_mood_correlation DECIMAL(4,3),
    energy_mood_correlation DECIMAL(4,3),
    social_mood_correlation DECIMAL(4,3),
    anxiety_mood_correlation DECIMAL(4,3),
    weather_sensitivity DECIMAL(4,3),
    best_day VARCHAR(10),
    worst_day VARCHAR(10),
    peak_time VARCHAR(20),
    avg_mood DECIMAL(3,1),
    avg_energy DECIMAL(3,1),
    optimal_sleep_hours DECIMAL(3,1),
    data_points_analyzed INTEGER DEFAULT 0,
    last_analysis_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 7. ADD COLUMNS TO EXISTING TABLES (non-breaking)
-- ============================================

-- Add voice analysis reference to mood entries
ALTER TABLE mood_entries
ADD COLUMN IF NOT EXISTS voice_analysis_id UUID;

-- Add prediction reference to mood entries
ALTER TABLE mood_entries
ADD COLUMN IF NOT EXISTS prediction_id UUID;

-- Add immediate feedback preference to user preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS show_enhanced_feedback BOOLEAN DEFAULT TRUE;

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS show_micro_interventions BOOLEAN DEFAULT TRUE;

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS voice_checkin_enabled BOOLEAN DEFAULT TRUE;

-- ============================================
-- 8. SEED DEFAULT MICRO INTERVENTIONS
-- ============================================
INSERT INTO micro_interventions (
    intervention_code, title, description, intervention_type,
    duration_seconds, trigger_conditions, content, icon, color, effort_level
) VALUES
-- Breathing exercises
(
    'breathing_478',
    '4-7-8 Breathing',
    'A calming breathing technique to reduce stress and anxiety',
    'breathing',
    120,
    '{"triggers": ["low_mood", "high_stress", "high_anxiety"], "mood_threshold": 5, "stress_threshold": 7}',
    '{"steps": ["Breathe in through your nose for 4 seconds", "Hold your breath for 7 seconds", "Exhale slowly through your mouth for 8 seconds", "Repeat 3-4 times"], "audio_guide": false}',
    '🌬️',
    '#A8C5A8',
    'low'
),
(
    'breathing_box',
    'Box Breathing',
    'A simple technique to calm your nervous system',
    'breathing',
    90,
    '{"triggers": ["high_stress", "pre_event"], "stress_threshold": 6}',
    '{"steps": ["Inhale for 4 seconds", "Hold for 4 seconds", "Exhale for 4 seconds", "Hold for 4 seconds", "Repeat 4 times"], "visualization": "box"}',
    '📦',
    '#9B8AA5',
    'low'
),
-- Grounding exercises
(
    'grounding_54321',
    '5-4-3-2-1 Grounding',
    'Connect with your surroundings to feel more present',
    'grounding',
    180,
    '{"triggers": ["high_anxiety", "dissociation"], "anxiety_threshold": 7}',
    '{"steps": ["Name 5 things you can see", "Name 4 things you can touch", "Name 3 things you can hear", "Name 2 things you can smell", "Name 1 thing you can taste"]}',
    '🌍',
    '#F5C9B3',
    'low'
),
-- Movement exercises
(
    'movement_stretch',
    'Quick Energy Stretch',
    'Simple stretches to boost your energy',
    'movement',
    120,
    '{"triggers": ["low_energy"], "energy_threshold": 4}',
    '{"steps": ["Stand up and reach your arms overhead", "Roll your shoulders back 5 times", "Gently twist your torso left and right", "Shake out your hands and arms", "Take 3 deep breaths"]}',
    '🤸',
    '#F5D89A',
    'low'
),
-- Gratitude exercises
(
    'gratitude_quick',
    'Gratitude Moment',
    'Take a moment to appreciate something positive',
    'gratitude',
    60,
    '{"triggers": ["neutral_mood", "engagement"], "mood_range": [4, 6]}',
    '{"prompt": "Think of one thing you are grateful for right now. It can be small - a warm drink, a kind word, or simply this moment of pause.", "follow_up": "Notice how this feels in your body."}',
    '🙏',
    '#A8C5A8',
    'low'
),
-- Mindfulness exercises
(
    'mindfulness_body_scan',
    'Quick Body Scan',
    'A brief check-in with your body',
    'mindfulness',
    90,
    '{"triggers": ["post_checkin", "high_stress"], "any_checkin": true}',
    '{"steps": ["Close your eyes or soften your gaze", "Notice your feet on the ground", "Scan up through your legs, torso, arms", "Notice any tension in your shoulders or jaw", "Take a breath and release any tightness"]}',
    '🧘',
    '#9B8AA5',
    'low'
),
-- Rest interventions
(
    'rest_micro_break',
    'Micro Rest Break',
    'A tiny pause to reset your mind',
    'rest',
    30,
    '{"triggers": ["fatigue", "extended_screen_time"], "energy_threshold": 3}',
    '{"instruction": "Close your eyes for 30 seconds. Just breathe normally. There is nothing you need to do right now.", "timer": true}',
    '😴',
    '#E8DDD6',
    'low'
),
-- Journaling prompts
(
    'journal_reflection',
    'Quick Reflection',
    'A brief journaling prompt for self-awareness',
    'journaling',
    120,
    '{"triggers": ["mood_change", "significant_event"]}',
    '{"prompts": ["What is one word to describe how you feel right now?", "What contributed to this feeling?", "What would help you feel even 1% better?"]}',
    '📝',
    '#F5C9B3',
    'medium'
)
ON CONFLICT (intervention_code) DO NOTHING;

-- ============================================
-- 9. CREATE HELPER FUNCTIONS
-- ============================================

-- Function to calculate prediction accuracy
CREATE OR REPLACE FUNCTION calculate_prediction_accuracy(
    predicted DECIMAL,
    actual DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
    IF predicted IS NULL OR actual IS NULL THEN
        RETURN NULL;
    END IF;
    -- Returns accuracy as percentage (1.0 = 100% accurate)
    RETURN 1.0 - (ABS(predicted - actual) / 10.0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE mood_predictions IS 'Stores AI-generated mood predictions for future dates';
COMMENT ON TABLE voice_analyses IS 'Stores voice emotion analysis results from audio check-ins';
COMMENT ON TABLE user_voice_baselines IS 'Stores personal voice baselines for comparison';
COMMENT ON TABLE micro_interventions IS 'Library of available micro-intervention exercises';
COMMENT ON TABLE user_interventions IS 'Tracks user interactions with micro-interventions';
COMMENT ON TABLE user_patterns IS 'Stores analyzed behavioral patterns for each user';

COMMENT ON COLUMN mood_predictions.factors_considered IS 'JSON containing factors used in prediction: {sleep_debt, day_pattern, trend, stress_level}';
COMMENT ON COLUMN mood_predictions.preventive_actions IS 'JSON array of suggested preventive actions';
COMMENT ON COLUMN voice_analyses.acoustic_features IS 'JSON containing: pitch, pitch_variation, speech_rate, volume, pause_frequency';
COMMENT ON COLUMN micro_interventions.trigger_conditions IS 'JSON defining when this intervention should be suggested';
COMMENT ON COLUMN micro_interventions.content IS 'JSON containing intervention steps, prompts, or instructions';

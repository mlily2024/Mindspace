-- Migration 006: Enhancements 1-9 (Novel Features)
-- Quick Check-In, EMA, Luna 2.0, Voice Signature, Predictions,
-- Therapeutic Protocols, Clinical Instruments, Enhanced Peer Support, Clinician Reports

-- ============================================================
-- ENHANCEMENT 1: Quick Check-In Mode
-- ============================================================
-- Uses existing mood_entries table. Add quick_mode flag.
ALTER TABLE mood_entries ADD COLUMN IF NOT EXISTS is_quick_entry BOOLEAN DEFAULT FALSE;
ALTER TABLE mood_entries ADD COLUMN IF NOT EXISTS inferred_metrics JSONB DEFAULT NULL;

-- ============================================================
-- ENHANCEMENT 2: Ecological Momentary Assessment (EMA)
-- ============================================================
CREATE TABLE IF NOT EXISTS ema_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    max_prompts_per_day INTEGER DEFAULT 3,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '07:00',
    adaptive_frequency BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS ema_prompts (
    prompt_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    prompt_type VARCHAR(30) NOT NULL DEFAULT 'mood_check',
    prompt_text TEXT,
    context VARCHAR(50),
    scheduled_at TIMESTAMP NOT NULL,
    delivered_at TIMESTAMP,
    responded_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ema_responses (
    response_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID REFERENCES ema_prompts(prompt_id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 5),
    energy_score INTEGER CHECK (energy_score BETWEEN 1 AND 5),
    context_note VARCHAR(200),
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ema_prompts_user_status ON ema_prompts(user_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ema_responses_user ON ema_responses(user_id, created_at DESC);

-- Mood variability tracking (computed from EMA)
CREATE TABLE IF NOT EXISTS mood_variability (
    variability_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    daily_mean NUMERIC(4,2),
    daily_std NUMERIC(4,2),
    num_observations INTEGER DEFAULT 0,
    instability_flag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date)
);

-- ============================================================
-- ENHANCEMENT 3: Luna 2.0 — Therapeutic Chatbot
-- ============================================================

-- Longitudinal memory per user
CREATE TABLE IF NOT EXISTS luna_therapeutic_journal (
    journal_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    entry_type VARCHAR(30) NOT NULL,
    content JSONB NOT NULL,
    session_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_luna_journal_user ON luna_therapeutic_journal(user_id, created_at DESC);

-- Tracks which therapeutic techniques work for each user
CREATE TABLE IF NOT EXISTS luna_technique_effectiveness (
    effectiveness_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    technique_type VARCHAR(50) NOT NULL,
    technique_name VARCHAR(100) NOT NULL,
    times_offered INTEGER DEFAULT 0,
    times_accepted INTEGER DEFAULT 0,
    times_completed INTEGER DEFAULT 0,
    avg_mood_before NUMERIC(4,2),
    avg_mood_after NUMERIC(4,2),
    avg_mood_delta NUMERIC(4,2) DEFAULT 0,
    effectiveness_score NUMERIC(4,2) DEFAULT 0,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, technique_type, technique_name)
);

-- User therapeutic profile (preferences, communication style, key themes)
CREATE TABLE IF NOT EXISTS luna_user_profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    communication_style VARCHAR(30) DEFAULT 'balanced',
    preferred_modality VARCHAR(30) DEFAULT 'cbt',
    key_themes JSONB DEFAULT '[]'::jsonb,
    emotional_vocabulary_level VARCHAR(20) DEFAULT 'basic',
    sessions_completed INTEGER DEFAULT 0,
    last_session_summary TEXT,
    therapeutic_fingerprint JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Emotional granularity training progress
CREATE TABLE IF NOT EXISTS emotional_granularity_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    initial_label VARCHAR(50),
    refined_label VARCHAR(50),
    emotion_category VARCHAR(30),
    granularity_depth INTEGER DEFAULT 1,
    session_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ENHANCEMENT 4: Voice Mood Signature
-- ============================================================
CREATE TABLE IF NOT EXISTS voice_baselines (
    baseline_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    avg_pitch NUMERIC(8,2),
    pitch_variability NUMERIC(8,2),
    avg_speech_rate NUMERIC(8,2),
    avg_pause_frequency NUMERIC(8,2),
    avg_volume NUMERIC(8,2),
    volume_variability NUMERIC(8,2),
    avg_jitter NUMERIC(8,4),
    sample_count INTEGER DEFAULT 0,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS voice_samples (
    sample_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    pitch NUMERIC(8,2),
    pitch_variability NUMERIC(8,2),
    speech_rate NUMERIC(8,2),
    pause_frequency NUMERIC(8,2),
    volume NUMERIC(8,2),
    volume_variability NUMERIC(8,2),
    jitter NUMERIC(8,4),
    deviation_from_baseline NUMERIC(6,2),
    associated_mood_score INTEGER,
    duration_seconds NUMERIC(6,2),
    features JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voice_samples_user ON voice_samples(user_id, created_at DESC);

-- ============================================================
-- ENHANCEMENT 5: Predictive Engine
-- ============================================================
CREATE TABLE IF NOT EXISTS prediction_models (
    model_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    model_type VARCHAR(30) DEFAULT 'temporal',
    model_version INTEGER DEFAULT 1,
    parameters JSONB DEFAULT '{}'::jsonb,
    training_data_points INTEGER DEFAULT 0,
    accuracy_score NUMERIC(5,3),
    last_trained_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, model_type)
);

CREATE TABLE IF NOT EXISTS mood_predictions (
    prediction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    model_id UUID REFERENCES prediction_models(model_id) ON DELETE SET NULL,
    predicted_date DATE NOT NULL,
    predicted_mood NUMERIC(4,2),
    confidence NUMERIC(4,3),
    contributing_factors JSONB DEFAULT '[]'::jsonb,
    preventive_actions JSONB DEFAULT '[]'::jsonb,
    actual_mood NUMERIC(4,2),
    prediction_error NUMERIC(4,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, predicted_date)
);

CREATE INDEX IF NOT EXISTS idx_predictions_user_date ON mood_predictions(user_id, predicted_date DESC);

-- ============================================================
-- ENHANCEMENT 6: Digital Therapeutic Protocols
-- ============================================================
CREATE TABLE IF NOT EXISTS therapeutic_protocols (
    protocol_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    modality VARCHAR(30) NOT NULL,
    target_condition VARCHAR(50),
    duration_weeks INTEGER NOT NULL,
    total_sessions INTEGER NOT NULL,
    difficulty_level VARCHAR(20) DEFAULT 'beginner',
    evidence_base TEXT,
    sessions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_protocol_enrollments (
    enrollment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    protocol_id UUID NOT NULL REFERENCES therapeutic_protocols(protocol_id),
    status VARCHAR(20) DEFAULT 'active',
    current_session INTEGER DEFAULT 1,
    current_week INTEGER DEFAULT 1,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    pre_assessment_score NUMERIC(5,2),
    post_assessment_score NUMERIC(5,2),
    adherence_pct NUMERIC(5,2) DEFAULT 0,
    notes TEXT,
    UNIQUE(user_id, protocol_id)
);

CREATE TABLE IF NOT EXISTS protocol_session_completions (
    completion_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID NOT NULL REFERENCES user_protocol_enrollments(enrollment_id) ON DELETE CASCADE,
    session_number INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mood_before INTEGER CHECK (mood_before BETWEEN 1 AND 10),
    mood_after INTEGER CHECK (mood_after BETWEEN 1 AND 10),
    difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
    notes TEXT,
    exercise_data JSONB
);

-- ============================================================
-- ENHANCEMENT 7: Validated Clinical Instruments
-- ============================================================
CREATE TABLE IF NOT EXISTS clinical_assessments (
    assessment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument VARCHAR(20) NOT NULL,
    version VARCHAR(10) DEFAULT '1.0',
    title VARCHAR(100) NOT NULL,
    description TEXT,
    items JSONB NOT NULL,
    scoring_rules JSONB NOT NULL,
    severity_ranges JSONB NOT NULL,
    frequency_days INTEGER DEFAULT 14,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assessment_responses (
    response_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES clinical_assessments(assessment_id),
    instrument VARCHAR(20) NOT NULL,
    answers JSONB NOT NULL,
    total_score INTEGER NOT NULL,
    severity VARCHAR(30),
    subscale_scores JSONB,
    flagged_items JSONB DEFAULT '[]'::jsonb,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assessment_responses_user ON assessment_responses(user_id, instrument, completed_at DESC);

-- ============================================================
-- ENHANCEMENT 8: Enhanced Peer Support
-- ============================================================

-- Pattern-based peer matching
CREATE TABLE IF NOT EXISTS peer_pattern_profiles (
    profile_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    mood_pattern_cluster INTEGER,
    peak_day VARCHAR(10),
    trough_day VARCHAR(10),
    avg_variability NUMERIC(4,2),
    primary_triggers JSONB DEFAULT '[]'::jsonb,
    pattern_hash VARCHAR(64),
    last_computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS peer_structured_exercises (
    exercise_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES peer_groups(group_id) ON DELETE CASCADE,
    exercise_type VARCHAR(30) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'scheduled',
    participation_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS peer_exercise_responses (
    response_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exercise_id UUID NOT NULL REFERENCES peer_structured_exercises(exercise_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Peer mentorship
CREATE TABLE IF NOT EXISTS peer_mentorships (
    mentorship_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    mentee_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active',
    mentor_improvement_score NUMERIC(5,2),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    UNIQUE(mentor_id, mentee_id)
);

-- ============================================================
-- ENHANCEMENT 9: Bridge to Professional Care
-- ============================================================
CREATE TABLE IF NOT EXISTS clinician_reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    report_type VARCHAR(30) DEFAULT 'handoff',
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    summary JSONB NOT NULL,
    mood_trends JSONB,
    sleep_analysis JSONB,
    assessment_scores JSONB,
    identified_triggers JSONB,
    techniques_tried JSONB,
    risk_flags JSONB,
    recommendations JSONB,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS care_escalations (
    escalation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    trigger_type VARCHAR(30) NOT NULL,
    trigger_details JSONB,
    severity VARCHAR(20) NOT NULL,
    recommended_action TEXT,
    user_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clinician_reports_user ON clinician_reports(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_care_escalations_user ON care_escalations(user_id, created_at DESC);

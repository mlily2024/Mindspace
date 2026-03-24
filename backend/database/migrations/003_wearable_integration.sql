-- MindSpace Enhancement 1: Wearable Device Integration
-- Database Migration for biometric data tracking and correlation
-- Run this migration to add wearable integration tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. WEARABLE CONNECTIONS TABLE
-- Stores OAuth connections to wearable devices
-- ============================================
CREATE TABLE IF NOT EXISTS wearable_connections (
    connection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('apple_health', 'oura', 'fitbit', 'garmin', 'mock')),
    device_name VARCHAR(100),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'failed', 'disconnected')),
    sync_frequency_hours INTEGER DEFAULT 6,
    permissions_granted JSONB DEFAULT '[]',
    device_metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_type)
);

CREATE INDEX IF NOT EXISTS idx_wearable_connections_user
ON wearable_connections(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_wearable_connections_sync
ON wearable_connections(sync_status, last_sync_at);

-- ============================================
-- 2. BIOMETRIC DATA TABLE
-- Stores raw biometric data synced from wearables
-- ============================================
CREATE TABLE IF NOT EXISTS biometric_data (
    data_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    connection_id UUID REFERENCES wearable_connections(connection_id) ON DELETE SET NULL,
    data_date DATE NOT NULL,
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN (
        'sleep_duration', 'sleep_quality', 'sleep_stages',
        'hrv', 'hrv_rmssd', 'hrv_sdnn',
        'resting_heart_rate', 'heart_rate_variability',
        'steps', 'active_minutes', 'calories_burned',
        'activity_score', 'readiness_score',
        'stress_level', 'body_battery',
        'respiratory_rate', 'spo2'
    )),
    value_numeric DECIMAL(10,2),
    value_json JSONB,
    unit VARCHAR(20),
    source VARCHAR(50),
    source_id VARCHAR(100),
    recorded_at TIMESTAMP WITH TIME ZONE,
    quality_score DECIMAL(3,2),
    is_manual_entry BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, data_date, data_type, source)
);

CREATE INDEX IF NOT EXISTS idx_biometric_data_user_date
ON biometric_data(user_id, data_date DESC);

CREATE INDEX IF NOT EXISTS idx_biometric_data_type
ON biometric_data(user_id, data_type, data_date DESC);

CREATE INDEX IF NOT EXISTS idx_biometric_data_correlation
ON biometric_data(user_id, data_date, data_type);

-- ============================================
-- 3. BIOMETRIC-MOOD CORRELATIONS TABLE
-- Stores calculated correlations between biometrics and mood
-- ============================================
CREATE TABLE IF NOT EXISTS biometric_correlations (
    correlation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    biometric_type VARCHAR(50) NOT NULL,
    mood_metric VARCHAR(50) NOT NULL CHECK (mood_metric IN (
        'mood_score', 'energy_level', 'stress_level',
        'anxiety_level', 'sleep_quality'
    )),
    pearson_coefficient DECIMAL(5,4),
    p_value DECIMAL(10,8),
    sample_size INTEGER NOT NULL,
    correlation_strength VARCHAR(20) CHECK (correlation_strength IN (
        'none', 'weak', 'moderate', 'strong', 'very_strong'
    )),
    direction VARCHAR(10) CHECK (direction IN ('positive', 'negative', 'none')),
    confidence_level DECIMAL(3,2),
    date_range_start DATE,
    date_range_end DATE,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_significant BOOLEAN DEFAULT FALSE,
    insights_generated JSONB DEFAULT '[]',
    UNIQUE(user_id, biometric_type, mood_metric)
);

CREATE INDEX IF NOT EXISTS idx_biometric_correlations_user
ON biometric_correlations(user_id);

CREATE INDEX IF NOT EXISTS idx_biometric_correlations_significant
ON biometric_correlations(user_id, is_significant) WHERE is_significant = TRUE;

-- ============================================
-- 4. BIOMETRIC INSIGHTS TABLE
-- Stores personalized insights derived from biometric-mood analysis
-- ============================================
CREATE TABLE IF NOT EXISTS biometric_insights (
    insight_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    insight_type VARCHAR(50) NOT NULL CHECK (insight_type IN (
        'correlation_discovery', 'pattern_detected',
        'threshold_alert', 'improvement_opportunity',
        'sleep_impact', 'activity_impact', 'hrv_insight'
    )),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    biometric_type VARCHAR(50),
    impact_score DECIMAL(3,2),
    confidence_score DECIMAL(3,2),
    supporting_data JSONB DEFAULT '{}',
    recommendations JSONB DEFAULT '[]',
    is_read BOOLEAN DEFAULT FALSE,
    is_actionable BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_biometric_insights_user
ON biometric_insights(user_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_biometric_insights_unread
ON biometric_insights(user_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- 5. BIOMETRIC BASELINES TABLE
-- Stores user's personal biometric baselines for comparison
-- ============================================
CREATE TABLE IF NOT EXISTS biometric_baselines (
    baseline_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    biometric_type VARCHAR(50) NOT NULL,
    baseline_mean DECIMAL(10,4),
    baseline_stddev DECIMAL(10,4),
    baseline_min DECIMAL(10,4),
    baseline_max DECIMAL(10,4),
    optimal_range_low DECIMAL(10,4),
    optimal_range_high DECIMAL(10,4),
    sample_count INTEGER DEFAULT 0,
    calculation_period_days INTEGER DEFAULT 30,
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, biometric_type)
);

CREATE INDEX IF NOT EXISTS idx_biometric_baselines_user
ON biometric_baselines(user_id);

-- ============================================
-- 6. SYNC LOGS TABLE
-- Tracks sync operations for debugging and rate limiting
-- ============================================
CREATE TABLE IF NOT EXISTS wearable_sync_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID REFERENCES wearable_connections(connection_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    sync_type VARCHAR(20) CHECK (sync_type IN ('manual', 'scheduled', 'initial', 'retry')),
    sync_status VARCHAR(20) CHECK (sync_status IN ('started', 'success', 'partial', 'failed')),
    records_synced INTEGER DEFAULT 0,
    date_range_start DATE,
    date_range_end DATE,
    duration_ms INTEGER,
    error_message TEXT,
    error_details JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_connection
ON wearable_sync_logs(connection_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_logs_user
ON wearable_sync_logs(user_id, started_at DESC);

-- ============================================
-- 7. UPDATE USER PREFERENCES TABLE
-- Add wearable-related preferences
-- ============================================
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS wearable_sync_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS biometric_insights_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS auto_sync_frequency_hours INTEGER DEFAULT 6;

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS share_biometric_in_predictions BOOLEAN DEFAULT TRUE;

-- ============================================
-- 8. UPDATE USER_PATTERNS TABLE
-- Add biometric-related correlation fields
-- ============================================
ALTER TABLE user_patterns
ADD COLUMN IF NOT EXISTS hrv_mood_correlation DECIMAL(4,3);

ALTER TABLE user_patterns
ADD COLUMN IF NOT EXISTS sleep_duration_mood_correlation DECIMAL(4,3);

ALTER TABLE user_patterns
ADD COLUMN IF NOT EXISTS activity_mood_correlation DECIMAL(4,3);

ALTER TABLE user_patterns
ADD COLUMN IF NOT EXISTS resting_hr_mood_correlation DECIMAL(4,3);

ALTER TABLE user_patterns
ADD COLUMN IF NOT EXISTS optimal_hrv_range JSONB;

ALTER TABLE user_patterns
ADD COLUMN IF NOT EXISTS optimal_sleep_range JSONB;

-- ============================================
-- 9. CREATE HELPER FUNCTIONS
-- ============================================

-- Function to classify correlation strength
CREATE OR REPLACE FUNCTION classify_correlation_strength(coefficient DECIMAL)
RETURNS VARCHAR(20) AS $$
BEGIN
    IF coefficient IS NULL THEN
        RETURN 'none';
    END IF;

    coefficient := ABS(coefficient);

    IF coefficient < 0.1 THEN
        RETURN 'none';
    ELSIF coefficient < 0.3 THEN
        RETURN 'weak';
    ELSIF coefficient < 0.5 THEN
        RETURN 'moderate';
    ELSIF coefficient < 0.7 THEN
        RETURN 'strong';
    ELSE
        RETURN 'very_strong';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to determine correlation direction
CREATE OR REPLACE FUNCTION get_correlation_direction(coefficient DECIMAL)
RETURNS VARCHAR(10) AS $$
BEGIN
    IF coefficient IS NULL OR ABS(coefficient) < 0.1 THEN
        RETURN 'none';
    ELSIF coefficient > 0 THEN
        RETURN 'positive';
    ELSE
        RETURN 'negative';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to check if correlation is statistically significant
CREATE OR REPLACE FUNCTION is_correlation_significant(p_value DECIMAL, threshold DECIMAL DEFAULT 0.05)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_value IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN p_value < threshold;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. CREATE TRIGGERS
-- ============================================

-- Auto-update timestamp for wearable_connections
CREATE OR REPLACE FUNCTION update_wearable_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_wearable_connection_timestamp ON wearable_connections;
CREATE TRIGGER trigger_update_wearable_connection_timestamp
    BEFORE UPDATE ON wearable_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_wearable_connection_timestamp();

-- ============================================
-- 11. ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE wearable_connections IS 'Stores OAuth connections to wearable devices (Apple Health, Oura, Fitbit, Garmin)';
COMMENT ON TABLE biometric_data IS 'Raw biometric data synced from wearable devices';
COMMENT ON TABLE biometric_correlations IS 'Calculated correlations between biometric metrics and mood indicators';
COMMENT ON TABLE biometric_insights IS 'Personalized insights derived from biometric-mood analysis';
COMMENT ON TABLE biometric_baselines IS 'User personal baselines for biometric metrics';
COMMENT ON TABLE wearable_sync_logs IS 'Audit log for sync operations';

COMMENT ON COLUMN wearable_connections.device_type IS 'Type of wearable: apple_health, oura, fitbit, garmin, mock';
COMMENT ON COLUMN wearable_connections.permissions_granted IS 'JSON array of granted permission scopes';
COMMENT ON COLUMN biometric_data.data_type IS 'Type of biometric data: sleep_duration, hrv, steps, etc.';
COMMENT ON COLUMN biometric_data.quality_score IS 'Data quality score 0-1, based on measurement confidence';
COMMENT ON COLUMN biometric_correlations.pearson_coefficient IS 'Pearson correlation coefficient (-1 to 1)';
COMMENT ON COLUMN biometric_correlations.p_value IS 'Statistical significance p-value';
COMMENT ON COLUMN biometric_correlations.is_significant IS 'TRUE if p_value < 0.05';
COMMENT ON COLUMN biometric_insights.impact_score IS 'Estimated mood impact score (-1 to 1)';

-- ============================================
-- Migration complete
-- ============================================

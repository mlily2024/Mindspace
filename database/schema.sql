-- Mental Health Tracker Application - Database Schema
-- PostgreSQL Database Schema
-- UK GDPR Compliant Design

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (Privacy-First Design)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    user_group VARCHAR(50) CHECK (user_group IN ('student', 'professional', 'parent', 'elderly', 'other')),
    date_of_birth DATE,
    timezone VARCHAR(50) DEFAULT 'Europe/London',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'suspended', 'deleted')),
    data_retention_consent BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE
);

-- User Preferences
CREATE TABLE user_preferences (
    preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    language VARCHAR(10) DEFAULT 'en-GB',
    theme VARCHAR(20) DEFAULT 'light',
    accessibility_mode BOOLEAN DEFAULT FALSE,
    font_size VARCHAR(20) DEFAULT 'medium',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    data_sharing_consent BOOLEAN DEFAULT FALSE,
    peer_support_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Mood and Wellbeing Tracking
CREATE TABLE mood_entries (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    entry_time TIME NOT NULL,
    mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 10),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
    stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
    sleep_hours DECIMAL(3,1),
    anxiety_level INTEGER CHECK (anxiety_level BETWEEN 1 AND 10),
    social_interaction_quality INTEGER CHECK (social_interaction_quality BETWEEN 1 AND 10),
    notes TEXT,
    activities JSONB,
    triggers JSONB,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, entry_date, entry_time)
);

-- Mental Health Insights (Generated Analytics)
CREATE TABLE user_insights (
    insight_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    insight_type VARCHAR(50) CHECK (insight_type IN ('trend', 'pattern', 'anomaly', 'improvement', 'decline', 'recommendation')),
    insight_period VARCHAR(20) CHECK (insight_period IN ('daily', 'weekly', 'monthly', 'quarterly')),
    insight_data JSONB NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
    is_read BOOLEAN DEFAULT FALSE,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Self-Care Recommendations
CREATE TABLE recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) CHECK (recommendation_type IN ('activity', 'breathing', 'exercise', 'social', 'rest', 'professional_help')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    effort_level VARCHAR(20) CHECK (effort_level IN ('low', 'medium', 'high')),
    estimated_duration INTEGER,
    is_personalized BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- User Interaction with Recommendations
CREATE TABLE recommendation_feedback (
    feedback_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    recommendation_id UUID REFERENCES recommendations(recommendation_id) ON DELETE CASCADE,
    was_helpful BOOLEAN,
    was_completed BOOLEAN DEFAULT FALSE,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Peer Support Groups
CREATE TABLE peer_support_groups (
    group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_name VARCHAR(255) NOT NULL,
    group_type VARCHAR(50) CHECK (group_type IN ('student', 'professional', 'parent', 'elderly', 'general')),
    description TEXT,
    max_members INTEGER DEFAULT 50,
    is_moderated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Peer Support Group Members
CREATE TABLE group_members (
    membership_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES peer_support_groups(group_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    anonymous_nickname VARCHAR(100),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_moderator BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(group_id, user_id)
);

-- Peer Support Messages (Anonymous)
CREATE TABLE peer_messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID REFERENCES peer_support_groups(group_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    anonymous_nickname VARCHAR(100),
    message_content TEXT NOT NULL,
    is_moderated BOOLEAN DEFAULT FALSE,
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Safety and Risk Detection
CREATE TABLE safety_alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    alert_type VARCHAR(50) CHECK (alert_type IN ('high_stress', 'mood_decline', 'crisis_indicator', 'prolonged_distress')),
    severity VARCHAR(20) CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
    alert_data JSONB,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    action_taken TEXT
);

-- Emergency Contacts (User-Controlled)
CREATE TABLE emergency_contacts (
    contact_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    contact_name VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    relationship VARCHAR(100),
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Data Export Requests (GDPR Compliance)
CREATE TABLE data_export_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    request_type VARCHAR(50) CHECK (request_type IN ('export', 'deletion')),
    request_status VARCHAR(50) CHECK (request_status IN ('pending', 'processing', 'completed', 'failed')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    export_file_path TEXT
);

-- Audit Log (Security & Compliance)
CREATE TABLE audit_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_mood_entries_user_date ON mood_entries(user_id, entry_date DESC);
CREATE INDEX idx_user_insights_user ON user_insights(user_id, generated_at DESC);
CREATE INDEX idx_recommendations_user ON recommendations(user_id, created_at DESC);
CREATE INDEX idx_peer_messages_group ON peer_messages(group_id, created_at DESC);
CREATE INDEX idx_safety_alerts_user ON safety_alerts(user_id, triggered_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- CHATBOT TABLES (Luna - AI Companion)
-- =====================================================

-- Chatbot Conversations
CREATE TABLE chatbot_conversations (
    conversation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    mood_at_start INTEGER CHECK (mood_at_start BETWEEN 1 AND 10),
    mood_at_end INTEGER CHECK (mood_at_end BETWEEN 1 AND 10),
    conversation_summary TEXT
);

-- Chatbot Messages
CREATE TABLE chatbot_messages (
    message_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES chatbot_conversations(conversation_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    sender VARCHAR(20) CHECK (sender IN ('user', 'luna')),
    message_content TEXT NOT NULL,
    message_type VARCHAR(30) DEFAULT 'text' CHECK (message_type IN ('text', 'breathing_exercise', 'grounding', 'affirmation', 'check_in', 'resource')),
    emotion_detected VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for chatbot queries
CREATE INDEX idx_chatbot_messages_conversation ON chatbot_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chatbot_conversations_user ON chatbot_conversations(user_id, started_at DESC);

-- =====================================================
-- GAMIFICATION TABLES (Streaks & Achievements)
-- =====================================================

-- User Streaks
CREATE TABLE user_streaks (
    streak_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_check_in_date DATE,
    streak_started_at DATE,
    total_check_ins INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Achievement Definitions
CREATE TABLE achievements (
    achievement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    achievement_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    category VARCHAR(30) CHECK (category IN ('streak', 'check_in', 'engagement', 'wellness', 'social', 'milestone')),
    requirement_value INTEGER,
    requirement_type VARCHAR(30),
    points INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE
);

-- User Achievements (Earned)
CREATE TABLE user_achievements (
    user_achievement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(achievement_id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_notified BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, achievement_id)
);

-- Index for gamification queries
CREATE INDEX idx_user_streaks_user ON user_streaks(user_id);
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id, earned_at DESC);

-- =====================================================
-- DEFAULT ACHIEVEMENTS (Initial Data)
-- =====================================================

INSERT INTO achievements (achievement_code, title, description, icon, category, requirement_value, requirement_type, points) VALUES
-- Streak achievements
('first_checkin', 'First Step', 'Complete your first mood check-in', '🌱', 'check_in', 1, 'total_check_ins', 10),
('three_day_streak', 'Getting Started', 'Log your mood for 3 days in a row', '✨', 'streak', 3, 'streak_days', 25),
('week_streak', 'Week Warrior', 'Maintain a 7-day check-in streak', '🔥', 'streak', 7, 'streak_days', 50),
('fortnight_streak', 'Fortnight Fighter', 'Maintain a 14-day check-in streak', '⚡', 'streak', 14, 'streak_days', 100),
('month_streak', 'Monthly Master', 'Maintain a 30-day check-in streak', '🏆', 'streak', 30, 'streak_days', 200),
('century_club', 'Century Club', '100 days of consistent self-care', '💯', 'streak', 100, 'streak_days', 500),

-- Check-in achievements
('ten_checkins', 'Getting Consistent', 'Complete 10 mood check-ins', '⭐', 'check_in', 10, 'total_check_ins', 25),
('twentyfive_checkins', 'Building Habits', 'Complete 25 mood check-ins', '🌟', 'check_in', 25, 'total_check_ins', 50),
('fifty_checkins', 'Dedicated Tracker', 'Complete 50 mood check-ins', '💫', 'check_in', 50, 'total_check_ins', 100),
('hundred_checkins', 'Centurion', 'Complete 100 mood check-ins', '🎖️', 'check_in', 100, 'total_check_ins', 200),

-- Journal achievements
('first_journal', 'First Words', 'Write your first journal entry', '📝', 'engagement', 1, 'journal_entries', 15),
('ten_journals', 'Reflective Mind', 'Complete 10 journal entries', '📖', 'engagement', 10, 'journal_entries', 50),
('fifty_journals', 'Deep Thinker', 'Write 50 journal entries', '🧠', 'engagement', 50, 'journal_entries', 150),

-- Exercise achievements
('first_breathing', 'Deep Breath', 'Complete your first breathing exercise', '🌬️', 'wellness', 1, 'breathing_exercises', 15),
('ten_breathing', 'Breath Aware', 'Complete 10 breathing exercises', '😮‍💨', 'wellness', 10, 'breathing_exercises', 40),
('breathing_master', 'Breath Master', 'Complete 25 breathing exercises', '🧘', 'wellness', 25, 'breathing_exercises', 75),
('first_grounding', 'Grounded', 'Complete your first grounding exercise', '🌳', 'wellness', 1, 'grounding_exercises', 15),
('grounding_pro', 'Present & Centered', 'Complete 10 grounding exercises', '🏔️', 'wellness', 10, 'grounding_exercises', 50),

-- Chat achievements
('chat_with_luna', 'Made a Friend', 'Have your first chat with Luna', '🌙', 'engagement', 1, 'chat_sessions', 15),
('regular_chatter', 'Regular Chatter', 'Have 10 conversations with Luna', '💬', 'engagement', 10, 'chat_sessions', 40),
('luna_friend', 'Luna\'s Friend', 'Have 50 conversations with Luna', '🌟', 'engagement', 50, 'chat_sessions', 100),

-- Wellness achievements
('mood_improver', 'Rising Spirits', 'Improve your mood by 3+ points in a week', '🌈', 'wellness', 3, 'mood_improvement', 75),
('self_care_champion', 'Self-Care Champion', 'Complete 5 self-care recommendations', '💜', 'wellness', 5, 'recommendations_completed', 50),

-- Insight achievements
('first_insight', 'Self-Aware', 'View your first insights report', '🔍', 'milestone', 1, 'insights_viewed', 20),
('pattern_finder', 'Pattern Finder', 'Discover a mood correlation', '🔗', 'milestone', 1, 'patterns_found', 30),

-- Special time-based achievements
('night_owl', 'Night Owl', 'Log your mood after midnight', '🦉', 'milestone', 1, 'night_checkin', 15),
('early_bird', 'Early Bird', 'Log your mood before 7am', '🐦', 'milestone', 1, 'early_checkin', 15),
('weekend_warrior', 'Weekend Wellness', 'Check in on both Saturday and Sunday', '🎯', 'milestone', 1, 'weekend_complete', 20),
('mood_explorer', 'Mood Explorer', 'Log all 5 different mood levels', '🎨', 'milestone', 5, 'mood_variety', 35);

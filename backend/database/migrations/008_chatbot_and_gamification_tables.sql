-- Migration 008: chatbot conversations + gamification tables
--
-- These tables are defined in backend/database/schema.sql but were missing
-- from deployments whose initial schema apply pre-dated those additions.
-- Symptoms: 500 errors from /api/chatbot/* ("relation does not exist") and
-- silent gamification (streak/achievement endpoints return empty).
--
-- All statements are idempotent (IF NOT EXISTS) so re-applying is safe.

-- =====================================================
-- CHATBOT TABLES (Luna - AI Companion)
-- =====================================================

CREATE TABLE IF NOT EXISTS chatbot_conversations (
    conversation_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id              UUID REFERENCES users(user_id) ON DELETE CASCADE,
    started_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at             TIMESTAMP WITH TIME ZONE,
    is_active            BOOLEAN DEFAULT TRUE,
    mood_at_start        INTEGER CHECK (mood_at_start BETWEEN 1 AND 10),
    mood_at_end          INTEGER CHECK (mood_at_end BETWEEN 1 AND 10),
    conversation_summary TEXT
);

CREATE TABLE IF NOT EXISTS chatbot_messages (
    message_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id  UUID REFERENCES chatbot_conversations(conversation_id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(user_id) ON DELETE CASCADE,
    sender           VARCHAR(20) CHECK (sender IN ('user', 'luna')),
    message_content  TEXT NOT NULL,
    message_type     VARCHAR(30) DEFAULT 'text'
                     CHECK (message_type IN ('text', 'breathing_exercise', 'grounding',
                                              'affirmation', 'check_in', 'resource')),
    emotion_detected VARCHAR(50),
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chatbot_messages_conversation
    ON chatbot_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_user
    ON chatbot_conversations(user_id, started_at DESC);

-- =====================================================
-- GAMIFICATION TABLES (Streaks & Achievements)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_streaks (
    streak_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
    current_streak      INTEGER DEFAULT 0,
    longest_streak      INTEGER DEFAULT 0,
    last_check_in_date  DATE,
    streak_started_at   DATE,
    total_check_ins     INTEGER DEFAULT 0,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS achievements (
    achievement_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    achievement_code  VARCHAR(50) UNIQUE NOT NULL,
    title             VARCHAR(100) NOT NULL,
    description       TEXT,
    icon              VARCHAR(10),
    category          VARCHAR(30) CHECK (category IN ('streak', 'check_in', 'engagement',
                                                       'wellness', 'social', 'milestone')),
    requirement_value INTEGER,
    requirement_type  VARCHAR(30),
    points            INTEGER DEFAULT 10,
    is_active         BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS user_achievements (
    user_achievement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID REFERENCES users(user_id) ON DELETE CASCADE,
    achievement_id      UUID REFERENCES achievements(achievement_id) ON DELETE CASCADE,
    earned_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_notified         BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_user        ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user   ON user_achievements(user_id, earned_at DESC);

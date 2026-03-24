-- Migration 004: Add missing indexes for common query patterns
-- Non-breaking: only adds indexes, does not modify data

-- Peer messages filtered by deletion status (common in message queries)
CREATE INDEX IF NOT EXISTS idx_peer_messages_group_active
ON peer_messages(group_id, created_at DESC) WHERE is_deleted = FALSE;

-- Mood entries by date (date-range queries without user filter)
CREATE INDEX IF NOT EXISTS idx_mood_entries_date
ON mood_entries(entry_date DESC);

-- Unacknowledged safety alerts (common dashboard/notification query)
CREATE INDEX IF NOT EXISTS idx_safety_alerts_unacknowledged
ON safety_alerts(user_id, triggered_at DESC) WHERE is_acknowledged = FALSE;

-- User preferences lookup by user
CREATE INDEX IF NOT EXISTS idx_user_preferences_user
ON user_preferences(user_id);

-- Active group members (for member counts and online status)
CREATE INDEX IF NOT EXISTS idx_group_members_active
ON group_members(group_id, is_active) WHERE is_active = TRUE;

-- Recommendations not yet completed (for active recommendation lists)
CREATE INDEX IF NOT EXISTS idx_recommendations_active
ON recommendations(user_id, created_at DESC) WHERE is_completed = FALSE;

-- Chatbot active conversations per user
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_active
ON chatbot_conversations(user_id, started_at DESC) WHERE is_active = TRUE;

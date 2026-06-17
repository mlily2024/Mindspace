-- Migration 012 — luna runtime tables (2026-06-17)
--
-- lunaService.js (since the Enhancements 1-9 commit, 2026-03-26) references
-- three tables that do not exist in any prior migration:
--   - luna_journal_entries     (migration 006 created luna_therapeutic_journal instead)
--   - luna_profiles            (migration 006 created luna_user_profiles instead)
--   - luna_emotion_granularity (no prior migration created this)
--
-- Effect: every Luna /api/luna/message request silently hangs in
-- processMessage's Promise.all over (sessionContext, dataContext, profile)
-- because at least one branch issues a query against a non-existent
-- relation. The PG driver doesn't time out promptly; the frontend's
-- "I'm having trouble connecting" fallback eventually surfaces.
--
-- This migration creates those three tables with the column shape the
-- code actually expects. The legacy migration-006 tables remain in place
-- but unused (no data loss; no consumer reads them).
--
-- Idempotent: IF NOT EXISTS guards on every CREATE.

CREATE TABLE IF NOT EXISTS luna_journal_entries (
    entry_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    entry_type    VARCHAR(50) NOT NULL,
    content       TEXT,
    session_id    UUID,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_luna_journal_entries_user_created
    ON luna_journal_entries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_luna_journal_entries_user_type
    ON luna_journal_entries (user_id, entry_type, created_at DESC);

CREATE TABLE IF NOT EXISTS luna_profiles (
    profile_id   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    profile_data JSONB DEFAULT '{}'::jsonb,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS luna_emotion_granularity (
    granularity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    initial_label  VARCHAR(100) NOT NULL,
    refined_label  VARCHAR(100) NOT NULL,
    category       VARCHAR(50),
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_luna_emotion_granularity_user
    ON luna_emotion_granularity (user_id, created_at DESC);

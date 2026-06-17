-- Migration 013 — journal_entries (2026-06-17)
--
-- Up to this commit the Journal page was a UI prototype: the save handler
-- was a setTimeout mock; nothing reached the database. This migration
-- creates the table that backs real persistence, with the same E2EE
-- shape as mood_entries.notes (migration 011): an opaque ciphertext path
-- and a legacy server-side-encrypt path, distinguished by the
-- is_e2ee_encrypted flag.
--
-- Schema-drift audit (W1, commit 93928e5) will catch this table going
-- forward.

CREATE TABLE IF NOT EXISTS journal_entries (
    entry_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    prompt_id           VARCHAR(50) NOT NULL,
    -- Snapshot of the prompt text the user actually saw; we store this
    -- rather than recovering from the frontend's prompts[] array because
    -- prompts can be tweaked / added without retro-modifying older entries.
    prompt_text         TEXT NOT NULL,
    -- The main reflection. E2EE when is_e2ee_encrypted=true; AES-256-GCM
    -- server-side when is_e2ee_encrypted=false AND is_encrypted=true;
    -- plaintext when both false (only ever used for empty entries).
    response            TEXT,
    -- The follow-up sub-responses serialised as a JSON array string before
    -- (optional) encryption. Same E2EE flag governs both response and
    -- follow_up_responses.
    follow_up_responses TEXT,
    mood_before         SMALLINT CHECK (mood_before IS NULL OR (mood_before >= 1 AND mood_before <= 10)),
    mood_after          SMALLINT CHECK (mood_after  IS NULL OR (mood_after  >= 1 AND mood_after  <= 10)),
    is_encrypted        BOOLEAN NOT NULL DEFAULT FALSE,
    is_e2ee_encrypted   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_created
    ON journal_entries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_prompt
    ON journal_entries (user_id, prompt_id);

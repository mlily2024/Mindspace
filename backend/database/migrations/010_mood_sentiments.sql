-- Migration 010: mood_sentiments
--
-- Stores the RESULT of on-device sentiment analysis performed by the
-- frontend's Transformers.js pipeline (ADR-0006). The user's text is
-- analysed locally in their browser; only the score, label, confidence,
-- model provenance, and a SHA-256 fingerprint of the text are sent.
--
-- Privacy: plaintext is NEVER stored or transmitted. text_hash exists
-- only for client-side de-duplication / "have I already analysed this?"
-- decisions — it is a one-way fingerprint, not recoverable text.
--
-- All statements are idempotent (IF NOT EXISTS) — re-applying is safe.

CREATE TABLE IF NOT EXISTS mood_sentiments (
    sentiment_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    mood_entry_id     UUID REFERENCES mood_entries(entry_id) ON DELETE SET NULL,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- The on-device-computed result.
    sentiment_score   REAL NOT NULL CHECK (sentiment_score BETWEEN -1 AND 1),
    sentiment_label   TEXT NOT NULL CHECK (sentiment_label IN ('positive', 'negative', 'neutral')),
    confidence        REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),

    -- Provenance — needed to interpret the score later or invalidate
    -- when the model is retrained / replaced.
    model_id          TEXT NOT NULL,
    model_version     TEXT,

    -- Privacy-preserving text metadata. NEVER the text itself.
    text_length       INTEGER CHECK (text_length >= 0),
    text_hash         TEXT,

    -- Audit / telemetry.
    client_user_agent TEXT,
    inference_ms      INTEGER CHECK (inference_ms >= 0)
);

CREATE INDEX IF NOT EXISTS mood_sentiments_user_created_idx
    ON mood_sentiments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mood_sentiments_user_label_idx
    ON mood_sentiments (user_id, sentiment_label);

CREATE INDEX IF NOT EXISTS mood_sentiments_mood_entry_idx
    ON mood_sentiments (mood_entry_id)
    WHERE mood_entry_id IS NOT NULL;

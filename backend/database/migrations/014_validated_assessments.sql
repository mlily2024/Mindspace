-- Migration 014 — validated_assessments (2026-06-18)
--
-- Real persistence for the 5 free-public-domain screening instruments
-- Mindspace integrates: PHQ-9 (depression), GAD-7 (anxiety), PSS-4
-- (perceived stress), ISI (insomnia severity), WEMWBS (mental wellbeing).
--
-- Replaces the stub paths in backend/src/controllers/assessmentController.js
-- (TODO comments throughout) with real reads/writes. The frontend
-- pages/Assessments.jsx has been waiting for this table to exist; it
-- has been built against the existing /api/assessments route shape for
-- months but has only ever received stub data.
--
-- E2EE shape matches mood_entries.notes (migration 011) and
-- journal_entries (migration 013): per-question responses are opaque
-- ciphertext when is_e2ee_encrypted=true; total_score and severity_tier
-- stay plaintext for the cohort-insights service and the dashboard
-- chart. Same trade-off as mood_score (plaintext) vs notes (E2EE).
--
-- has_crisis_flag column exists so the SafetyFilter can be wired to
-- PHQ-9 Q9 (self-harm ideation) responses ≥1 without re-decrypting the
-- responses array. The crisis flag is computed at insert time and is
-- the only score-derived signal we surface plaintext beyond total_score.

CREATE TABLE IF NOT EXISTS validated_assessments (
    assessment_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    -- PHQ9 / GAD7 / PSS4 / ISI / WEMWBS — validated server-side
    instrument        VARCHAR(20) NOT NULL,
    -- JSON array of integer responses, optionally E2EE-encrypted
    responses         TEXT,
    -- Computed at insert time from responses, kept plaintext for analytics
    total_score       SMALLINT,
    -- minimal / mild / moderate / moderately_severe / severe / etc
    severity_tier     VARCHAR(30),
    -- Set true when the instrument has a crisis-relevant item that
    -- scored above its threshold (PHQ-9 Q9 ≥ 1 → true). Used to fire
    -- safetyFilter handling without touching encrypted responses.
    has_crisis_flag   BOOLEAN NOT NULL DEFAULT FALSE,
    is_encrypted      BOOLEAN NOT NULL DEFAULT FALSE,
    is_e2ee_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Optional client-side note about the context of this assessment
    -- (e.g. "feeling worse this week"). E2EE-treatable same as responses.
    note              TEXT
);

CREATE INDEX IF NOT EXISTS idx_validated_assessments_user_completed
    ON validated_assessments (user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_validated_assessments_user_instrument
    ON validated_assessments (user_id, instrument, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_validated_assessments_crisis
    ON validated_assessments (user_id, has_crisis_flag, completed_at DESC)
    WHERE has_crisis_flag = TRUE;

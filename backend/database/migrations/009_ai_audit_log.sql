-- Migration 009: ai_audit_log
--
-- Per-user, hash-chained, append-only record of every AI interaction
-- (Luna LLM, rule-based fallback, crisis-filter responses).
--
-- Privacy: plaintext message and response are NEVER stored — only
-- SHA-256 hashes. Structured fields (safety verdict, classification,
-- timing) are retained for offline auditing.
--
-- Integrity: each row's record_hash = SHA-256(canonical_payload || prev_hash),
-- where prev_hash is the previous row's record_hash for the same user
-- (or 'GENESIS' for the first row). Tampering with any field, or with
-- the row sequence, breaks the chain from that point onward.
--
-- Append-only: an UPDATE trigger blocks mutation. DELETE is permitted
-- only via ON DELETE CASCADE from users (GDPR right-to-erasure).
--
-- All statements are idempotent (IF NOT EXISTS) — re-applying is safe.

CREATE TABLE IF NOT EXISTS ai_audit_log (
    audit_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id               UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    sequence_number       BIGINT NOT NULL,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    conversation_id       UUID,
    provider              TEXT NOT NULL,
    model_version         TEXT,

    input_hash            TEXT NOT NULL,
    output_hash           TEXT NOT NULL,

    safety_verdict        JSONB NOT NULL DEFAULT '{}'::jsonb,
    output_classification TEXT NOT NULL,
    latency_ms            INTEGER,

    prev_hash             TEXT NOT NULL,
    record_hash           TEXT NOT NULL,

    CONSTRAINT ai_audit_log_user_seq_unique  UNIQUE (user_id, sequence_number),
    CONSTRAINT ai_audit_log_record_hash_unique UNIQUE (record_hash)
);

CREATE INDEX IF NOT EXISTS ai_audit_log_user_seq_idx
    ON ai_audit_log (user_id, sequence_number DESC);

CREATE INDEX IF NOT EXISTS ai_audit_log_created_idx
    ON ai_audit_log (created_at);

-- Append-only enforcement: block UPDATE at the database layer so even a
-- compromised application server cannot rewrite history. DELETE is left
-- open for ON DELETE CASCADE from the users table (erasure compliance).
CREATE OR REPLACE FUNCTION ai_audit_log_prevent_update() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'ai_audit_log is append-only; UPDATE is not permitted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_audit_log_no_update ON ai_audit_log;
CREATE TRIGGER ai_audit_log_no_update
BEFORE UPDATE ON ai_audit_log
FOR EACH ROW EXECUTE FUNCTION ai_audit_log_prevent_update();

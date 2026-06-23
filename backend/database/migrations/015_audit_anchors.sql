-- 015_audit_anchors.sql
-- F.8 — External anchoring for the AI audit log (ADR-0015).
--
-- The per-user hash chains in ai_audit_log (migration 009) prove a chain is
-- INTERNALLY consistent, but not that it matches what existed at an earlier time:
-- an attacker with full DB write could rewrite a user's chain from a forged
-- genesis and verifyChain would still pass. This table stores periodic
-- commitments (a Merkle root over every user's current chain head) so that a
-- commitment published to an append-only store OUTSIDE the database lets a later
-- full rewrite be detected. The anchors are themselves hash-chained.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS audit_anchors (
    anchor_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_number   BIGINT NOT NULL UNIQUE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    user_count        INTEGER NOT NULL,
    record_count      BIGINT NOT NULL,

    merkle_root       TEXT NOT NULL,
    algorithm         TEXT NOT NULL DEFAULT 'sha256-merkle-v1',
    -- The leaves the root commits to: [{ user_id, head_seq, head_hash }, ...].
    -- Stored so verification does not depend on (forgeable) row timestamps.
    leaves            JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Anchor-of-anchors chain. 'GENESIS_ANCHOR' for the first anchor.
    prev_anchor_hash  TEXT NOT NULL,
    anchor_hash       TEXT NOT NULL,

    -- Where/when this anchor's commitment was published externally (the trust
    -- anchor). Null if publication was disabled or failed at creation time.
    external_receipt  JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_anchors_created_at ON audit_anchors (created_at DESC);

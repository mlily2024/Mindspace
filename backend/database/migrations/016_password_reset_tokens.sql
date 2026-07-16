-- Migration 016 — password_reset_tokens (2026-07-16)
--
-- Backs the forgot-password / reset-password flow (launch-readiness blockers
-- #3 + #4). Only a SHA-256 HASH of each reset token is stored, never the raw
-- token; the raw token exists only in the emailed link. Tokens are single-use
-- (used_at) and short-lived (expires_at, ~1 hour). Fully additive; idempotent
-- so the AUTO_MIGRATE bootstrap can re-run it on every container start.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);

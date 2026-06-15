-- Migration 011: end-to-end encryption metadata for mood-entry notes (ADR-0009)
--
-- Adds the storage scaffolding for client-side-key E2EE on
-- mood_entries.notes:
--   1. user_e2ee_metadata  — per-user KDF salt + params + wrapped master key
--      (wrapped twice: once by passphrase-derived key, once by recovery-
--      phrase-derived key). The server never holds the unwrapped master
--      key or the passphrase.
--   2. mood_entries.is_e2ee_encrypted  — flag column. When TRUE, the
--      `notes` column holds an opaque client-encrypted blob that the
--      server CANNOT decrypt. When FALSE (or NULL via the default), the
--      legacy server-side AES-256-GCM path applies as before.
--
-- Backwards compatible. Existing rows have is_e2ee_encrypted = FALSE
-- (default) and the legacy decryption path keeps working unchanged.
--
-- Idempotent (IF NOT EXISTS on every statement) — re-applying is safe.

CREATE TABLE IF NOT EXISTS user_e2ee_metadata (
    user_id                       UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,

    -- Key-derivation function configuration. Stored so the client can
    -- reproduce the exact derivation on subsequent logins from any
    -- device using the same passphrase. 'argon2id' is the v1 default;
    -- a future ADR may add 'pbkdf2-sha256' as a fallback for very slow
    -- devices, which is why the algorithm is a column not a constant.
    kdf_algo                      TEXT  NOT NULL DEFAULT 'argon2id',

    -- 16 random bytes per user, base64-encoded. Generated client-side
    -- via crypto.getRandomValues at setup.
    kdf_salt                      TEXT  NOT NULL,

    -- Algorithm-specific cost parameters. For argon2id we expect:
    --   { "memory": 65536, "time": 3, "parallelism": 1 }
    -- For pbkdf2-sha256 (future):
    --   { "iterations": 600000 }
    kdf_params                    JSONB NOT NULL,

    -- The user's master encryption key (32 bytes random), encrypted
    -- under the passphrase-derived KDF key using AES-256-GCM.
    -- iv+tag+ciphertext base64-encoded together is the standard format
    -- chosen by the v1 frontend module; the IV is stored separately as
    -- well so a future format change can detect mismatches.
    wrapped_master_key            TEXT  NOT NULL,
    wrapped_master_iv             TEXT  NOT NULL,

    -- Second wrap of the SAME master key, this time under the recovery-
    -- phrase-derived key. Enables passphrase recovery without ever
    -- letting the server see the master key.
    wrapped_master_recovery       TEXT  NOT NULL,
    wrapped_master_recovery_iv    TEXT  NOT NULL,

    created_at                    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to bump updated_at on every UPDATE (e.g. password change → rewrap)
CREATE OR REPLACE FUNCTION trg_user_e2ee_metadata_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_e2ee_metadata_set_updated_at ON user_e2ee_metadata;
CREATE TRIGGER user_e2ee_metadata_set_updated_at
    BEFORE UPDATE ON user_e2ee_metadata
    FOR EACH ROW EXECUTE FUNCTION trg_user_e2ee_metadata_set_updated_at();

-- Flag on mood_entries — TRUE when notes is an opaque client-encrypted
-- blob; FALSE when notes is either plaintext or server-side AES-GCM.
ALTER TABLE mood_entries
    ADD COLUMN IF NOT EXISTS is_e2ee_encrypted BOOLEAN NOT NULL DEFAULT FALSE;

-- Index supports the "how many of my notes are still on the legacy
-- path?" migration-status query without a sequential scan once a user
-- has thousands of entries.
CREATE INDEX IF NOT EXISTS idx_mood_entries_e2ee
    ON mood_entries(user_id, is_e2ee_encrypted);

COMMENT ON TABLE user_e2ee_metadata IS
    'ADR-0009 v1 — per-user E2EE key material. The server stores only wrapped keys; the unwrapped master key never leaves the user''s browser.';

COMMENT ON COLUMN mood_entries.is_e2ee_encrypted IS
    'ADR-0009 v1 — when TRUE, notes column is opaque client-encrypted ciphertext that the server cannot decrypt. When FALSE, the legacy server-side AES-256-GCM path applies.';

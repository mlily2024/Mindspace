-- Migration 007: Web Push notifications
--
-- Adds the push_subscriptions table for the Web Push delivery channel,
-- which complements the existing Socket.io real-time channel.
--
-- Online users keep getting in-app notifications via Socket.io (low
-- latency, no permission prompt). Web Push gives the same notifications
-- to OFFLINE users as OS-level alerts via their browser's push service.
--
-- Stale endpoints (browser returns 410 Gone after PWA uninstall or
-- revoked permission) are auto-pruned by webPushService on dispatch.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    subscription_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    endpoint         TEXT NOT NULL,
    p256dh_key       TEXT NOT NULL,
    auth_key         TEXT NOT NULL,
    user_agent       TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at     TIMESTAMP,
    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions(user_id);

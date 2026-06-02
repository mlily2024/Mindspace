const logger = require('../config/logger');
const PushSubscription = require('../models/PushSubscription');

const DEFAULT_TTL_SECONDS = 86_400; // 24h delivery window

/**
 * WebPushService — delivers notifications to a user's browser endpoints
 * via the Web Push protocol (VAPID-authenticated).
 *
 * Used as a SECOND delivery channel alongside Socket.io:
 *   - Online users get Socket.io (low latency, no permission prompt).
 *   - Offline users get Web Push (OS-level alert, even when the tab is closed).
 *
 * Behaviour properties:
 *   - No-ops with a logged warning when VAPID keys are not configured.
 *     Chat and Socket.io continue to work — Web Push just doesn't fire.
 *   - On 404 / 410 from a push endpoint (browser has uninstalled the PWA
 *     or the user revoked permission) the subscription is auto-deleted.
 *   - Best-effort delivery: per-subscription failures are isolated via
 *     Promise.allSettled — one bad endpoint never blocks the others.
 *   - Fire-and-forget from the caller's perspective: a network hiccup
 *     here must never block the in-app Socket.io channel.
 */
class WebPushService {

  /**
   * @param {Object} [config]
   * @param {string} [config.vapidPublicKey]   defaults to VAPID_PUBLIC_KEY env
   * @param {string} [config.vapidPrivateKey]  defaults to VAPID_PRIVATE_KEY env
   * @param {string} [config.vapidSubject]     defaults to VAPID_SUBJECT env
   * @param {Object} [config.webpush]          optional injected web-push module (for tests)
   */
  constructor({ vapidPublicKey, vapidPrivateKey, vapidSubject, webpush } = {}) {
    this.publicKey  = vapidPublicKey  || process.env.VAPID_PUBLIC_KEY  || null;
    this.privateKey = vapidPrivateKey || process.env.VAPID_PRIVATE_KEY || null;
    this.subject    = vapidSubject    || process.env.VAPID_SUBJECT     || 'mailto:noreply@mindspace.local';

    if (webpush) {
      this.webpush = webpush;
      if (this.publicKey && this.privateKey && typeof this.webpush.setVapidDetails === 'function') {
        try { this.webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey); } catch (_) { /* noop */ }
      }
    } else if (this.publicKey && this.privateKey) {
      try {
        // eslint-disable-next-line global-require
        this.webpush = require('web-push');
        this.webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
      } catch (err) {
        logger.error('Failed to initialise web-push (likely SDK not installed)', { error: err.message });
        this.webpush = null;
      }
    } else {
      this.webpush = null;
    }
  }

  /** True when VAPID is configured AND the SDK is available. */
  isEnabled() {
    return !!this.webpush && !!this.publicKey && !!this.privateKey;
  }

  /**
   * Send a notification to ALL of a user's subscribed endpoints.
   *
   * @param {string|number} userId
   * @param {Object} payload   any JSON-serialisable object (service worker decides display)
   * @returns {Promise<{sent:number, pruned:number, failed:number}>}
   */
  async sendToUser(userId, payload) {
    if (!this.isEnabled()) {
      logger.warn('Web Push disabled — VAPID keys not configured', { userId });
      return { sent: 0, pruned: 0, failed: 0 };
    }

    const subs = await PushSubscription.findByUser(userId);
    if (subs.length === 0) {
      return { sent: 0, pruned: 0, failed: 0 };
    }

    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(subs.map(sub => this._sendOne(sub, body)));

    let sent = 0;
    let pruned = 0;
    let failed = 0;

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const sub = subs[i];

      if (r.status === 'fulfilled') {
        sent++;
        // Best-effort bump; ignore failure.
        PushSubscription.touchLastUsed(sub.subscription_id).catch(() => {});
        continue;
      }

      if (this._isGone(r.reason)) {
        try {
          await PushSubscription.deleteByEndpoint(sub.user_id, sub.endpoint);
          pruned++;
          logger.info('Pruned stale push subscription', {
            userId, endpointPrefix: String(sub.endpoint).slice(0, 40)
          });
        } catch (e) {
          logger.warn('Failed to prune stale subscription', { error: e.message });
        }
      } else {
        failed++;
        logger.warn('Push send failed', {
          userId, error: r.reason && r.reason.message
        });
      }
    }

    return { sent, pruned, failed };
  }

  /** @private */
  _sendOne(sub, body) {
    const subscriptionShape = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh_key, auth: sub.auth_key }
    };
    return this.webpush.sendNotification(subscriptionShape, body, { TTL: DEFAULT_TTL_SECONDS });
  }

  /** Browser returns 404 or 410 when the endpoint is no longer valid. */
  _isGone(err) {
    return err && (err.statusCode === 404 || err.statusCode === 410);
  }
}

// ── Singleton (lazy) ─────────────────────────────────────────────────────────
// Lazy so tests can call resetInstance() between cases, and so that the
// instance is built AFTER dotenv has populated process.env at server start.

let instance = null;

const getInstance = () => {
  if (!instance) instance = new WebPushService();
  return instance;
};

const resetInstance = () => { instance = null; };

module.exports = {
  WebPushService,
  getInstance,
  resetInstance
};

const PushSubscription = require('../models/PushSubscription');
const logger = require('../config/logger');

/**
 * POST /api/push/subscribe
 * Body: { endpoint: string, keys: { p256dh: string, auth: string } }
 *
 * The body shape matches the PushSubscription JSON the browser's
 * `PushSubscription.toJSON()` produces, so the frontend can post the
 * subscription object verbatim.
 */
const subscribe = async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({
        success: false,
        error: 'Invalid subscription payload — endpoint and keys.{p256dh,auth} are required.'
      });
    }
    const userId = req.user && req.user.userId;
    const row = await PushSubscription.upsert(userId, {
      endpoint,
      p256dhKey: keys.p256dh,
      authKey:   keys.auth,
      userAgent: (req.get && req.get('User-Agent')) || null
    });
    logger.info('Push subscription registered', {
      userId,
      subscriptionId: row.subscription_id,
      endpointPrefix: String(endpoint).slice(0, 40)
    });
    return res.json({ success: true, data: { subscriptionId: row.subscription_id } });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/push/unsubscribe
 * Body or query: { endpoint }
 */
const unsubscribe = async (req, res, next) => {
  try {
    const endpoint = (req.body && req.body.endpoint) || (req.query && req.query.endpoint);
    if (!endpoint) {
      return res.status(400).json({ success: false, error: 'endpoint is required' });
    }
    const removed = await PushSubscription.deleteByEndpoint(req.user.userId, endpoint);
    logger.info('Push subscription removed', { userId: req.user.userId, removed });
    return res.json({ success: true, data: { removed } });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/push/vapid-public-key
 *
 * Public endpoint — the frontend needs the VAPID public key BEFORE the
 * user has a session (it's used at service-worker registration time).
 * Returns null when Web Push is not configured for this deployment.
 */
const vapidPublicKey = (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY || null;
  return res.json({ success: true, data: { publicKey } });
};

module.exports = {
  subscribe,
  unsubscribe,
  vapidPublicKey
};

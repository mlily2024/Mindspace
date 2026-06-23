/**
 * cacheInvalidation — cross-instance cache-invalidation fan-out (F.7, ADR-0020).
 *
 * The cache (cacheService) keeps a fast LOCAL LRU per process. In a horizontally
 * scaled deployment the correctness problem is not the cache reads (each instance
 * happily serves its own) — it is INVALIDATION: when one instance drops a user's
 * cached data after a write, the other instances must drop it too, or they serve
 * stale reads. Rather than make every read async against a shared Redis cache (a
 * broad, risky refactor of the synchronous interface), we keep the local LRUs and
 * propagate only invalidation messages over Redis pub/sub.
 *
 * Default (no REDIS_URL): a no-op — single-instance behaviour is unchanged and
 * ioredis is never loaded. To enable multi-instance mode, set REDIS_URL AND install
 * ioredis (`npm install ioredis`); it is intentionally not a declared dependency so
 * single-instance deployments stay lean. If REDIS_URL is set but ioredis is missing,
 * the client construction throws, is caught, and we degrade safely to single-instance.
 *
 * The Redis client factory is injectable so this is unit-testable without ioredis
 * or a live server.
 */

const crypto = require('crypto');
const logger = require('../config/logger');

const CHANNEL = 'mindspace:cache:invalidate';

const NOOP_BACKEND = { enabled: false, instanceId: null, publish: () => {}, close: async () => {} };

/**
 * @param {(msg:object)=>void} onInvalidate  applies a peer's invalidation locally
 * @param {object} [opts]
 * @param {string} [opts.redisUrl]   defaults to process.env.REDIS_URL
 * @param {(url:string)=>object} [opts.createClient]  for tests; defaults to ioredis
 * @returns {{enabled:boolean, instanceId:?string, publish:Function, close:Function}}
 */
function init(onInvalidate, { redisUrl = process.env.REDIS_URL, createClient } = {}) {
  if (!redisUrl) return NOOP_BACKEND;

  const instanceId = crypto.randomUUID();
  const factory =
    createClient ||
    ((url) => {
      // Lazy optionalDependency: only loaded when REDIS_URL is actually set.
      const Redis = require('ioredis');
      return new Redis(url);
    });

  let pub;
  let sub;
  try {
    pub = factory(redisUrl);
    sub = factory(redisUrl);
  } catch (err) {
    logger.warn('cacheInvalidation: Redis unavailable; staying single-instance', { error: err.message });
    return NOOP_BACKEND;
  }

  Promise.resolve(sub.subscribe(CHANNEL)).catch((err) =>
    logger.warn('cacheInvalidation: subscribe failed', { error: err.message })
  );

  sub.on('message', (channel, raw) => {
    if (channel !== CHANNEL) return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || msg.instanceId === instanceId) return; // ignore our own messages
    try {
      onInvalidate(msg);
    } catch (err) {
      logger.warn('cacheInvalidation: apply failed', { error: err.message });
    }
  });

  logger.info('cacheInvalidation: Redis pub/sub invalidation enabled', { channel: CHANNEL });

  return {
    enabled: true,
    instanceId,
    publish: (payload) => {
      try {
        Promise.resolve(pub.publish(CHANNEL, JSON.stringify({ instanceId, ...payload }))).catch((err) =>
          logger.warn('cacheInvalidation: publish failed', { error: err.message })
        );
      } catch (err) {
        logger.warn('cacheInvalidation: publish threw', { error: err.message });
      }
    },
    close: async () => {
      try {
        if (sub.quit) await sub.quit();
        if (pub.quit) await pub.quit();
      } catch {
        /* best effort */
      }
    },
  };
}

module.exports = { init, CHANNEL };

const { LRUCache } = require('lru-cache');
const invalidation = require('./cacheInvalidation');

/**
 * In-process LRU cache with two TTL tiers + per-user invalidation.
 *
 *   short  — 60s TTL, used for live aggregates (stats, trends, biometric
 *            summary). Invalidated whenever the user POSTs new data.
 *   long   — 1h TTL, used for slower-changing summaries (correlation
 *            roll-ups). Also invalidated on user writes — staleness here
 *            is more tolerable.
 *
 * Keys are `<namespace>:<userId>[:<rest>...]`. The userId placement is
 * load-bearing for `delByUser` — see the matcher below.
 *
 * This is an INTRA-process cache. For horizontal scaling, reads stay local
 * (fast, synchronous) and only INVALIDATIONS are fanned out across instances
 * via Redis pub/sub (cacheInvalidation, F.7/ADR-0020). With no REDIS_URL the
 * fan-out is a no-op and behaviour is exactly single-instance.
 */

const shortTTL = new LRUCache({ max: 10_000, ttl: 60_000 });
const longTTL  = new LRUCache({ max: 10_000, ttl: 3_600_000 });
const stores = { short: shortTTL, long: longTTL };

const key = (namespace, userId, ...rest) =>
  rest.length
    ? `${namespace}:${userId}:${rest.join(':')}`
    : `${namespace}:${userId}`;

/** Drop every key for a given user from one store (no fan-out). Linear scan — fine at the 10k cap. */
const localDelByUser = (store, userId) => {
  const suffix = `:${userId}`;
  let dropped = 0;
  for (const k of store.keys()) {
    const colon = k.indexOf(':');
    if (colon === -1) continue;
    const rest = k.slice(colon);
    if (rest === suffix || rest.startsWith(`${suffix}:`)) {
      store.delete(k);
      dropped++;
    }
  }
  return dropped;
};

// Apply a peer instance's invalidation to our local LRUs — never re-published.
const applyInvalidation = (msg) => {
  const store = stores[msg && msg.tier];
  if (!store) return;
  if (msg.op === 'delByUser') localDelByUser(store, msg.userId);
  else if (msg.op === 'clear') store.clear();
};

const backend = invalidation.init(applyInvalidation);

const makeTier = (store, tierName) => ({
  get:        (k) => store.get(k),
  set:        (k, v) => { store.set(k, v); return v; },
  delete:     (k) => store.delete(k),
  has:        (k) => store.has(k),
  size:       () => store.size,
  clear:      () => { store.clear(); backend.publish({ tier: tierName, op: 'clear' }); },
  /** Drop every key for a given user, locally and across peer instances. */
  delByUser:  (userId) => {
    const dropped = localDelByUser(store, userId);
    backend.publish({ tier: tierName, op: 'delByUser', userId });
    return dropped;
  }
});

/**
 * Wrap an async producer with a cache lookup. On miss, run the producer,
 * store the result, and return it. On hit, skip the producer entirely.
 *
 *   const result = await cache.wrap(cache.short, k, () => doExpensiveWork());
 *
 * The producer is only invoked on miss, so it must be safe to skip on
 * cache hit — i.e. it must NOT have side effects that need to fire each
 * call. Writers must not be wrapped.
 */
const wrap = async (tier, k, producer) => {
  const hit = tier.get(k);
  if (hit !== undefined) return hit;
  const value = await producer();
  tier.set(k, value);
  return value;
};

module.exports = {
  short: makeTier(shortTTL, 'short'),
  long:  makeTier(longTTL, 'long'),
  key,
  wrap,
  // Exposed for tests / ops: the invalidation fan-out + the local-apply path.
  _invalidationBackend: backend,
  _applyInvalidation: applyInvalidation
};

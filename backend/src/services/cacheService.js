const { LRUCache } = require('lru-cache');

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
 * This is an INTRA-process cache. In a horizontally-scaled deployment,
 * swap the two LRUCache instances for Redis-backed clients behind the
 * same exported surface; no caller code changes.
 */

const shortTTL = new LRUCache({ max: 10_000, ttl: 60_000 });
const longTTL  = new LRUCache({ max: 10_000, ttl: 3_600_000 });

const key = (namespace, userId, ...rest) =>
  rest.length
    ? `${namespace}:${userId}:${rest.join(':')}`
    : `${namespace}:${userId}`;

const makeTier = (store) => ({
  get:        (k) => store.get(k),
  set:        (k, v) => { store.set(k, v); return v; },
  delete:     (k) => store.delete(k),
  has:        (k) => store.has(k),
  size:       () => store.size,
  clear:      () => store.clear(),
  /** Drop every key for a given user. Linear scan — fine at the 10k cap. */
  delByUser:  (userId) => {
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
  short: makeTier(shortTTL),
  long:  makeTier(longTTL),
  key,
  wrap
};

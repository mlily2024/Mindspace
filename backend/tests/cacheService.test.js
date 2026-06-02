/**
 * Tests for cacheService — in-process LRU cache with short/long tiers.
 * Executable specification of the API surface and per-user invalidation.
 */

const cache = require('../src/services/cacheService');

beforeEach(() => {
  cache.short.clear();
  cache.long.clear();
});

describe('cacheService', () => {

  describe('key()', () => {
    it('builds a namespaced, user-scoped key', () => {
      expect(cache.key('insights', 'user-1')).toBe('insights:user-1');
    });

    it('appends extra fragments after the userId', () => {
      expect(cache.key('summary', 'user-1', '2026-01', '2026-02'))
        .toBe('summary:user-1:2026-01:2026-02');
    });

    it('treats numeric userIds the same as string ones', () => {
      expect(cache.key('insights', 42)).toBe('insights:42');
    });
  });

  describe('get / set / has / delete', () => {
    it('round-trips a value', () => {
      cache.short.set('k', 'v');
      expect(cache.short.get('k')).toBe('v');
      expect(cache.short.has('k')).toBe(true);
    });

    it('returns undefined on miss', () => {
      expect(cache.short.get('missing')).toBeUndefined();
      expect(cache.short.has('missing')).toBe(false);
    });

    it('isolates the short and long tiers', () => {
      cache.short.set('k', 'short-val');
      cache.long.set('k', 'long-val');
      expect(cache.short.get('k')).toBe('short-val');
      expect(cache.long.get('k')).toBe('long-val');
    });

    it('delete() removes the key', () => {
      cache.short.set('k', 'v');
      expect(cache.short.delete('k')).toBe(true);
      expect(cache.short.has('k')).toBe(false);
    });

    it('set() returns the value (chainable)', () => {
      expect(cache.short.set('k', 42)).toBe(42);
    });
  });

  describe('size accounting', () => {
    it('size() reflects set/delete operations', () => {
      expect(cache.short.size()).toBe(0);
      cache.short.set('a', 1);
      cache.short.set('b', 2);
      expect(cache.short.size()).toBe(2);
      cache.short.delete('a');
      expect(cache.short.size()).toBe(1);
    });

    it('clear() removes all entries', () => {
      cache.short.set('a', 1);
      cache.short.set('b', 2);
      cache.short.clear();
      expect(cache.short.size()).toBe(0);
    });
    // TTL expiry is not unit-tested here: lru-cache uses performance.now()
    // for expiry, which jest's fake timers do not mock by default. The TTL
    // configuration (short=60s, long=1h) is exercised at integration time.
  });

  describe('delByUser()', () => {
    it('drops every key matching :userId (short tier)', () => {
      cache.short.set(cache.key('insights', 'u1'),    'a');
      cache.short.set(cache.key('stats',    'u1', '2026'), 'b');
      cache.short.set(cache.key('insights', 'u2'),    'c');   // different user

      const dropped = cache.short.delByUser('u1');

      expect(dropped).toBe(2);
      expect(cache.short.has(cache.key('insights', 'u1'))).toBe(false);
      expect(cache.short.has(cache.key('stats',    'u1', '2026'))).toBe(false);
      expect(cache.short.has(cache.key('insights', 'u2'))).toBe(true);  // unaffected
    });

    it('does not match userIds that are prefixes of another', () => {
      // Without proper boundary checking, "user-1" would falsely match
      // keys belonging to "user-10".
      cache.short.set(cache.key('s', 'user-1'),  'one');
      cache.short.set(cache.key('s', 'user-10'), 'ten');

      cache.short.delByUser('user-1');

      expect(cache.short.has(cache.key('s', 'user-1'))).toBe(false);
      expect(cache.short.has(cache.key('s', 'user-10'))).toBe(true);
    });

    it('returns 0 when no keys match', () => {
      cache.short.set(cache.key('s', 'u1'), 'a');
      expect(cache.short.delByUser('u-nobody')).toBe(0);
    });

    it('works independently on short vs long tiers', () => {
      cache.short.set(cache.key('s', 'u1'), 'a');
      cache.long.set( cache.key('l', 'u1'), 'b');

      cache.short.delByUser('u1');

      expect(cache.short.size()).toBe(0);
      expect(cache.long.size()).toBe(1);    // long tier untouched
    });
  });

  describe('wrap()', () => {
    it('invokes the producer on cache miss, caches the result', async () => {
      const producer = jest.fn().mockResolvedValue('fresh-value');
      const v1 = await cache.wrap(cache.short, 'wrap-key', producer);
      expect(v1).toBe('fresh-value');
      expect(producer).toHaveBeenCalledTimes(1);

      const v2 = await cache.wrap(cache.short, 'wrap-key', producer);
      expect(v2).toBe('fresh-value');
      expect(producer).toHaveBeenCalledTimes(1);  // NOT called again
    });

    it('returns the cached value without awaiting the producer', async () => {
      cache.short.set('wrap-key', 'pre-cached');
      const producer = jest.fn();   // must NOT be invoked
      const v = await cache.wrap(cache.short, 'wrap-key', producer);
      expect(v).toBe('pre-cached');
      expect(producer).not.toHaveBeenCalled();
    });

    it('propagates producer rejections (does NOT cache failures)', async () => {
      const err = new Error('boom');
      const producer = jest.fn().mockRejectedValue(err);

      await expect(cache.wrap(cache.short, 'wrap-key', producer))
        .rejects.toThrow('boom');

      // Failure must not poison the cache — next call retries.
      const recover = jest.fn().mockResolvedValue('ok');
      const v = await cache.wrap(cache.short, 'wrap-key', recover);
      expect(v).toBe('ok');
      expect(recover).toHaveBeenCalledTimes(1);
    });
  });
});

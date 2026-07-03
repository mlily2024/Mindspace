/**
 * Tests for the shared multi-instance DP budget (F.7 follow-on, ADR-0025).
 *
 * The existing single-instance PrivacyBudget behaviour lives in
 * differentialPrivacy.test.js and is untouched. This file covers the new
 * `consumeShared` path + the injectable Redis backend, with the load-bearing
 * test being global budget enforcement across two "instances" sharing one store.
 */
const { PrivacyBudget, createBudgetBackend } = require('../src/services/differentialPrivacy');

/** In-memory Redis mock: `eval` runs the atomic check-and-increment (JS is
 * single-threaded, so each call is atomic — exactly the guarantee Redis eval
 * gives across instances). */
function fakeRedis() {
  const store = new Map();
  return {
    async eval(_script, _numKeys, key, eps, total) {
      const cur = Number(store.get(key) || '0');
      const nxt = cur + Number(eps);
      if (nxt > Number(total) + 1e-12) return [0, String(cur)];
      store.set(key, String(nxt));
      return [1, String(nxt)];
    },
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async del(key) { store.delete(key); },
  };
}

describe('createBudgetBackend', () => {
  it('returns null with no redis url (single-instance default)', () => {
    expect(createBudgetBackend({ redisUrl: undefined })).toBeNull();
    expect(createBudgetBackend({ redisUrl: '' })).toBeNull();
  });

  it('degrades to null if the client factory throws', () => {
    const b = createBudgetBackend({ redisUrl: 'redis://x', createClient: () => { throw new Error('down'); } });
    expect(b).toBeNull();
  });
});

describe('consumeShared — single-instance (no backend)', () => {
  it('matches consume: enforces the budget and throws when exhausted', async () => {
    const b = new PrivacyBudget({ totalEpsilon: 2 });
    expect(await b.consumeShared('s', 1.5)).toBeCloseTo(1.5, 6);
    await expect(b.consumeShared('s', 1.0)).rejects.toThrow(/exhausted/i);
    expect(b.spent('s')).toBeCloseTo(1.5, 6); // sync reads unaffected
  });

  it('validates scope and epsilon', async () => {
    const b = new PrivacyBudget({ totalEpsilon: 5 });
    await expect(b.consumeShared('', 1)).rejects.toThrow(/scope/);
    await expect(b.consumeShared('s', 0)).rejects.toThrow(/epsilon/);
    await expect(b.consumeShared('s', -1)).rejects.toThrow(/epsilon/);
  });
});

describe('consumeShared — multi-instance (shared backend)', () => {
  const mk = (shared) =>
    new PrivacyBudget({
      totalEpsilon: 3,
      backend: createBudgetBackend({ redisUrl: 'redis://x', createClient: () => shared }),
    });

  it('enforces the budget GLOBALLY across instances', async () => {
    const shared = fakeRedis();
    const a = mk(shared); // instance A
    const b = mk(shared); // instance B, same shared store, its own empty local mirror

    expect(await a.consumeShared('cohort', 2)).toBeCloseTo(2, 6);
    // B sees A's spend even though B's local map is empty → 2+2 > 3 → rejected.
    await expect(b.consumeShared('cohort', 2)).rejects.toThrow(/exhausted/i);
    // A spend that still fits succeeds and takes the total to the cap.
    expect(await b.consumeShared('cohort', 1)).toBeCloseTo(3, 6);
    // now exhausted for everyone.
    await expect(a.consumeShared('cohort', 0.5)).rejects.toThrow(/exhausted/i);
  });

  it('two INDEPENDENT local budgets over-spend — the bug this fixes', async () => {
    const a = new PrivacyBudget({ totalEpsilon: 3 });
    const b = new PrivacyBudget({ totalEpsilon: 3 });
    expect(await a.consumeShared('cohort', 2)).toBeCloseTo(2, 6);
    // No shared backend → B has no idea A spent → 4 ε spent across two instances.
    expect(await b.consumeShared('cohort', 2)).toBeCloseTo(2, 6);
  });

  it('refreshes the local mirror so sync reads reflect the shared total', async () => {
    const b = mk(fakeRedis());
    await b.consumeShared('s', 2);
    expect(b.spent('s')).toBeCloseTo(2, 6);
    expect(b.remaining('s')).toBeCloseTo(1, 6);
  });
});

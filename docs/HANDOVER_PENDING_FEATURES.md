# Handover — pending feature implementations

This document covers three improvements that were assessed and either partly
shipped or scoped, but not yet fully completed. Each section is self-contained:
motivation, current state, the remaining work as concrete steps, verification,
risks, and an effort estimate.

**Items covered:**
1. [Finalise AES-256-GCM migration — remove CryptoJS legacy fallback](#1-finalise-aes-256-gcm-migration--remove-cryptojs-legacy-fallback)
2. [Lint cleanup — run ESLint and address findings](#2-lint-cleanup--run-eslint-and-address-findings)
3. [Caching layer — speed up DB-triggered reads](#3-caching-layer--speed-up-db-triggered-reads)

**Items already complete** (reference [ADRs](adr/) for the design rationale):
- LLM-backed Luna (Stages B+C) — see ADR-0001
- Web Push delivery channel (Stages D+E) — see ADR-0002
- UK localisation of crisis content (Stage A) — see ADR-0003
- Docker auto-init with full schema + migrations
- Architecture decision records for all of the above
- README with auto-captured screenshots

---

## 1. Finalise AES-256-GCM migration — remove CryptoJS legacy fallback

### Motivation
The active encryption path already uses **AES-256-GCM with authenticated
encryption** (per-record unique IV + auth-tag tamper detection). This is the
correct end-state for the privacy posture. The remaining work is to remove
the **CryptoJS fallback** that exists to decrypt any rows written before that
migration — and to drop the `crypto-js` dependency entirely.

### Current state
- **`backend/src/utils/encryption.js`** — `encrypt()` always writes AES-256-GCM
  (format `iv:authTag:ciphertext`, base64). `decrypt()` parses the new format
  first; on failure, it falls back to `CryptoJS.AES.decrypt(...)` for legacy
  rows.
- **`backend/package.json`** — `crypto-js` is still listed in `dependencies`
  (^4.2.0) purely for the fallback branch.
- **`backend/tests/encryption.test.js`** — tests cover both paths.
- The README and ADR-0001 already advertise AES-256-GCM as the active scheme.

### Work remaining (in order)

#### 1.1 Audit for any rows still in legacy format
Run from the project root:
```bash
cd backend && node -e "
require('dotenv').config();
const {pool} = require('./src/config/database');
(async () => {
  // Legacy CryptoJS output is a single base64 blob (no colons).
  // New AES-GCM output is iv:authTag:ciphertext (two colons).
  const r = await pool.query(\`
    SELECT COUNT(*) FILTER (WHERE notes IS NOT NULL AND notes NOT LIKE '%:%:%') AS legacy_rows,
           COUNT(*) FILTER (WHERE notes IS NOT NULL AND notes     LIKE '%:%:%') AS new_rows
      FROM mood_entries
  \`);
  console.log(r.rows[0]);
  await pool.end();
})();"
```
Repeat for any other table that stores encrypted values (currently only
`mood_entries.notes`).

#### 1.2 Write a one-shot re-encryption script
Create `backend/scripts/migrate-cryptojs-to-aes-gcm.js`:
```js
#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const {pool}   = require('../src/config/database');
const {decrypt, encrypt} = require('../src/utils/encryption');

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const r = await pool.query(`
    SELECT entry_id, notes FROM mood_entries
     WHERE notes IS NOT NULL AND notes NOT LIKE '%:%:%'
  `);
  console.log(`Found ${r.rows.length} legacy-encrypted rows.`);
  let migrated = 0, failed = 0;
  for (const row of r.rows) {
    try {
      const plain = decrypt(row.notes);   // existing fallback handles legacy
      const fresh = encrypt(plain);        // writes AES-GCM
      if (!dryRun) {
        await pool.query('UPDATE mood_entries SET notes=$1, is_encrypted=TRUE WHERE entry_id=$2', [fresh, row.entry_id]);
      }
      migrated++;
    } catch (err) {
      console.error(`  Failed: ${row.entry_id} — ${err.message}`);
      failed++;
    }
  }
  console.log(`Migrated: ${migrated}   Failed: ${failed}   (${dryRun ? 'DRY RUN — no writes' : 'WROTE'})`);
  await pool.end();
})();
```

Run dry-run first: `node backend/scripts/migrate-cryptojs-to-aes-gcm.js --dry-run`.
Verify the migrated/failed counts look right, then run for real (no flag).

#### 1.3 Re-run the audit query from step 1.1
Confirm `legacy_rows = 0`. If anything failed, investigate (corrupted row?
wrong key? — see Risks).

#### 1.4 Remove the legacy code path
In `backend/src/utils/encryption.js`, remove the fallback branch in
`decrypt()`:
```js
// DELETE this whole block:
try {
  const CryptoJS = require('crypto-js');
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
} catch (legacyError) {
  throw new Error('Unable to decrypt data (unsupported format)');
}
```
Replace with a clean error throw on unknown format:
```js
throw new Error('Unsupported encryption format (expected iv:authTag:ciphertext)');
```

#### 1.5 Drop the dependency
```bash
cd backend
npm uninstall crypto-js
```
This updates `package.json` and `package-lock.json`.

#### 1.6 Update tests
In `backend/tests/encryption.test.js`, remove any test that asserts legacy
CryptoJS-compatibility (search for `CryptoJS` or `legacy`). Add a positive
test that `decrypt()` throws on legacy-format input.

#### 1.7 Commit + push
Suggested commit message:
```
Drop CryptoJS legacy fallback; AES-256-GCM is the sole encryption path

Re-encrypted N legacy mood_entries rows via the one-shot migration script
backend/scripts/migrate-cryptojs-to-aes-gcm.js (run on 2026-XX-XX).
encryption.js now throws on any non-AES-GCM input; tests updated.
crypto-js removed from dependencies.
```

### Verification
- ✅ Audit query returns `legacy_rows = 0`.
- ✅ `npm test` in `backend/` passes.
- ✅ App still reads existing mood-entry notes through the UI.
- ✅ `grep -r "crypto-js" backend/src` returns nothing.
- ✅ `backend/package.json` no longer lists `crypto-js`.

### Risks & mitigations
| Risk | Mitigation |
|---|---|
| A row's legacy decryption fails — data loss if we drop fallback | Run with `--dry-run` first; back up `mood_entries` before live run. Keep `crypto-js` and the fallback branch until **every** row has migrated. If any failure, the row stays in legacy format and the fallback continues to handle it. |
| Wrong `ENCRYPTION_KEY` in `.env` | The audit script will report all rows as "Failed" — abort immediately. Confirm `.env` matches the key that originally encrypted the data. |
| Multi-deployment data divergence | Each deployment must run its own migration. Document in `DEPLOYMENT.md` (a follow-up note). |

### Estimated effort
30–60 minutes including dry-run review.

---

## 2. Lint cleanup — run ESLint and address findings

### Motivation
ESLint is already configured (`backend/.eslintrc.json`, lint scripts in
`backend/package.json`). It just hasn't been run on the codebase yet.
Running it surfaces dead code (unused variables, imports, parameters),
unreachable branches, and inconsistent patterns — all low-risk fixes that
tighten the codebase and read well in a code review.

### Current state
- **`backend/.eslintrc.json`** — config in place (shipped 2026-06-02).
- **`backend/package.json`** — scripts `lint` and `lint:fix` exist.
- **`eslint`** ^8.57.0 — already in devDependencies.
- The script has not been executed against the source.

### Work remaining (in order)

#### 2.1 Get a baseline count
```bash
cd backend
npm run lint 2>&1 | tail -20
```
Note the total error + warning counts; record in the commit message later.

#### 2.2 Apply auto-fixes
```bash
cd backend
npm run lint:fix
```
This fixes anything ESLint can correct automatically (trailing commas,
semicolons, simple unused variable removal in some cases).

#### 2.3 Re-run lint to see what remains
```bash
npm run lint
```
The remaining items need manual judgement. Typical categories:
- **`no-unused-vars`** — destructured variable never used. Often the right
  fix is to prefix with `_` (mark intentional) rather than delete (might be
  there for documentation).
- **`no-unreachable`** — code after `return`. Usually safe to delete.
- **`no-empty`** — empty catch blocks. Add a comment explaining why
  (`// best-effort`) rather than re-throwing.
- **`prefer-const`** — `let` that's never reassigned. Auto-fixable.

#### 2.4 For each remaining warning, apply judgement
- Definitely a bug → fix it.
- Intentional → prefix with `_` (for unused params) or add an inline
  `// eslint-disable-next-line <rule> -- <reason>` comment.
- Whole rule is too noisy → demote to `warn` or `off` in
  `.eslintrc.json` — but only with a recorded reason.

#### 2.5 Run the tests to make sure nothing regressed
```bash
cd backend && npm test
```

#### 2.6 Commit + push
Suggested commit message:
```
Address ESLint findings — N auto-fixes, M manual cleanups

Categories: unused destructured vars (prefixed _), unreachable
returns deleted, prefer-const auto-fixes. No behavioural changes.
Test suite still green.
```

### Verification
- ✅ `npm run lint` returns 0 errors.
- ✅ Any remaining warnings have an inline `eslint-disable` comment with a
  recorded reason.
- ✅ All tests still pass.

### Risks & mitigations
| Risk | Mitigation |
|---|---|
| Auto-fix accidentally changes behaviour (rare with default rules) | Run `git diff` after `lint:fix` and skim. Run tests. |
| A "used" variable gets deleted because static analysis missed a dynamic reference | Check tests; spot-check the suspect files manually. |

### Estimated effort
15–30 minutes.

---

## 3. Caching layer — speed up DB-triggered reads

### Motivation
Some endpoints do heavy work on every call — running ML predictions,
recomputing correlations, regenerating insights. These are usually
deterministic for a given user + time window, so an in-process cache with a
short TTL trades a small staleness for a meaningful latency win.

The original assessment phrased this as "cache POST calls on the database",
which is unusual — POSTs are usually writes. The real win is caching the
**heavy reads triggered downstream** of those writes (insights regenerated
after a mood POST, predictions recomputed after a check-in).

### Current state
No caching is implemented anywhere in the backend. Every request hits the
database (and ML compute) cold.

### Work remaining

#### 3.1 Identify candidate endpoints
The highest-value targets (heavy reads, low staleness sensitivity):

| Service | Method | Why cache |
|---|---|---|
| `insightsEngine.js` | `generate(userId)` | Stat / ML compute over 14-30 days of mood data |
| `trendPredictor.js` | `predictNext(userId, days)` | Time-series projection |
| `biometricCorrelationService.js` | `getCorrelations(userId)` | Pearson over 30 days, multi-table join |
| `predictiveEngineService.js` | `getPredictions(userId, days)` | Enhancement-5 ML model inference |
| `wearableService.js` | `getDashboard(userId)` | Many subqueries aggregated |

Avoid caching anything that:
- Returns user-specific *write* state (e.g. `/api/mood` GET with strict
  recency expectations) — staleness here confuses users.
- Is already fast (single-row reads).

#### 3.2 Add `lru-cache` to backend deps
```bash
cd backend
npm install lru-cache
```

#### 3.3 Create a small cache service
Create `backend/src/services/cacheService.js`:
```js
const { LRUCache } = require('lru-cache');

// Tier-1: short-lived, refresh-on-write (insights, daily aggregates).
//         Invalidated on mood POST.
const shortTTL = new LRUCache({ max: 10_000, ttl: 60_000 });   // 60s

// Tier-2: long-lived, deterministic (model predictions, correlations).
//         Refreshed on a schedule or after a mood POST.
const longTTL  = new LRUCache({ max: 10_000, ttl: 3600_000 }); // 1h

const key = (namespace, userId, ...rest) =>
  `${namespace}:${userId}${rest.length ? ':' + rest.join(':') : ''}`;

module.exports = {
  short: {
    get:  (k) => shortTTL.get(k),
    set:  (k, v) => shortTTL.set(k, v),
    del:  (k) => shortTTL.delete(k),
    delByUser: (userId) => {
      for (const k of shortTTL.keys()) if (k.includes(':' + userId)) shortTTL.delete(k);
    }
  },
  long: {
    get:  (k) => longTTL.get(k),
    set:  (k, v) => longTTL.set(k, v),
    del:  (k) => longTTL.delete(k),
    delByUser: (userId) => {
      for (const k of longTTL.keys()) if (k.includes(':' + userId)) longTTL.delete(k);
    }
  },
  key
};
```

#### 3.4 Wrap target service methods
Example for `insightsEngine.generate`:
```js
const cache = require('./cacheService');

async function generate(userId) {
  const k = cache.key('insights', userId);
  const hit = cache.short.get(k);
  if (hit) {
    logger.debug('insights cache hit', { userId });
    return hit;
  }
  const result = await _generateUncached(userId);
  cache.short.set(k, result);
  return result;
}
```

Apply the same pattern to the other 4 candidate methods. Use the **short**
tier for anything that should refresh after a mood POST (insights, daily
aggregates). Use the **long** tier for model predictions and correlations.

#### 3.5 Invalidate on writes
In `backend/src/controllers/moodController.js::createMoodEntry`, after the
mood entry is written, invalidate the user's caches:
```js
const cache = require('../services/cacheService');
// ... after MoodEntry.create(...) succeeds ...
cache.short.delByUser(req.user.userId);
cache.long.delByUser(req.user.userId);  // optional — long-tier may also be invalidated
```

#### 3.6 Add minimal observability
Log hit / miss / set events at `debug` level. Optional but useful for
verifying the cache actually fires.

#### 3.7 Write tests
At minimum, a unit test for `cacheService` that exercises set/get/expiry/
invalidation. Integration tests for the wrapped services are nice-to-have
but skip if running short on time — the cache itself is well-tested
upstream.

#### 3.8 Commit + push
Two logical commits suggested:
1. `Add in-process cache service (short + long TTL tiers, per-user invalidation)`
2. `Cache insights / predictions / correlations; invalidate on mood POST`

### Verification
- ✅ `lru-cache` in `backend/package.json`.
- ✅ Second call to `/api/insights` returns measurably faster than first
  (use Chrome DevTools network timing or `console.time` in the controller).
- ✅ After POSTing a mood entry, the next `/api/insights` call is fresh
  (cache invalidated correctly — value differs).
- ✅ Tests pass.

### Risks & mitigations
| Risk | Mitigation |
|---|---|
| Stale data shown if invalidation misses an edge case | Keep short-tier TTL low (60s) so worst case auto-recovers in a minute. |
| Memory growth | `LRUCache({ max: N })` bounds it. 10,000 entries × small JSON ≈ a few MB. |
| Multi-instance deployments don't share cache | Acceptable at current single-node scale. If horizontal scaling becomes real, swap the in-process Maps for Redis behind the same `cacheService` interface — no callers change. |
| User-data leakage if cache key collides | Always include `userId` in the key (the `key()` helper enforces this). |

### Estimated effort
45–90 minutes, depending on how many endpoints get wrapped.

---

## Order recommendation

1. **#2 (lint cleanup)** first — shortest, surfaces nothing dangerous, lands a
   clean baseline before any structural changes.
2. **#1 (AES-GCM finalisation)** — touches data, do it second when you can
   focus. Always dry-run first.
3. **#3 (caching)** — biggest design surface; saves for when there's an
   afternoon of focus.

Each is independent; they can also ship in separate releases.

---

## What this handover deliberately does NOT cover

- Anything in [ADRs 0001–0003](adr/) — that's already shipped.
- Frontend lint cleanup — frontend has its own `lint` script; the work mirrors
  item 2 here but for `frontend/src/`.
- A documented rotation policy for VAPID and Anthropic keys — useful to add
  to `DEPLOYMENT.md` separately.
- Visual-regression tests using the existing Playwright screenshot harness —
  the bones are there (`frontend/scripts/capture-screenshots.js`); turning
  them into a CI check is a small follow-up.

---

*End of pending-features handover. Last updated 2026-06-02.*

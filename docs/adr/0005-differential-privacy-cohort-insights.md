# ADR-0005: ε-differential privacy for cohort aggregates

**Status:** Accepted (2026-06-02)

## Context

Mindspace stores per-user mental-health data behind authenticated
endpoints with AES-256-GCM encryption at rest (ADR-0004 / per-record
auth-tag). That posture protects individual data, but it offers nothing
useful when a clinician, researcher, or product owner asks an
aggregate question — *"do users in this cohort tend to feel worse on
Mondays?"* — without exposing any single user's records.

The obvious naive answer — "just compute the mean and return it" —
fails for two reasons. First, the result is one of an enormous family
of possible outputs that any specific user can shift through their
participation; an attacker watching aggregate outputs across time can
infer individual contributions (membership-inference / linkage
attacks). Second, sequential queries compound the leak. Privacy has to
be a property of the *release mechanism*, not of the data alone.

Consumer mental-health apps in this category broadly do not do this.
The few that "support cohort insights" tend to k-anonymise (suppress
cells with fewer than k contributors) and stop there, which is
inadequate against an adversary with auxiliary information and
multiple queries.

## Decision

We adopt **ε-differential privacy** as the release standard for any
aggregate computed across users. The first concrete endpoint
(`GET /api/cohort-insights/mood-by-day-of-week`) demonstrates the
mechanism on the simplest useful aggregate: the average mood score
grouped by day of week.

The implementation rests on three concrete pieces:

### 1. Laplace mechanism with cryptographic randomness

`differentialPrivacy.js` exposes a `laplaceSample(scale)` and an
`addLaplaceNoise(value, sensitivity, ε)` helper. The release is

> f(D) + Lap(0, Δf / ε)

which satisfies ε-DP for any function f with global sensitivity Δf.

The noise sampler draws uniform `[0, 1)` from `crypto.randomBytes`
(48-bit precision), then inverse-CDF-transforms to Laplace. `Math.random`
is **explicitly rejected** — it is seeded predictably and has
insufficient entropy for DP guarantees that depend on the randomness
being indistinguishable from true.

### 2. Sensitivity helpers for the common cases

A small table of standard global sensitivities (`sensitivity.count`,
`sensitivity.sumOnBounded(lo, hi)`, `sensitivity.meanOnBounded(lo, hi, n)`)
prevents the common error of guessing the sensitivity wrong. For the
mood-by-DOW endpoint, mood scores are bounded to `[1, 10]` so the mean
sensitivity is `9/n` per DOW group, where n is the number of
contributing entries.

### 3. PrivacyBudget — sequential composition enforcement

A process-wide `PrivacyBudget` tracks cumulative ε spent per scope
(e.g. `'cohort:mood_by_dow'`). Sequential-composition theorem: k
mechanisms with parameters ε₁…εₖ over the same dataset compose to
(Σ εᵢ)-DP. The budget refuses any query that would push the total
past a configured ceiling (default 10).

The budget is consumed **before** the database query runs, so a query
that fails (DB down, etc.) does not refund ε — refunding on failure
would itself leak information about dataset state through timing of
error vs success.

### 4. Per-DOW parallel composition

The seven day-of-week groups partition the data — each mood entry
contributes to exactly one group. Parallel composition: queries on
disjoint partitions consume only `max ε` rather than `Σ ε`. The
endpoint therefore charges `ε` (not `7ε`) per call.

### 5. Small-cell suppression

Groups with fewer than `minN` contributing entries (default 5) are
returned `suppressed: true` with `noisyAverage: null`. For very small
n the noise scale `9 / (n · ε)` dominates the signal; publishing a
near-noise value is both unsafe and uninformative. Suppression is
done **after** the sensitivity calculation so it cannot itself become
a side channel.

### 6. Post-processing clamp

Published noisy means are clamped to the bounded mood range `[1, 10]`.
Clamping is post-processing of a DP release and does not weaken the
guarantee, but it prevents callers from inferring noise direction.

## Why not stronger or different mechanisms?

| Alternative | Why not yet |
|---|---|
| Gaussian mechanism for (ε, δ)-DP | Adds a second parameter (δ) and an analytic Gaussian implementation. Not needed for the Laplace-friendly aggregates we publish first. Can drop in later behind the same `addNoise` API. |
| Local DP (noise added on device) | A stronger trust model, but it raises the noise floor materially — published means would be unusable at our scale. Reserve for the on-device journal-sentiment work (Arc 1 Step B). |
| k-anonymity only | Insufficient under linkage; well-documented since L. Sweeney 2002. We use cell suppression as one *part* of the release, not the whole guarantee. |
| RAPPOR / randomised response | Overhead not justified for server-side numeric aggregates of bounded scores. |

## What this is NOT

- **Not a substitute for access control.** Authenticated users only.
  ADR-0004's audit log records who consumed ε from which scope.
- **Not a quantitative privacy claim for the system as a whole.**
  ε bounds the leakage of *this mechanism*. Other surfaces
  (encryption, audit, push, on-device) carry their own claims.
- **Not user-level DP.** The released aggregate treats one mood
  entry as the unit of presence/absence (event-level DP). A
  rigorous user-level guarantee would require per-user contribution
  clipping (each user contributes at most c entries). That work is
  queued as a follow-up; the current bound is honest for the
  documented mechanism but is weaker than user-level if any single
  user dominates the dataset.

## Trade-offs accepted

| Cost | Mitigation |
|---|---|
| Published means have visible noise — useful for trend questions, not for clinical decisions about individuals. | This is the entire point: any noise-free release is unsafe. The endpoint surface includes `n` and `ε` so the caller can reason about uncertainty. |
| Per-query budget is in-process memory — restarts reset it. | Documented limitation. A future move to a Redis or DB-backed counter is straightforward (the `PrivacyBudget` class is the only thing that changes). For now an attacker who can force a restart is already a much bigger problem. |
| Total budget (default 10 ε) is a research-style number, not a regulatory one. | Configurable. The point is the *machinery* exists; tuning the number is a deployment decision and would be informed by the volume of queries expected. |
| The first endpoint exposes only one aggregate. | Deliberate scope. The methods note (Arc 1 write-up) extends to histograms, percentiles, and selected slicing once the foundation is shipped. |

## Verification

- **33 unit tests** across `tests/differentialPrivacy.test.js` (21) and
  `tests/cohortInsightsService.test.js` (12). The DP tests verify the
  Laplace empirical mean and variance against theory (centred at 0,
  variance ≈ 2·scale²), the privacy-budget composition rule, and that
  smaller ε produces materially larger noise. The cohort tests verify
  small-cell suppression, clamp behaviour, that repeated calls produce
  different noise (fresh randomness), and that the budget is consumed
  before the DB query (so a DB failure does not refund ε).
- Full test suite: **196/196 passing across 14 suites**.
- ESLint: 0 issues.

## References

- Dwork, C. & Roth, A. (2014). *The Algorithmic Foundations of
  Differential Privacy.* Foundations and Trends in Theoretical
  Computer Science.
- Dwork, C., McSherry, F., Nissim, K., & Smith, A. (2006). *Calibrating
  noise to sensitivity in private data analysis.* TCC.
- Sweeney, L. (2002). *k-Anonymity: a model for protecting privacy.*
  Int. J. Uncertain. Fuzziness Knowl. Based Syst.
- ADR-0001 (LLM provider abstraction + safety boundary) — the
  responsible-AI architecture this fits inside.
- ADR-0004 (Hash-chained AI audit log) — every cohort query is itself
  audit-logged via the same machinery.

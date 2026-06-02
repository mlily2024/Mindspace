# ADR-0004: Hash-chained AI audit log for tamper-evident interaction records

**Status:** Accepted (2026-06-02)

## Context

Luna is an LLM-backed companion operating in a sensitive domain (mental
health). Three uncomfortable questions follow from that:

1. *Did the safety filter actually fire on every input it should have?*
2. *Did the LLM ever produce a response the safety pipeline missed?*
3. *If a compromised server later modified historical records to hide a
   missed signal, would we know?*

Standard application logging answers (1) and (2) only as well as the
application code chooses to. None of it answers (3) — write-anywhere
logs are erasable by anyone with write access. For an app whose entire
visa-evidence positioning is "responsible AI in a sensitive domain",
that is an unsatisfactory floor.

## Decision

We add an append-only, hash-chained `ai_audit_log` table. Every Luna
interaction (rule-based, LLM-backed, or crisis-filter response)
produces one row. Each row carries:

- **Privacy-safe content fingerprints.** `input_hash` and `output_hash`
  are SHA-256 digests of the user message and model response. The
  plaintext is never stored.
- **Structured outcome fields.** `provider`, `model_version`,
  `safety_verdict` (JSONB), `output_classification`, `latency_ms`.
- **Chain linkage.** `prev_hash` references the prior record's
  `record_hash` for the same user (or `'GENESIS'` for the first record).
  `record_hash = SHA-256(canonical_payload || prev_hash)`. Any
  mutation of either content or order invalidates every subsequent
  hash, so tampering is detectable by walking the chain.

Append-only is enforced **at the database layer** via a trigger that
raises on UPDATE. The application code uses fire-and-forget
(`safeAppend`) so an audit failure can never block a user-facing
response. A `verifyChain(userId)` method walks the user's chain end to
end, recomputing each `record_hash`, and returns the offending
`sequence_number` if any link fails.

## Why per-user chains, not one global chain

A single global chain serialises every write through one row of state.
Per-user chains:

1. Scale linearly with users instead of being a hot spot.
2. Preserve privacy. A global chain leaks cross-user interaction
   timing through the linkage. Per-user chains do not.
3. Are independently verifiable — exporting one user's chain for an
   audit (or for a GDPR data-portability request) does not entangle
   other users' records.

The tamper-detection guarantee is identical: any mutation breaks the
affected user's chain irreversibly.

## Why hashes, not encrypted plaintext

We considered encrypting the message and response with AES-256-GCM
(matching the existing scheme on `mood_entries.notes`) so the audit log
could be decrypted under controlled circumstances. We rejected that:

- The compliance value of the audit log lies in *what categories of
  interaction happened, in what order, and were they handled correctly*.
  Replaying the conversation verbatim adds nothing to that and adds a
  large privacy liability.
- Anyone with the encryption key — by definition, the same key that
  protects the journal — could read the audit log verbatim. The audit
  log should be useful **even when the key is compromised**, which
  hashes satisfy and encryption does not.
- Structured fields (`safety_verdict`, `output_classification`) carry
  the auditable signal without the privacy cost.

If a future requirement needs the plaintext for a specific user (e.g.
serving a clinical-records subject access request), the chat history
in `chatbot_messages` already stores it under the existing AES-GCM
scheme. The audit log and the conversation store have intentionally
different purposes.

## Why advisory locks, not SERIALIZABLE

Concurrent `append()` calls for the same user must serialise on the
chain head (the row whose `record_hash` becomes the next `prev_hash`),
or the chain forks silently. `SERIALIZABLE` isolation serialises
*everything*, which is over-broad. Postgres `pg_advisory_xact_lock`
takes a 32-bit key derived from `SHA-256(user_id)`, releases on
transaction end, and contends only with other writers for the same
user. Reads (and writes for other users) are unaffected.

## What this is NOT

- **Not a replacement for application logging.** The standard
  `logger.warn/error` flow continues to fire on crisis detection and
  provider fallback. The audit log is for *afterwards*, when someone
  needs to prove what happened.
- **Not a hosted timestamp service.** Each record's timestamp is
  server-side; an attacker with full server access could write
  back-dated records that self-consistently hash. The defence is
  detecting **mutation of existing records**, which is the realistic
  threat. (A future enhancement could anchor periodic chain heads to
  an external append-only system — e.g., a public git repo — for
  third-party trust.)
- **Not a research artefact.** Hash chains are well-understood since
  Haber & Stornetta 1991. The contribution is the *combination* —
  privacy-preserving fingerprints + DB-enforced append-only + per-user
  chains — applied to a consumer mental-health context where it does
  not appear in the comparator set.

## Trade-offs accepted

| Cost | Mitigation |
|---|---|
| Slightly increased write path on every Luna interaction. | One small INSERT per response; fire-and-forget so user latency is unaffected. |
| `verifyChain` is O(n) per user. | Linear in interaction count; expected n is small (hundreds, not millions). Pagination is straightforward if needed. |
| Schema evolution is sensitive — adding a field to the canonical payload would break verification of historic records. | The canonical key set is documented in `aiAuditService.canonicalPayload` with an explicit "never reorder existing keys" comment. New fields require a versioned hash scheme (deferred until needed). |
| The hash chain is in the same database it audits. | Append-only at the SQL layer raises the bar but is not unbreakable from a fully compromised database. The external-anchoring extension above is the next step if the threat model warrants it. |

## Verification

- 25 unit tests in `tests/aiAuditService.test.js` cover the hash logic,
  stable canonicalisation, tamper detection (field mutation, broken
  links, forged insertion), and the plaintext-never-stored guarantee.
- End-to-end smoke against a live Postgres confirms genesis behaviour,
  cross-record linkage, `verifyChain` happy-path, and the UPDATE
  trigger refusing mutation with the expected error.

## References

- Haber, S., Stornetta, W.S. (1991). *How to time-stamp a digital
  document.* Journal of Cryptology.
- Postgres docs on `pg_advisory_xact_lock`.
- ADR-0001 (LLM provider abstraction + safety boundary) — the audit
  log sits at the abstraction boundary documented there.
- ADR-0003 (UK-localised crisis content) — the `safety_verdict` JSON
  schema is intentionally compatible with the structure described
  there.

# ADR-0003 — UK localisation of crisis content (SafetyFilter)

- **Status:** Accepted
- **Date:** 2026-06-02
- **Affects:** `backend/src/services/safetyFilter.js`, `lunaService.js`, `backend/tests/safetyFilter.test.js`

## Context

Mindspace is a UK-focused mental-health platform — README, privacy policy, and
all user-facing copy reference UK organisations (NHS, Samaritans, Shout). The
README has a "Crisis resources (UK)" section listing the relevant helplines:

- **Samaritans:** 116 123
- **Shout Crisis Text Line:** text SHOUT to 85258
- **NHS Urgent Mental Health:** 111
- **Mind Infoline:** 0300 123 3393
- **PAPYRUS (under-35s):** 0800 068 4141
- **Emergency services:** 999

The newer "Luna 2.0" code path (`lunaService.js`, `/api/luna/*`), however,
was written with **US-localised crisis content** baked in: the inline crisis
response referenced the 988 Suicide & Crisis Lifeline, the 741741 Crisis Text
Line, and 911 emergency services. A UK user in crisis on that endpoint would
have been directed to numbers that do not exist in the UK.

This is the most safety-relevant content in the entire codebase. It cannot be
allowed to drift between layers, between deployments, or between regions
silently.

## Decision

Extract crisis detection and response into a dedicated `SafetyFilter` module
with the following properties:

1. **Single source of truth.** Both the keyword list (`UK_CRISIS_KEYWORDS`)
   and the resource registry (`UK_CRISIS_RESOURCES`) live in one file and are
   exposed as `Object.freeze`-d constants so they can be asserted from
   outside the module.
2. **Pure and network-free.** `detect(message)` and `buildResponse()` make
   no DB query and no network call. Crisis detection cannot be degraded by
   an LLM outage, a Web Push outage, or a database hiccup.
3. **Run before any response generator** — see
   [ADR-0001](0001-llm-provider-abstraction-and-safety-boundary.md).
   `lunaService.processMessage` calls `safetyFilter.detect()` first; on a
   positive detection it returns the SafetyFilter response and short-circuits
   the rest of the pipeline.
4. **Defensive on input.** Non-string / empty input returns `false` instead of
   throwing — the safety check itself can never crash the chat handler.
5. **Tested as a contract**, not just an implementation. The unit tests
   assert:
   - The keyword list contains the expected phrases (positive cases).
   - Ordinary text does not match (negative cases).
   - The response references **only UK services** (positive UK assertions).
   - The response references **no US services** (regression-guard:
     `expect(response).not.toMatch(/\b988\b/)`, `/\b911\b/`, `/741741/`,
     `/Crisis Text Line/`).
   - The exported constants are deep-frozen.

This makes the UK localisation contract executable rather than
documentary — accidental reintroduction of US numbers will fail CI.

The response is built from the resource registry rather than inlined, so the
SafetyFilter response text and the README crisis-resources section stay in
sync at the data level even if either's formatting changes.

## Consequences

### Positive

- **UK users get correct, jurisdiction-appropriate referrals** in the most
  safety-critical conversational path.
- **Regression-guarded** — the absence of US numbers is asserted in tests, so
  this class of bug cannot silently return.
- **Auditable from the outside.** A reviewer or assessor can grep
  `safetyFilter.js` and the test file in seconds and verify the safety
  contract is what they expect.
- **Centralised** — a future change (e.g., updating Papyrus's number) is
  one edit, not a hunt across multiple files.

### Negative

- **The pre-existing `/api/chatbot/*` path** (the legacy `chatbotController`
  used by the live frontend) maintains its own UK-localised crisis text
  inline. It is currently *correct* (UK-localised already), but it duplicates
  the content. Convergence onto `SafetyFilter` is queued as a future task —
  deliberately not done in this change to honour the "do not affect working
  functionality" rule on the live path.

### Neutral

- The keyword list is intentionally conservative (broad phrases like
  "kill myself", "want to die"). False positives — a user discussing the
  history of self-harm in a non-crisis context — will receive the crisis
  response. The trade-off is deliberate: false positives are recoverable
  (the user reads the response, sees the resources, continues); false
  negatives in this domain are not.

## Alternatives considered

1. **Leave the US-localised text in place pending a wider i18n effort.**
   Rejected — this is a UK app with UK GDPR posture; pointing UK users to US
   numbers is a meaningful safety regression that cannot wait on
   internationalisation infrastructure.
2. **Per-user locale config (`user.region`) that selects between US/UK/etc.
   crisis text.** Deferred — useful future work, but UK-only here keeps the
   scope tight and the test contract simple.
3. **Delegate crisis detection to the LLM** via system-prompt instruction.
   Rejected for the same reason as in ADR-0001: safety properties of a
   mental-health app must not depend on the availability or behavioural
   compliance of a third-party model.
4. **Use an external crisis-classification API.** Rejected for MVP — adds a
   third-party dependency, latency, privacy concern, and another point of
   failure on the most safety-critical path.

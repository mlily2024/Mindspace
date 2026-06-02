# ADR-0001 — LLM provider abstraction and safety boundary

- **Status:** Accepted
- **Date:** 2026-06-02
- **Affects:** `backend/src/services/lunaService.js`, `responseGenerator.js`, `ruleBasedResponseGenerator.js`, `anthropicResponseGenerator.js`, `responseGeneratorFactory.js`, `safetyFilter.js`

## Context

Luna is the in-app therapeutic chatbot inside a UK mental-health platform. Its
original implementation was entirely rule-based: keyword detection feeding a
small set of CBT/ACT response templates. The rule-based engine is reliable and
zero-cost, but the responses are repetitive and lack the conversational warmth
of an LLM.

We wanted to introduce LLM-backed responses (Anthropic Claude) without
compromising the safety properties of a mental-health tool, namely:

1. **Crisis content must never depend on a third-party service.** A network
   outage at the LLM provider must not cause Luna to fail to escalate someone
   in crisis.
2. **Users must consent before their chat content leaves the device.**
   Sending conversation text to a third-party processor is a non-trivial
   privacy event under UK GDPR.
3. **Cost must be controllable.** An LLM bill in a public-facing app can scale
   unboundedly through abuse or success.
4. **The choice must be reversible.** We should be able to swap providers
   (e.g. to Mistral, OpenAI, or back to rule-based) without rewriting Luna.

## Decision

Introduce a `ResponseGenerator` abstract base class with two implementations:

- **`RuleBasedResponseGenerator`** — wraps the existing template logic. Default
  provider, zero cost, no network. Always available as a fallback.
- **`AnthropicResponseGenerator`** — wraps the Anthropic Messages API. Targets
  Claude Haiku 4.5 by default; model and limits are env-overridable.

Provider selection goes through `responseGeneratorFactory.getProvider()`, driven
by the `LUNA_PROVIDER` env var (default `rule_based`). Unknown values log a
warning and degrade to rule-based — a typo in deployment config can never
break the chat.

**Crisis detection is hoisted out of the response path entirely.** A
`SafetyFilter` module (see [ADR-0003](0003-uk-localised-crisis-content.md))
runs *before* the provider in `lunaService.processMessage`. Crisis messages
return the UK-localised crisis response directly; the LLM never sees crisis
content.

Per-user consent is enforced via the `llm_opted_in` flag on `luna_profiles`.
Two conditions must both be true for a user to receive LLM responses:

1. **Deployment-level:** `LUNA_PROVIDER=anthropic` is set on the server.
2. **User-level:** `profile.llm_opted_in === true` on the user's Luna profile.

If either is missing, the user transparently receives rule-based responses.

The Anthropic provider is wrapped in four pre-flight protections, all
configurable by env var:

| Protection | Default | Env var |
|---|---|---|
| Per-user daily call limit | 30 | `LUNA_LLM_DAILY_LIMIT` |
| Monthly token cost cap | 5,000,000 (~$1.50/mo on Haiku 4.5) | `LUNA_LLM_MONTHLY_TOKEN_CAP` |
| Circuit breaker threshold / cooldown | 5 failures / 60 s | `LUNA_LLM_CIRCUIT_*` |
| SDK request timeout | 15 s | `LUNA_LLM_TIMEOUT_MS` |

Any LLM error — rate-limit hit, cost-cap hit, circuit open, network error,
malformed response — is caught in `lunaService.processMessage` and falls
through to a freshly instantiated `RuleBasedResponseGenerator`. The user
always gets a reply; the failure is logged.

The system prompt is a frozen constant inside `anthropicResponseGenerator.js`
and is asserted in unit tests for:

- UK English styling (`British English`, `behaviour`, `realise`)
- Mental-health disclaimer (`not a licensed therapist`)
- Crisis fallback instruction (Samaritans 116 123) for the edge case where
  crisis content slips past the SafetyFilter

## Consequences

### Positive

- **Safety guarantee is structural, not procedural.** The SafetyFilter runs
  before any provider call by construction of `processMessage`; reviewers can
  audit this in a single function.
- **Provider is genuinely swappable.** Adding (e.g.) `OpenAIResponseGenerator`
  is one new file and one extra case in the factory `switch`. No changes to
  `LunaService`.
- **GDPR posture is defensible.** No user's chat content reaches a third party
  until *both* the operator and the individual user have opted in.
- **Cost is bounded.** A misconfigured rate limit or runaway loop is capped
  per user and per month.
- **Test coverage is straightforward.** The provider interface is mockable;
  `AnthropicResponseGenerator` accepts an injected SDK client so tests run
  without `@anthropic-ai/sdk` installed and without a real API key.

### Negative

- **Lazy `require` of the Anthropic SDK** adds a small piece of conditional
  loading that's easy to forget when modifying the constructor.
- **Per-process state for the rate limiter and cost governor** means
  multi-instance deployments share neither. Acceptable at current single-node
  scale; a Redis-backed limiter would be needed before horizontal scaling.
- **The system prompt is a single string constant.** Per-user prompt
  variation would require additional design.

### Neutral

- A user who has opted in but loses LLM access due to a fault (cost cap,
  circuit breaker, etc.) silently receives rule-based responses. They are not
  notified of the degradation. Logged on the server side.

## Alternatives considered

1. **Direct LLM integration without an abstraction.** Rejected — couples
   Luna to one provider, makes the safety boundary harder to enforce, makes
   testing require live API calls.
2. **Crisis detection delegated to the LLM via a system prompt.** Rejected —
   safety properties of a mental-health app must not depend on the
   availability or behavioural compliance of a third-party model.
3. **Globally enable LLM for all users.** Rejected on GDPR grounds — sending
   conversation content to a third-party processor requires explicit user
   consent.
4. **Defer LLM integration entirely.** Rejected — the rule-based responses
   are repetitive enough that user-perceived chatbot quality is meaningfully
   limited.

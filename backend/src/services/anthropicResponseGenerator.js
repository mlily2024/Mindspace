const ResponseGenerator = require('./responseGenerator');
const logger = require('../config/logger');

// ─── Defaults (all env-overridable) ──────────────────────────────────────────

const DEFAULT_MODEL                  = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS             = 600;
const DEFAULT_TIMEOUT_MS             = 15_000;
const DEFAULT_DAILY_LIMIT_PER_USER   = 30;
const DEFAULT_MONTHLY_TOKEN_CAP      = 5_000_000;   // ~$1.50/mo on Haiku 4.5
const DEFAULT_CIRCUIT_THRESHOLD      = 5;
const DEFAULT_CIRCUIT_COOLDOWN_MS    = 60_000;

// ─── System prompt — the entire LLM safety + style contract ──────────────────

const SYSTEM_PROMPT = `You are Luna, a warm and supportive wellbeing companion inside Mindspace — a UK mental health tracker app. You are NOT a licensed therapist or medical professional, and you do NOT diagnose, prescribe, or replace professional care.

Your role:
- Acknowledge the user's feelings with warmth and validation.
- Offer brief reflections grounded in CBT (cognitive behavioural therapy) or ACT (acceptance and commitment therapy) techniques.
- When mood data or recent themes are provided in the context block, weave them in gently — never clinically.
- Keep responses concise: typically 80-150 words, never more than 200.
- Use British English ("behaviour", "favourite", "realise", "organise").
- Conversational tone — avoid bullet lists, numbered steps, or clinical jargon unless the user explicitly asks for an exercise.

You will not normally receive messages containing suicidal or self-harm content — those are routed to a dedicated safety layer before reaching you. If a user nonetheless escalates to crisis-level distress during your conversation (an edge case the safety layer may miss), STOP normal conversation and reply only with: "I'd like you to reach out to Samaritans on 116 123 — they're free and available 24/7. I'm here too while you do."

End each response in a way that invites the user to keep sharing if they wish, but never pressures them.`;

// ─── Internal helpers (cross-cutting concerns) ───────────────────────────────

/**
 * Per-user daily call cap. In-process only — multi-instance deployments
 * would need a shared store (Redis) for accuracy. Document this in Stage F.
 */
class InProcessRateLimiter {
  constructor(perUserDaily) {
    this.limit = perUserDaily;
    this.usage = new Map(); // userId → { date: 'YYYY-MM-DD', count: N }
  }

  check(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const entry = this.usage.get(userId);
    if (!entry || entry.date !== today) {
      this.usage.set(userId, { date: today, count: 1 });
      return { allowed: true, remaining: this.limit - 1 };
    }
    if (entry.count >= this.limit) {
      return { allowed: false, remaining: 0 };
    }
    entry.count += 1;
    return { allowed: true, remaining: this.limit - entry.count };
  }
}

/**
 * Simple circuit breaker. After N consecutive failures, trip "open" for a
 * cooldown window — every call short-circuits to an error during that window,
 * which LunaService catches and falls back to rule-based.
 */
class CircuitBreaker {
  constructor({ threshold = DEFAULT_CIRCUIT_THRESHOLD, cooldownMs = DEFAULT_CIRCUIT_COOLDOWN_MS } = {}) {
    this.threshold  = threshold;
    this.cooldownMs = cooldownMs;
    this.failures   = 0;
    this.openUntil  = 0;
  }

  isOpen() { return Date.now() < this.openUntil; }

  recordSuccess() {
    this.failures = 0;
    this.openUntil = 0;
  }

  recordFailure() {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openUntil = Date.now() + this.cooldownMs;
      this.failures = 0; // reset counter for the next cycle
    }
  }
}

/**
 * Monthly token-cost governor. Tracks input + output tokens per calendar month
 * and refuses calls once the cap is exceeded. Reset is automatic at month roll.
 */
class CostGovernor {
  constructor(monthlyTokenCap = DEFAULT_MONTHLY_TOKEN_CAP) {
    this.cap = monthlyTokenCap;
    this.usedThisMonth = 0;
    this.monthKey = '';
  }

  _currentMonth() { return new Date().toISOString().slice(0, 7); }

  _rolloverIfNeeded() {
    const month = this._currentMonth();
    if (month !== this.monthKey) {
      this.monthKey = month;
      this.usedThisMonth = 0;
    }
  }

  checkBudget() {
    this._rolloverIfNeeded();
    return this.usedThisMonth < this.cap;
  }

  record(inputTokens, outputTokens) {
    this._rolloverIfNeeded();
    this.usedThisMonth += (inputTokens || 0) + (outputTokens || 0);
  }
}

// ─── Main provider ───────────────────────────────────────────────────────────

/**
 * AnthropicResponseGenerator — LLM-backed Luna response generator.
 *
 * Wraps the Anthropic Messages API behind the ResponseGenerator contract.
 *
 * Safety / cost protections (all applied BEFORE the network call):
 *   1. Rate-limit per user per day
 *   2. Monthly token-cost cap
 *   3. Circuit breaker on consecutive failures
 *   4. SDK-level request timeout
 *
 * If any protection trips OR the API call fails, this provider throws. The
 * caller (LunaService.processMessage) catches the throw and falls back to
 * RuleBasedResponseGenerator — the user always gets a reply.
 *
 * Crisis detection is NOT this provider's job; the SafetyFilter runs first
 * inside LunaService and the LLM never sees crisis content.
 */
class AnthropicResponseGenerator extends ResponseGenerator {

  /**
   * @param {Object} [config]
   * @param {string} [config.apiKey]       defaults to ANTHROPIC_API_KEY env var
   * @param {Object} [config.client]       optional pre-built SDK client (used by tests)
   * @param {string} [config.model]        defaults to LUNA_LLM_MODEL env var or Haiku 4.5
   * @param {number} [config.maxTokens]
   * @param {number} [config.timeoutMs]
   * @param {InProcessRateLimiter} [config.rateLimiter]
   * @param {CircuitBreaker}       [config.circuit]
   * @param {CostGovernor}         [config.cost]
   */
  constructor(config = {}) {
    super();

    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'AnthropicResponseGenerator requires ANTHROPIC_API_KEY (env var or config.apiKey).'
      );
    }

    this.model      = config.model     || process.env.LUNA_LLM_MODEL      || DEFAULT_MODEL;
    this.maxTokens  = Number(config.maxTokens  || process.env.LUNA_LLM_MAX_TOKENS  || DEFAULT_MAX_TOKENS);
    this.timeoutMs  = Number(config.timeoutMs  || process.env.LUNA_LLM_TIMEOUT_MS  || DEFAULT_TIMEOUT_MS);

    if (config.client) {
      this.client = config.client;
    } else {
      // Lazy-required so tests don't need @anthropic-ai/sdk installed.
      // If the SDK isn't installed, this throws at construction time and the
      // factory catches it → falls back to rule-based.
      // eslint-disable-next-line global-require
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic({ apiKey, timeout: this.timeoutMs });
    }

    this._rateLimiter = config.rateLimiter || new InProcessRateLimiter(
      Number(process.env.LUNA_LLM_DAILY_LIMIT || DEFAULT_DAILY_LIMIT_PER_USER)
    );
    this._circuit = config.circuit || new CircuitBreaker({
      threshold:  Number(process.env.LUNA_LLM_CIRCUIT_THRESHOLD   || DEFAULT_CIRCUIT_THRESHOLD),
      cooldownMs: Number(process.env.LUNA_LLM_CIRCUIT_COOLDOWN_MS || DEFAULT_CIRCUIT_COOLDOWN_MS)
    });
    this._cost = config.cost || new CostGovernor(
      Number(process.env.LUNA_LLM_MONTHLY_TOKEN_CAP || DEFAULT_MONTHLY_TOKEN_CAP)
    );
  }

  get name() { return 'anthropic'; }

  /**
   * @param {import('./responseGenerator').ResponseGeneratorInput & {userId?: number|string}} input
   * @returns {Promise<string>}
   */
  async generate(input) {
    // === Pre-flight protections (cheap, no network) ===
    if (this._circuit.isOpen()) {
      throw new Error('LLM circuit breaker is open — fallback to rule-based');
    }
    if (!this._cost.checkBudget()) {
      throw new Error('LLM monthly token cap exceeded — fallback to rule-based');
    }
    const userId = input && input.userId;
    if (userId !== undefined && userId !== null) {
      const rl = this._rateLimiter.check(userId);
      if (!rl.allowed) {
        throw new Error(`LLM per-user daily limit exceeded (user ${userId})`);
      }
    }

    // === Build request ===
    const messages = this._buildMessages(input);

    // === Network call ===
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        system: SYSTEM_PROMPT,
        messages
      });

      const inputTokens  = (response && response.usage && response.usage.input_tokens)  || 0;
      const outputTokens = (response && response.usage && response.usage.output_tokens) || 0;
      this._cost.record(inputTokens, outputTokens);

      const block = response && response.content && response.content[0];
      const text  = block && block.text;
      if (!text || typeof text !== 'string') {
        throw new Error('Empty or malformed response from Anthropic');
      }

      this._circuit.recordSuccess();
      logger.info('LLM response generated', {
        userId, model: this.model, inputTokens, outputTokens
      });
      return text;
    } catch (err) {
      this._circuit.recordFailure();
      logger.warn('Anthropic call failed', { userId, error: err.message });
      throw err;
    }
  }

  /**
   * Build the Anthropic messages array from the orchestrator input.
   * The context block is omitted entirely when there is nothing useful
   * to share — keeps short greetings clean.
   *
   * @private
   */
  _buildMessages(input) {
    if (!input) return [{ role: 'user', content: '' }];
    const contextBlock = this._formatContext(input);
    const userText = input.message || '';
    return [{
      role: 'user',
      content: contextBlock
        ? `<context>\n${contextBlock}\n</context>\n\n${userText}`
        : userText
    }];
  }

  /**
   * Format the (small, structured) context block the LLM sees alongside
   * the user's actual message. Skips empty/uninformative fields.
   *
   * @private
   */
  _formatContext(input) {
    const parts = [];
    if (input.mood && input.mood !== 'unknown' && input.mood !== 'neutral') {
      parts.push(`detected mood: ${input.mood}`);
    }
    if (input.theme) {
      parts.push(`current theme: ${input.theme}`);
    }
    const trend = input.dataContext && input.dataContext.trendDirection;
    if (trend && trend !== 'stable' && trend !== 'insufficient_data' && trend !== 'unknown') {
      parts.push(`recent mood trend: ${trend}`);
    }
    const themes = input.sessionContext && input.sessionContext.keyThemes;
    if (Array.isArray(themes) && themes.length > 0) {
      parts.push(`prior session themes: ${themes.slice(0, 3).join(', ')}`);
    }
    if (input.technique && input.technique.technique_name) {
      parts.push(`suggested technique: ${input.technique.technique_name}`);
    }
    return parts.join('\n');
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = AnthropicResponseGenerator;
// Named exports for tests + future re-use.
module.exports.InProcessRateLimiter = InProcessRateLimiter;
module.exports.CircuitBreaker       = CircuitBreaker;
module.exports.CostGovernor         = CostGovernor;
module.exports.SYSTEM_PROMPT        = SYSTEM_PROMPT;
module.exports.DEFAULT_MODEL        = DEFAULT_MODEL;

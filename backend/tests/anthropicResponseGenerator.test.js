/**
 * Tests for AnthropicResponseGenerator.
 *
 * The SDK is injected via constructor, so these tests run without
 * @anthropic-ai/sdk being installed and without a real API key.
 */

const AnthropicResponseGenerator = require('../src/services/anthropicResponseGenerator');
const ResponseGenerator = require('../src/services/responseGenerator');

const makeMockClient = (responseOverride) => ({
  messages: {
    create: jest.fn().mockResolvedValue(responseOverride || {
      content: [{ type: 'text', text: 'I hear you. That sounds really hard.' }],
      usage:   { input_tokens: 100, output_tokens: 50 }
    })
  }
});

const makeGen = (overrides = {}) => new AnthropicResponseGenerator({
  apiKey: 'sk-ant-test',
  client: makeMockClient(),
  ...overrides
});

describe('AnthropicResponseGenerator', () => {

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('construction', () => {
    it('throws if no API key is available anywhere', () => {
      expect(() => new AnthropicResponseGenerator()).toThrow(/ANTHROPIC_API_KEY/);
    });

    it('accepts an explicit api key', () => {
      expect(() => new AnthropicResponseGenerator({ apiKey: 'sk-ant-test', client: makeMockClient() }))
        .not.toThrow();
    });

    it('accepts ANTHROPIC_API_KEY from the environment', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-env';
      expect(() => new AnthropicResponseGenerator({ client: makeMockClient() })).not.toThrow();
    });

    it('extends ResponseGenerator', () => {
      expect(makeGen()).toBeInstanceOf(ResponseGenerator);
    });

    it('reports name as "anthropic"', () => {
      expect(makeGen().name).toBe('anthropic');
    });

    it('defaults to Claude Haiku 4.5', () => {
      const gen = makeGen();
      expect(gen.model).toBe('claude-haiku-4-5-20251001');
    });
  });

  describe('generate() — SDK call shape', () => {
    it('passes model, max_tokens, system prompt and messages to the SDK', async () => {
      const client = makeMockClient();
      const gen = new AnthropicResponseGenerator({
        apiKey: 'sk-ant-test', client, model: 'test-model', maxTokens: 200
      });
      await gen.generate({ userId: 1, message: 'hi' });

      expect(client.messages.create).toHaveBeenCalledTimes(1);
      const call = client.messages.create.mock.calls[0][0];
      expect(call.model).toBe('test-model');
      expect(call.max_tokens).toBe(200);
      expect(call.system).toMatch(/Luna/);
      expect(call.system).toMatch(/British English/);
      expect(call.system).toMatch(/Samaritans/);
      expect(Array.isArray(call.messages)).toBe(true);
      expect(call.messages[0].role).toBe('user');
    });

    it('returns the SDK response text', async () => {
      const gen = makeGen();
      const result = await gen.generate({ userId: 1, message: 'hi' });
      expect(result).toBe('I hear you. That sounds really hard.');
    });

    it('throws on empty SDK response', async () => {
      const client = { messages: { create: jest.fn().mockResolvedValue({ content: [{ text: '' }], usage: {} }) } };
      const gen = new AnthropicResponseGenerator({ apiKey: 'sk-ant-test', client });
      await expect(gen.generate({ userId: 1, message: 'hi' })).rejects.toThrow(/Empty/);
    });

    it('throws on malformed SDK response', async () => {
      const client = { messages: { create: jest.fn().mockResolvedValue({ content: [] }) } };
      const gen = new AnthropicResponseGenerator({ apiKey: 'sk-ant-test', client });
      await expect(gen.generate({ userId: 1, message: 'hi' })).rejects.toThrow();
    });
  });

  describe('generate() — context block construction', () => {
    it('includes a context block when meaningful fields are present', async () => {
      const client = makeMockClient();
      const gen = new AnthropicResponseGenerator({ apiKey: 'sk-ant-test', client });
      await gen.generate({
        userId: 1,
        message: 'work is awful',
        mood: 'anxious',
        theme: 'work stress',
        sessionContext: { keyThemes: ['deadlines', 'sleep', 'family'] },
        dataContext: { trendDirection: 'declining' },
        technique: { technique_name: 'CBT Thought Challenging' }
      });
      const userContent = client.messages.create.mock.calls[0][0].messages[0].content;
      expect(userContent).toMatch(/<context>/);
      expect(userContent).toMatch(/mood: anxious/);
      expect(userContent).toMatch(/work stress/);
      expect(userContent).toMatch(/declining/);
      expect(userContent).toMatch(/deadlines, sleep, family/);
      expect(userContent).toMatch(/CBT Thought Challenging/);
      expect(userContent).toMatch(/<\/context>/);
      expect(userContent).toMatch(/work is awful$/);
    });

    it('omits the context block when nothing meaningful is set', async () => {
      const client = makeMockClient();
      const gen = new AnthropicResponseGenerator({ apiKey: 'sk-ant-test', client });
      await gen.generate({ userId: 1, message: 'hello' });
      const userContent = client.messages.create.mock.calls[0][0].messages[0].content;
      expect(userContent).not.toMatch(/<context>/);
      expect(userContent).toBe('hello');
    });

    it('does not include neutral/unknown mood in the context block', async () => {
      const client = makeMockClient();
      const gen = new AnthropicResponseGenerator({ apiKey: 'sk-ant-test', client });
      await gen.generate({
        userId: 1, message: 'hi', mood: 'neutral',
        dataContext: { trendDirection: 'stable' }
      });
      const userContent = client.messages.create.mock.calls[0][0].messages[0].content;
      expect(userContent).not.toMatch(/<context>/);
    });
  });

  describe('rate limiter', () => {
    const { InProcessRateLimiter } = AnthropicResponseGenerator;

    it('enforces per-user daily limit', async () => {
      const limiter = new InProcessRateLimiter(2);
      const gen = new AnthropicResponseGenerator({
        apiKey: 'sk-ant-test', client: makeMockClient(), rateLimiter: limiter
      });
      await gen.generate({ userId: 1, message: 'a' });
      await gen.generate({ userId: 1, message: 'b' });
      await expect(gen.generate({ userId: 1, message: 'c' })).rejects.toThrow(/limit exceeded/i);
    });

    it('tracks per-user counters independently', async () => {
      const limiter = new InProcessRateLimiter(1);
      const gen = new AnthropicResponseGenerator({
        apiKey: 'sk-ant-test', client: makeMockClient(), rateLimiter: limiter
      });
      await gen.generate({ userId: 1, message: 'a' });
      await expect(gen.generate({ userId: 2, message: 'b' })).resolves.toBeDefined();
    });

    it('skips the limiter when no userId is provided', async () => {
      const limiter = new InProcessRateLimiter(0); // would block everyone
      const gen = new AnthropicResponseGenerator({
        apiKey: 'sk-ant-test', client: makeMockClient(), rateLimiter: limiter
      });
      // userId undefined → bypasses rate limit
      await expect(gen.generate({ message: 'anonymous' })).resolves.toBeDefined();
    });
  });

  describe('circuit breaker', () => {
    const { CircuitBreaker } = AnthropicResponseGenerator;

    it('opens after the configured number of consecutive failures', async () => {
      const circuit = new CircuitBreaker({ threshold: 2, cooldownMs: 60_000 });
      const failingClient = { messages: { create: jest.fn().mockRejectedValue(new Error('boom')) } };
      const gen = new AnthropicResponseGenerator({
        apiKey: 'sk-ant-test', client: failingClient, circuit
      });
      await expect(gen.generate({ userId: 1, message: 'a' })).rejects.toThrow('boom');
      await expect(gen.generate({ userId: 1, message: 'b' })).rejects.toThrow('boom');
      // 2 failures → circuit open; next call short-circuits
      await expect(gen.generate({ userId: 1, message: 'c' })).rejects.toThrow(/circuit/i);
      expect(failingClient.messages.create).toHaveBeenCalledTimes(2); // 3rd never hit network
    });

    it('a single success resets the failure counter', async () => {
      const circuit = new CircuitBreaker({ threshold: 2, cooldownMs: 60_000 });
      let shouldFail = true;
      const client = { messages: { create: jest.fn(() => shouldFail
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ content: [{ text: 'ok' }], usage: { input_tokens: 1, output_tokens: 1 } })
      ) } };
      const gen = new AnthropicResponseGenerator({
        apiKey: 'sk-ant-test', client, circuit
      });
      await expect(gen.generate({ userId: 1, message: 'a' })).rejects.toThrow('boom');
      shouldFail = false;
      await expect(gen.generate({ userId: 1, message: 'b' })).resolves.toBe('ok');
      shouldFail = true;
      // counter was reset on success; another single failure should NOT open circuit
      await expect(gen.generate({ userId: 1, message: 'c' })).rejects.toThrow('boom');
      // would only open on the next failure
      await expect(gen.generate({ userId: 1, message: 'd' })).rejects.toThrow(/boom|circuit/);
    });
  });

  describe('cost governor', () => {
    const { CostGovernor } = AnthropicResponseGenerator;

    it('blocks calls once the monthly token cap is exceeded', async () => {
      const cost = new CostGovernor(50);
      const client = makeMockClient({
        content: [{ text: 'reply' }],
        usage: { input_tokens: 30, output_tokens: 30 }
      });
      const gen = new AnthropicResponseGenerator({
        apiKey: 'sk-ant-test', client, cost
      });
      await gen.generate({ userId: 1, message: 'a' }); // 60 tokens used, now > 50
      await expect(gen.generate({ userId: 1, message: 'b' })).rejects.toThrow(/cap exceeded/i);
    });
  });

  describe('exports', () => {
    it('exposes inner helper classes for testing and re-use', () => {
      expect(AnthropicResponseGenerator.InProcessRateLimiter).toBeDefined();
      expect(AnthropicResponseGenerator.CircuitBreaker).toBeDefined();
      expect(AnthropicResponseGenerator.CostGovernor).toBeDefined();
      expect(AnthropicResponseGenerator.SYSTEM_PROMPT).toMatch(/Luna/);
      expect(AnthropicResponseGenerator.DEFAULT_MODEL).toBe('claude-haiku-4-5-20251001');
    });
  });
});

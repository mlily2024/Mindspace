/**
 * Tests for responseGeneratorFactory — provider selection contract.
 */

const {
  getProvider,
  resetProvider,
  SUPPORTED_PROVIDERS
} = require('../src/services/responseGeneratorFactory');
const RuleBasedResponseGenerator = require('../src/services/ruleBasedResponseGenerator');

describe('responseGeneratorFactory', () => {

  beforeEach(() => {
    resetProvider();
    delete process.env.LUNA_PROVIDER;
  });

  describe('selection', () => {
    it('defaults to rule_based when no config is provided', () => {
      const p = getProvider();
      expect(p).toBeInstanceOf(RuleBasedResponseGenerator);
      expect(p.name).toBe('rule_based');
    });

    it('respects LUNA_PROVIDER=rule_based', () => {
      process.env.LUNA_PROVIDER = 'rule_based';
      const p = getProvider();
      expect(p.name).toBe('rule_based');
    });

    it('falls back to rule_based on an unknown provider name (typo-proof)', () => {
      process.env.LUNA_PROVIDER = 'gemini_42';
      const p = getProvider();
      expect(p.name).toBe('rule_based');
    });

    it('explicit providerName argument wins over the env var', () => {
      process.env.LUNA_PROVIDER = 'unknown';
      const p = getProvider({ providerName: 'rule_based' });
      expect(p.name).toBe('rule_based');
    });
  });

  describe('caching', () => {
    it('caches the provider across repeated calls', () => {
      const p1 = getProvider();
      const p2 = getProvider();
      expect(p1).toBe(p2);
    });

    it('{ refresh: true } returns a new instance', () => {
      const p1 = getProvider();
      const p2 = getProvider({ refresh: true });
      expect(p1).not.toBe(p2);
      expect(p2.name).toBe('rule_based');
    });

    it('resetProvider() drops the cache (for test isolation)', () => {
      const p1 = getProvider();
      resetProvider();
      const p2 = getProvider();
      expect(p1).not.toBe(p2);
    });
  });

  describe('exports', () => {
    it('SUPPORTED_PROVIDERS is a frozen array containing the registered providers', () => {
      expect(Array.isArray(SUPPORTED_PROVIDERS)).toBe(true);
      expect(Object.isFrozen(SUPPORTED_PROVIDERS)).toBe(true);
      expect(SUPPORTED_PROVIDERS).toContain('rule_based');
      expect(SUPPORTED_PROVIDERS).toContain('anthropic');
    });
  });

  describe('anthropic provider — graceful degradation', () => {
    it('falls back to rule_based when LUNA_PROVIDER=anthropic but ANTHROPIC_API_KEY is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.LUNA_PROVIDER = 'anthropic';
      const p = getProvider();
      // Construction of AnthropicResponseGenerator throws when the key is
      // missing; the factory catches and degrades gracefully.
      expect(p.name).toBe('rule_based');
    });
  });
});

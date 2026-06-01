/**
 * Tests for RuleBasedResponseGenerator.
 *
 * Behaviour-preservation tests for the rule-based response logic that
 * was extracted out of LunaService in Stage B. Each block matches a
 * branch of the original `_buildResponse`.
 */

const RuleBasedResponseGenerator = require('../src/services/ruleBasedResponseGenerator');
const ResponseGenerator = require('../src/services/responseGenerator');

const makeInput = (overrides = {}) => ({
  message: 'x',
  mood: 'neutral',
  theme: null,
  sessionContext: { keyThemes: [] },
  dataContext: { trendDirection: 'stable' },
  technique: null,
  ...overrides
});

describe('RuleBasedResponseGenerator', () => {

  describe('inheritance + identity', () => {
    it('extends the ResponseGenerator base contract', () => {
      const gen = new RuleBasedResponseGenerator();
      expect(gen).toBeInstanceOf(ResponseGenerator);
    });

    it('exposes the provider name "rule_based"', () => {
      const gen = new RuleBasedResponseGenerator();
      expect(gen.name).toBe('rule_based');
    });
  });

  describe('generate() — empathy opening', () => {
    it('opens warmly for moods in the broad positive set', async () => {
      const gen = new RuleBasedResponseGenerator();
      for (const mood of ['happy', 'good', 'great', 'calm', 'grateful', 'hopeful', 'peaceful', 'better']) {
        const r = await gen.generate(makeInput({ mood }));
        expect(r).toMatch(/glad you're in that space/);
      }
    });

    it('opens supportively for negative moods', async () => {
      const gen = new RuleBasedResponseGenerator();
      for (const mood of ['sad', 'anxious', 'angry', 'lonely', 'stressed', 'tired']) {
        const r = await gen.generate(makeInput({ mood }));
        expect(r).toMatch(/I hear you/);
      }
    });

    it('opens neutrally for neutral/unknown/missing mood', async () => {
      const gen = new RuleBasedResponseGenerator();
      for (const mood of ['neutral', 'unknown', undefined, null, '']) {
        const r = await gen.generate(makeInput({ mood }));
        expect(r).toMatch(/Thank you for sharing/);
      }
    });
  });

  describe('generate() — trend-aware observation', () => {
    it('mentions the upward trend for non-strongly-positive moods', async () => {
      const gen = new RuleBasedResponseGenerator();
      const r = await gen.generate(makeInput({
        mood: 'sad',
        dataContext: { trendDirection: 'improving' }
      }));
      expect(r).toMatch(/trending upward/);
    });

    it('SUPPRESSES the upward-trend observation when mood is strongly positive', async () => {
      const gen = new RuleBasedResponseGenerator();
      for (const mood of ['happy', 'good', 'great', 'positive']) {
        const r = await gen.generate(makeInput({
          mood,
          dataContext: { trendDirection: 'improving' }
        }));
        expect(r).not.toMatch(/trending upward/);
      }
    });

    it('still mentions trend for milder positives like "calm" or "hopeful"', async () => {
      // (Subtle: broader positive set triggers warm opening, but only NARROW
      // strongly-positive moods suppress the trend message — see original.)
      const gen = new RuleBasedResponseGenerator();
      const r = await gen.generate(makeInput({
        mood: 'calm',
        dataContext: { trendDirection: 'improving' }
      }));
      expect(r).toMatch(/trending upward/);
    });

    it('mentions the declining trend', async () => {
      const gen = new RuleBasedResponseGenerator();
      const r = await gen.generate(makeInput({
        mood: 'sad',
        dataContext: { trendDirection: 'declining' }
      }));
      expect(r).toMatch(/dipping/);
    });

    it('says nothing trend-y when the trend is stable/unknown', async () => {
      const gen = new RuleBasedResponseGenerator();
      const r = await gen.generate(makeInput({
        mood: 'sad',
        dataContext: { trendDirection: 'stable' }
      }));
      expect(r).not.toMatch(/trending|dipping/);
    });
  });

  describe('generate() — session continuity', () => {
    it('references the most-recent prior theme', async () => {
      const gen = new RuleBasedResponseGenerator();
      const r = await gen.generate(makeInput({
        sessionContext: { keyThemes: ['work stress', 'sleep difficulties'] }
      }));
      expect(r).toMatch(/work stress/);
      expect(r).not.toMatch(/sleep difficulties/); // only the freshest one
    });

    it('skips the continuity bridge if there is no theme history', async () => {
      const gen = new RuleBasedResponseGenerator();
      const r = await gen.generate(makeInput({ sessionContext: { keyThemes: [] } }));
      expect(r).not.toMatch(/Last time, we touched on/);
    });
  });

  describe('generate() — technique suggestion', () => {
    it('appends the strategy text when a technique is provided', async () => {
      const gen = new RuleBasedResponseGenerator();
      const technique = {
        technique_type: 'cbt_thought_challenge',
        technique_name: 'CBT',
        strategy: { template: (theme) => `[STRATEGY for ${theme}]` }
      };
      const r = await gen.generate(makeInput({
        mood: 'sad',
        theme: 'work stress',
        technique
      }));
      expect(r).toMatch(/STRATEGY for work stress/);
    });

    it('uses the fallback theme text when theme is null', async () => {
      const gen = new RuleBasedResponseGenerator();
      const technique = { strategy: { template: (theme) => `[for ${theme}]` } };
      const r = await gen.generate(makeInput({ mood: 'sad', theme: null, technique }));
      expect(r).toMatch(/for what you're experiencing/);
    });

    it('safely ignores a malformed technique (no .strategy or no .template)', async () => {
      const gen = new RuleBasedResponseGenerator();
      const r1 = await gen.generate(makeInput({ mood: 'sad', technique: {} }));
      const r2 = await gen.generate(makeInput({ mood: 'sad', technique: { strategy: {} } }));
      expect(typeof r1).toBe('string');
      expect(typeof r2).toBe('string');
      // Should still produce the opening; no crash.
      expect(r1).toMatch(/I hear you/);
    });
  });

  describe('generate() — robustness', () => {
    it('handles a completely empty input object without throwing', async () => {
      const gen = new RuleBasedResponseGenerator();
      const r = await gen.generate({});
      expect(typeof r).toBe('string');
      expect(r.length).toBeGreaterThan(0);
    });

    it('handles null input by defaulting cleanly', async () => {
      const gen = new RuleBasedResponseGenerator();
      const r = await gen.generate(null);
      expect(typeof r).toBe('string');
    });

    it('truncates excessively long responses to ~MAX_WORDS', async () => {
      const gen = new RuleBasedResponseGenerator();
      const technique = { strategy: { template: () => 'word '.repeat(500) } };
      const r = await gen.generate(makeInput({ mood: 'sad', technique }));
      // 200 words + '...' ⇒ split by whitespace gives 201 tokens max
      expect(r.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(201);
      expect(r.endsWith('...')).toBe(true);
    });
  });
});

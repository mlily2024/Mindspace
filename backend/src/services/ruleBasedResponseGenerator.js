const ResponseGenerator = require('./responseGenerator');

// Broader positive-mood set — triggers the warm empathy opening.
const POSITIVE_MOODS_BROAD = new Set([
  'happy', 'good', 'great', 'excited', 'proud', 'positive',
  'calm', 'grateful', 'hopeful', 'peaceful', 'better'
]);

// Narrower strongly-positive set — suppresses the "trending upward"
// observation (no point telling someone clearly happy that they're
// trending upward; do tell someone calm/hopeful, as it reinforces).
const POSITIVE_MOODS_NARROW = new Set([
  'happy', 'good', 'great', 'positive'
]);

const MAX_WORDS = 200;
const FALLBACK_THEME = "what you're experiencing";

/**
 * RuleBasedResponseGenerator — the template-based Luna response generator.
 *
 * Composes a response from up to four parts:
 *   1. An empathetic opening based on detected mood.
 *   2. (optional) A data-informed observation if the user's mood trend is notable.
 *   3. (optional) Continuity from a previous session theme.
 *   4. (optional) A therapeutic technique suggestion based on the recommended strategy.
 *
 * Output is truncated to ~200 words to keep the chat readable.
 *
 * Zero external dependencies — runs offline, no network, no cost. Used as the
 * default provider and as the fallback when a network-backed provider fails.
 */
class RuleBasedResponseGenerator extends ResponseGenerator {

  get name() { return 'rule_based'; }

  /**
   * @param {import('./responseGenerator').ResponseGeneratorInput} input
   * @returns {Promise<string>}
   */
  async generate(input) {
    const { mood, theme, sessionContext, dataContext, technique } = input || {};
    const parts = [];

    // 1. Empathetic opening
    if (!mood || mood === 'neutral' || mood === 'unknown') {
      parts.push("Thank you for sharing. I'm here and listening.");
    } else if (POSITIVE_MOODS_BROAD.has(mood)) {
      parts.push("It's really good to hear that. I'm glad you're in that space right now.");
    } else {
      parts.push("I hear you, and I'm sorry you're going through this. What you're feeling is real and it matters.");
    }

    // 2. Data-informed observation (only if we have a meaningful trend)
    const trend = dataContext && dataContext.trendDirection;
    if (trend === 'improving' && !POSITIVE_MOODS_NARROW.has(mood)) {
      parts.push("I also want you to know that looking at your recent data, things have been gradually trending upward, even if today feels hard.");
    } else if (trend === 'declining') {
      parts.push("I've noticed your mood has been dipping over the past couple of weeks. That takes courage to sit with, and it's exactly why checking in matters.");
    }

    // 3. Continuity from previous sessions
    const themes = sessionContext && sessionContext.keyThemes;
    if (Array.isArray(themes) && themes.length > 0) {
      parts.push(`Last time, we touched on "${themes[0]}." Would you like to pick that thread back up, or is something else more present for you today?`);
    }

    // 4. Technique suggestion (the most substantive part of the response)
    if (technique && technique.strategy && typeof technique.strategy.template === 'function') {
      const themeOrFallback = theme || FALLBACK_THEME;
      parts.push(technique.strategy.template(themeOrFallback));
    }

    // Combine and trim to ~MAX_WORDS words
    let response = parts.join(' ');
    const words = response.split(/\s+/);
    if (words.length > MAX_WORDS) {
      response = words.slice(0, MAX_WORDS).join(' ') + '...';
    }
    return response;
  }
}

module.exports = RuleBasedResponseGenerator;

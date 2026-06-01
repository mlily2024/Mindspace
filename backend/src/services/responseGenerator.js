/**
 * ResponseGenerator — abstract base contract for Luna response generators.
 *
 * Concrete implementations:
 *   - RuleBasedResponseGenerator   (Stage B): template-based, offline, zero cost.
 *   - AnthropicResponseGenerator   (Stage C, planned): LLM-backed.
 *
 * Contract:
 *   - generate(input) returns a Promise<string> (the response text).
 *   - Implementations are called AFTER the SafetyFilter has cleared the
 *     message; they are NOT responsible for crisis detection and never
 *     run on crisis messages.
 *   - Implementations must tolerate any field of `input` being null /
 *     missing — a brand-new user has no context yet.
 *
 * @typedef {Object} ResponseGeneratorInput
 * @property {string}      message         user's raw message
 * @property {string}      mood            sentiment label (e.g. 'sad', 'anxious', 'neutral')
 * @property {string|null} theme           pre-extracted theme (e.g. 'work stress') or null
 * @property {Object}      sessionContext  { lastSessionSummary, lastSessionDate, keyThemes, recentMood }
 * @property {Object}      dataContext     { recentEntries, trendDirection, averageMood, sleepCorrelation, identifiedPatterns }
 * @property {Object|null} technique       { technique_type, technique_name, effectiveness_score, source, strategy }
 */

class ResponseGenerator {
  /**
   * Generate a response string for the given input.
   * @param {ResponseGeneratorInput} input
   * @returns {Promise<string>}
   */
  // eslint-disable-next-line no-unused-vars
  async generate(input) {
    throw new Error('ResponseGenerator.generate() must be implemented by a subclass');
  }

  /**
   * Identifier for this provider (used for logging + config).
   * @returns {string}
   */
  get name() {
    throw new Error('ResponseGenerator.name must be implemented by a subclass');
  }
}

module.exports = ResponseGenerator;

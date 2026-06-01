const logger = require('../config/logger');
const RuleBasedResponseGenerator = require('./ruleBasedResponseGenerator');
// Stage C will add:
//   const AnthropicResponseGenerator = require('./anthropicResponseGenerator');

/**
 * The list of provider names this factory knows how to construct.
 * Anything outside this list logs a warning and falls back to rule_based.
 */
const SUPPORTED_PROVIDERS = Object.freeze(['rule_based', 'anthropic']);

let cachedProvider = null;

/**
 * Resolve which response generator to use, in priority order:
 *   1. an explicit `providerName` argument (tests / future per-user opt-in)
 *   2. the LUNA_PROVIDER environment variable
 *   3. the default 'rule_based'
 *
 * Unknown values log a warning and fall back to rule_based, so a typo in
 * config can never break the chat.
 *
 * Result is cached per process; pass `{ refresh: true }` to force re-creation
 * (useful in tests or after a config reload).
 *
 * @param {Object} [opts]
 * @param {string|null} [opts.providerName]
 * @param {boolean} [opts.refresh]
 * @returns {import('./responseGenerator')}
 */
const getProvider = (opts = {}) => {
  if (cachedProvider && !opts.refresh) return cachedProvider;

  const requested = opts.providerName || process.env.LUNA_PROVIDER || 'rule_based';

  if (!SUPPORTED_PROVIDERS.includes(requested)) {
    logger.warn(
      `Unknown LUNA_PROVIDER "${requested}" — falling back to rule_based. ` +
      `Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}.`
    );
    cachedProvider = new RuleBasedResponseGenerator();
    return cachedProvider;
  }

  switch (requested) {
    case 'anthropic': {
      try {
        // eslint-disable-next-line global-require
        const AnthropicResponseGenerator = require('./anthropicResponseGenerator');
        cachedProvider = new AnthropicResponseGenerator();
      } catch (err) {
        logger.error(
          'Failed to initialise Anthropic provider; falling back to rule_based. ' +
          'Likely causes: missing ANTHROPIC_API_KEY, or @anthropic-ai/sdk not installed.',
          { error: err.message }
        );
        cachedProvider = new RuleBasedResponseGenerator();
      }
      break;
    }
    case 'rule_based':
    default:
      cachedProvider = new RuleBasedResponseGenerator();
  }

  logger.info(`Luna response provider selected: ${cachedProvider.name}`);
  return cachedProvider;
};

/**
 * Reset the cached provider — for test isolation. Not used in production code.
 */
const resetProvider = () => { cachedProvider = null; };

module.exports = {
  getProvider,
  resetProvider,
  SUPPORTED_PROVIDERS
};

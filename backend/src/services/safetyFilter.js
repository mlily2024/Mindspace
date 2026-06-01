/**
 * SafetyFilter — UK-localised crisis detection and response.
 *
 * Used by Luna response paths to ensure crisis content is detected and
 * responded to identically, regardless of which response generator
 * (rule-based, LLM-backed) produces the rest of the conversation.
 *
 * Design properties:
 *   - Detection is synchronous and makes no network call, so this
 *     layer cannot be bypassed by an LLM outage or a slow response.
 *   - The response references UK crisis services only (Samaritans,
 *     Shout, NHS 111, Papyrus, 999) — never US numbers.
 *   - The keyword list and resource registry are exported as frozen
 *     constants so unit tests (and future audits) can assert the
 *     safety contract from the outside.
 */

const UK_CRISIS_RESOURCES = Object.freeze({
  samaritans: Object.freeze({
    name:  'Samaritans',
    phone: '116 123',
    note:  'free, 24/7'
  }),
  shout: Object.freeze({
    name: 'Shout Crisis Text Line',
    sms:  'text SHOUT to 85258'
  }),
  nhs: Object.freeze({
    name:  'NHS Mental Health Crisis Line',
    phone: '111',
    note:  'press 2 for mental health support'
  }),
  papyrus: Object.freeze({
    name:  'Papyrus HOPELINE247',
    phone: '0800 068 4141',
    note:  'under 35s'
  }),
  emergency: Object.freeze({
    name:  'Emergency services',
    phone: '999',
    note:  'if you are in immediate danger'
  })
});

const UK_CRISIS_KEYWORDS = Object.freeze([
  // Direct suicidal ideation
  'suicide', 'suicidal',
  'kill myself', 'end my life', 'end it all',
  'want to die', "don't want to live", 'no reason to live',
  'better off dead', "can't go on", 'give up on life',
  // Self-harm
  'self-harm', 'self harm',
  'cut myself', 'cutting', 'hurt myself',
  'overdose',
  // Closure language
  'ending it', 'final goodbye'
]);

/**
 * Detect whether a message contains crisis language.
 *
 * Pure, synchronous, network-free — safe to call on every message
 * before any LLM dispatch. Returns false for non-string/empty input
 * rather than throwing, so the safety check can never itself crash
 * the chat handler.
 *
 * @param {string} message
 * @returns {boolean}
 */
const detect = (message) => {
  if (typeof message !== 'string' || message.length === 0) return false;
  const lower = message.toLowerCase();
  return UK_CRISIS_KEYWORDS.some(keyword => lower.includes(keyword));
};

/**
 * Build the UK-localised crisis response.
 *
 * Returns a markdown-formatted string suitable for chat rendering.
 *
 * @returns {string}
 */
const buildResponse = () => {
  const R = UK_CRISIS_RESOURCES;
  const lines = [
    "I'm really concerned about what you've shared, and I want you to know that you matter. You're not alone in this.",
    '',
    'Please reach out to one of these UK services — they have people trained to help with exactly this:',
    '',
    `- **${R.samaritans.name}** — ${R.samaritans.phone} (${R.samaritans.note})`,
    `- **${R.shout.name}** — ${R.shout.sms}`,
    `- **${R.nhs.name}** — ${R.nhs.phone} (${R.nhs.note})`,
    `- **${R.papyrus.name}** — ${R.papyrus.phone} (${R.papyrus.note})`,
    `- **${R.emergency.name}** — ${R.emergency.phone} (${R.emergency.note})`,
    '',
    "I'm here with you. Would you like to stay and talk while you decide which to reach out to?"
  ];
  return lines.join('\n');
};

module.exports = {
  UK_CRISIS_KEYWORDS,
  UK_CRISIS_RESOURCES,
  detect,
  buildResponse
};

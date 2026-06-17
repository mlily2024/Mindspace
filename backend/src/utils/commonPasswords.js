/**
 * Top common passwords blocklist — Phase ADR-0010 (2026-06-17).
 *
 * Used by the register-route validator to refuse the most commonly
 * leaked / lazily-chosen passwords. NIST SP 800-63B §5.1.1.2 (2017+)
 * recommends "memorized secret verifiers SHALL compare the prospective
 * secrets against a list that contains values known to be commonly-used,
 * expected, or compromised."
 *
 * Source: aggregated from
 *   - SecLists' 10k-most-common (top 50 only)
 *   - Have I Been Pwned's most-leaked count
 *   - app-specific obvious patterns (`mindspace`, `mindspace123`)
 *
 * Keep the list short (≤100 entries) — bot attacks hit the long tail
 * via dictionary attacks, not the top of a leaked-list. This is the
 * "block the lazy" tier; targeted attacks need other mitigations
 * (rate-limiting on /login, MFA, etc.).
 *
 * Comparison is lowercase only — `Password` and `password` are the same
 * lazy choice; uppercasing the first letter does not improve entropy
 * meaningfully.
 */

const COMMON_PASSWORDS = new Set([
  // Top global leaked-counts (HIBP + SecLists)
  '12345678', '123456789', '1234567890', '11111111', '00000000',
  'password', 'passw0rd', 'password1', 'password123', 'p@ssword',
  'qwerty', 'qwerty123', 'qwertyuiop', 'qwerty1234', 'asdfghjkl',
  'abc12345', 'iloveyou', 'letmein', 'welcome1', 'welcome123',
  'admin123', 'administrator', 'root1234', 'changeme', 'default1',
  'monkey123', 'dragon12', 'master123', 'sunshine', 'princess',
  'football', 'baseball', 'superman', 'batman123', 'starwars',
  'trustno1', 'whatever', 'shadow12', 'tigger12', 'computer',
  // English keyboard patterns
  '1q2w3e4r', '1qaz2wsx', 'zaq12wsx', 'q1w2e3r4', 'asdf1234',
  // Year-based lazy choices (will roll forward as years pass)
  'password2024', 'password2025', 'password2026',
  '2024aaaa', '2025aaaa', '2026aaaa',
  // App-name specific
  'mindspace', 'mindspace1', 'mindspace123', 'demo1234'
]);

/**
 * True when the (case-insensitive) value matches a common-password entry.
 * @param {string} candidate
 * @returns {boolean}
 */
const isCommonPassword = (candidate) => {
  if (typeof candidate !== 'string') return false;
  return COMMON_PASSWORDS.has(candidate.toLowerCase());
};

module.exports = { COMMON_PASSWORDS, isCommonPassword };

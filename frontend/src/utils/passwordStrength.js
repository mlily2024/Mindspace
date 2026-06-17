/**
 * Password strength evaluator + common-password gate, frontend half of
 * ADR-0010 (NIST 800-63B alignment). The backend has the authoritative
 * blocklist (`backend/src/utils/commonPasswords.js`); this file is the
 * UX hint that surfaces the same conclusion live as the user types.
 *
 * Strength heuristic — coarse but honest:
 *   1. < 8 chars        → 'too-short'   (also rejected client-side)
 *   2. common password  → 'common'      (rejected client-side; backend will too)
 *   3. 8-11 chars with 1 character class  → 'weak'
 *   4. 8-11 chars with 2+ character classes → 'medium'
 *   5. 12-15 chars (any classes)          → 'strong'
 *   6. 16+ chars (any classes)            → 'very-strong'
 *
 * NIST 2017+ guidance: length beats complexity. A 16-char lowercase
 * passphrase outranks an 8-char `Pa55w0rd!`. We mirror that here.
 */

// Mirror of the backend blocklist. Kept short — bots hit the top of the
// leaked-list, not the long tail. Sync with backend if you add entries
// there. Comparison is lowercase.
const COMMON_PASSWORDS_FE = new Set([
  '12345678', '123456789', '1234567890', '11111111', '00000000',
  'password', 'passw0rd', 'password1', 'password123', 'p@ssword',
  'qwerty', 'qwerty123', 'qwertyuiop', 'qwerty1234', 'asdfghjkl',
  'abc12345', 'iloveyou', 'letmein', 'welcome1', 'welcome123',
  'admin123', 'administrator', 'root1234', 'changeme', 'default1',
  'monkey123', 'dragon12', 'master123', 'sunshine', 'princess',
  'football', 'baseball', 'superman', 'batman123', 'starwars',
  'trustno1', 'whatever', 'shadow12', 'tigger12', 'computer',
  '1q2w3e4r', '1qaz2wsx', 'zaq12wsx', 'q1w2e3r4', 'asdf1234',
  'password2024', 'password2025', 'password2026',
  '2024aaaa', '2025aaaa', '2026aaaa',
  'mindspace', 'mindspace1', 'mindspace123', 'demo1234'
]);

const isCommonPasswordClient = (value) =>
  typeof value === 'string' && COMMON_PASSWORDS_FE.has(value.toLowerCase());

/**
 * Count character classes used in the password — lowercase, uppercase,
 * digits, symbols. Each present class adds variety; with NIST-style
 * length-over-complexity scoring we only use this to discriminate weak
 * vs medium in the 8-11 char band.
 */
const countCharClasses = (value) => {
  let n = 0;
  if (/[a-z]/.test(value)) n += 1;
  if (/[A-Z]/.test(value)) n += 1;
  if (/[0-9]/.test(value)) n += 1;
  if (/[^a-zA-Z0-9]/.test(value)) n += 1;
  return n;
};

/**
 * Evaluate a password and return a structured result. The component
 * decides how to render — bar colors, labels, sub-text.
 *
 * @param {string} password
 * @returns {{ tier: string, label: string, bars: number, blocking: boolean, hint: string }}
 */
export const evaluatePassword = (password) => {
  const value = typeof password === 'string' ? password : '';
  if (value.length === 0) {
    return { tier: 'empty', label: '', bars: 0, blocking: false, hint: '' };
  }
  if (value.length < 8) {
    return {
      tier: 'too-short',
      label: 'Too short',
      bars: 0,
      blocking: true,
      hint: `Use ${8 - value.length} more character${8 - value.length === 1 ? '' : 's'}.`
    };
  }
  if (isCommonPasswordClient(value)) {
    return {
      tier: 'common',
      label: 'Too common',
      bars: 0,
      blocking: true,
      hint: 'This password appears on lists of the most commonly leaked passwords.'
    };
  }
  if (value.length >= 16) {
    return {
      tier: 'very-strong',
      label: 'Very strong',
      bars: 4,
      blocking: false,
      hint: ''
    };
  }
  if (value.length >= 12) {
    return {
      tier: 'strong',
      label: 'Strong',
      bars: 3,
      blocking: false,
      hint: ''
    };
  }
  const classes = countCharClasses(value);
  if (classes >= 2) {
    return {
      tier: 'medium',
      label: 'OK',
      bars: 2,
      blocking: false,
      hint: 'Long passphrases (12+ characters) are even safer.'
    };
  }
  return {
    tier: 'weak',
    label: 'Weak',
    bars: 1,
    blocking: false,
    hint: 'Add length or variety. Long passphrases like “purple eagle 2026” work well.'
  };
};

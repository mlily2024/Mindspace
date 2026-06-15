/**
 * recoveryPhrase — 12-word BIP39 mnemonic generation and validation.
 *
 * ADR-0009 phase 1.3 v1 step 2/9. Used as the SECONDARY unlock path for
 * the master key: if a user forgets their passphrase, they can paste the
 * 12-word recovery phrase shown to them at setup time and recover access
 * to their encrypted notes.
 *
 * Why BIP39:
 *   - 128 bits of entropy in 12 words is well above brute-force feasible
 *   - Words are pickable from a curated 2048-word English wordlist
 *     designed for unambiguous transcription (no homophones, etc.)
 *   - Built-in checksum: a typo in any word fails validateRecoveryPhrase()
 *     before being accepted as a candidate unlock key
 *   - Wide ecosystem familiarity (bitcoin wallets, password managers)
 *
 * Library: @scure/bip39 (audited, ~10 KB gzipped, MIT).
 *
 * This module is pure: no module-level state, no side effects.
 */
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

export const RECOVERY_WORD_COUNT = 12;
export const RECOVERY_ENTROPY_BITS = 128; // generateMnemonic(wordlist, 128) → 12 words

/**
 * Generate a fresh 12-word BIP39 English recovery phrase.
 * Uses crypto.getRandomValues internally (via the library).
 *
 * The returned string is space-separated, lowercase, ready to display.
 * Caller is responsible for ONE-TIME display + confirming the user has
 * stored it. NEVER persist the phrase server-side.
 */
export const generateRecoveryPhrase = () =>
  generateMnemonic(wordlist, RECOVERY_ENTROPY_BITS);

/**
 * True iff the input is a valid 12-word BIP39 English mnemonic with a
 * correct checksum word. Lower-cases and trims before checking, so
 * "  Sunset  abandon… " is treated the same as "sunset abandon…".
 *
 * A typo in any word OR a word in the wrong position will return false
 * thanks to BIP39's built-in checksum.
 */
export const validateRecoveryPhrase = (phrase) => {
  if (typeof phrase !== 'string') return false;
  const normalised = normalizeRecoveryPhrase(phrase);
  if (normalised.split(/\s+/).length !== RECOVERY_WORD_COUNT) return false;
  try {
    return validateMnemonic(normalised, wordlist);
  } catch (_) {
    return false;
  }
};

/** Lower-case, single-space-separate the input. Idempotent. */
export const normalizeRecoveryPhrase = (phrase) =>
  String(phrase || '').toLowerCase().trim().split(/\s+/).join(' ');

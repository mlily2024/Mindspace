/**
 * moodEntryE2EE — small wrappers that encrypt mood-entry notes before
 * sending to the server (write path) and decrypt them after receiving
 * (read path), when the user's master key is unlocked in this session.
 *
 * Phase 1.3 v1 steps 5 + 6 (2026-06-16) on top of ADR-0009. Pure functions.
 *
 * Wire format: a single string with two base64 segments separated by a
 * single colon:
 *
 *     <iv-base64>:<ciphertext-base64>
 *
 * This is distinct from the legacy three-segment `iv:authTag:ciphertext`
 * format (the GCM auth tag is appended to the ciphertext by Web Crypto so
 * we never need a separate segment for it). The server stores either
 * format unchanged when `is_e2ee_encrypted=true`, and decrypts the legacy
 * format only when `is_e2ee_encrypted=false`.
 *
 * Both wrappers are GRACEFUL: if anything goes wrong, they fall back to
 * returning the input unchanged with `is_e2ee_encrypted=false`. The user
 * never gets a hard error; their save / display flow is preserved.
 */
import { encryptString, decryptString } from './encryptionE2EE';
import { getCachedMasterKey } from './keyManagement';

const SEPARATOR = ':';

/**
 * If the user's master key is cached AND notes is non-empty, encrypts
 * notes client-side and returns { notes, is_e2ee_encrypted: true }.
 * Otherwise returns { notes, is_e2ee_encrypted: false } unchanged.
 *
 * Used right before posting a new (or updated) mood entry to /api/mood.
 */
export const wrapForWrite = async (notes) => {
  if (typeof notes !== 'string' || notes.trim().length === 0) {
    return { notes, is_e2ee_encrypted: false };
  }
  const masterKey = getCachedMasterKey();
  if (!masterKey) {
    return { notes, is_e2ee_encrypted: false };
  }
  try {
    const { ciphertext, iv } = await encryptString(notes, masterKey);
    return {
      notes: `${iv}${SEPARATOR}${ciphertext}`,
      is_e2ee_encrypted: true
    };
  } catch (e) {
    // Never block the save flow. Fall back to legacy server-encrypt.
    // eslint-disable-next-line no-console
    console.warn('[E2EE] note encryption failed, falling back to server-encrypt:', e);
    return { notes, is_e2ee_encrypted: false };
  }
};

/**
 * If `is_e2ee_encrypted=true` AND the master key is cached, decrypts the
 * wire-format blob and returns the plaintext. Otherwise returns the
 * input string unchanged (which is correct: legacy-encrypted notes are
 * already server-decrypted by the time they reach the client; not-E2EE
 * rows have plaintext; E2EE rows without a cached key remain opaque and
 * the UI can display a "🔒 Encrypted — unlock to read" placeholder via
 * the second return value).
 *
 * Returns { plaintext: string | null, decrypted: boolean }:
 *   - { plaintext: '...', decrypted: true }     successful decrypt
 *   - { plaintext: notesInput, decrypted: false } not an E2EE row OR no key
 *   - { plaintext: null,  decrypted: false }    E2EE row but decrypt threw
 */
export const unwrapForRead = async (notes, isE2EE) => {
  if (!isE2EE) {
    return { plaintext: notes, decrypted: false };
  }
  const masterKey = getCachedMasterKey();
  if (!masterKey || typeof notes !== 'string' || notes.length === 0) {
    return { plaintext: notes, decrypted: false };
  }
  const parts = notes.split(SEPARATOR);
  if (parts.length !== 2) {
    // Malformed wire blob — don't surface the garbled bytes to the user
    return { plaintext: null, decrypted: false };
  }
  const [ivB64, ciphertextB64] = parts;
  try {
    const plaintext = await decryptString(ciphertextB64, ivB64, masterKey);
    return { plaintext, decrypted: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[E2EE] note decryption failed:', e);
    return { plaintext: null, decrypted: false };
  }
};

/**
 * Whether a given encrypted-flag indicates the row is opaque to the
 * server. Tiny helper to make UI code more readable than `entry.is_e2ee_encrypted`.
 */
export const isE2EERow = (entry) =>
  Boolean(entry && entry.is_e2ee_encrypted);

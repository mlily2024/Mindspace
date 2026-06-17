import { encryptString, decryptString } from './encryptionE2EE';
import { getCachedMasterKey } from './keyManagement';

/**
 * journalEntryE2EE — client-side E2EE wrappers for journal entries.
 * Mirrors moodEntryE2EE.js (2026-06-16): same wire format, same graceful
 * fallback to plaintext + server-side AES-GCM when no master key is cached.
 *
 * The journal has two encryptable fields — `response` (the main text) and
 * `followUpResponses` (a JSON-stringified array). Both are encrypted under
 * the same master key as the mood notes.
 */

const SEPARATOR = ':';

const _encryptOne = async (plain, masterKey) => {
  if (typeof plain !== 'string' || plain.length === 0) return null;
  const { ciphertext, iv } = await encryptString(plain, masterKey);
  return `${iv}${SEPARATOR}${ciphertext}`;
};

const _decryptOne = async (blob, masterKey) => {
  if (typeof blob !== 'string' || blob.length === 0) return null;
  const parts = blob.split(SEPARATOR);
  if (parts.length !== 2) return null;
  return decryptString(parts[1], parts[0], masterKey);
};

/**
 * Encrypt response + followUpResponses for a journal POST.
 * Returns { response, followUpResponses, is_e2ee_encrypted }.
 *
 * On the graceful path (no key OR encryption fails) the function returns
 * the plaintext inputs with is_e2ee_encrypted=false; the server falls
 * back to its legacy AES-GCM-at-rest path.
 */
export const wrapForWrite = async ({ response, followUpResponses }) => {
  const masterKey = getCachedMasterKey();
  if (!masterKey) {
    return { response, followUpResponses, is_e2ee_encrypted: false };
  }
  try {
    const [encResponse, encFollowUps] = await Promise.all([
      _encryptOne(response, masterKey),
      _encryptOne(followUpResponses, masterKey),
    ]);
    return {
      response: encResponse,
      followUpResponses: encFollowUps,
      is_e2ee_encrypted: true,
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[E2EE] journal encrypt failed, falling back to server-encrypt:', e);
    return { response, followUpResponses, is_e2ee_encrypted: false };
  }
};

/**
 * Decrypt an entry returned from the API. Mirrors moodEntryE2EE.unwrapForRead:
 * { plaintextResponse, plaintextFollowUps, decrypted } with `decrypted`
 * false when no key OR the row was not E2EE.
 */
export const unwrapForRead = async (entry) => {
  if (!entry || !entry.is_e2ee_encrypted) {
    return {
      plaintextResponse:  entry?.response ?? null,
      plaintextFollowUps: entry?.follow_up_responses ?? null,
      decrypted: false,
    };
  }
  const masterKey = getCachedMasterKey();
  if (!masterKey) {
    return { plaintextResponse: null, plaintextFollowUps: null, decrypted: false };
  }
  try {
    const [plaintextResponse, plaintextFollowUps] = await Promise.all([
      _decryptOne(entry.response, masterKey),
      _decryptOne(entry.follow_up_responses, masterKey),
    ]);
    return { plaintextResponse, plaintextFollowUps, decrypted: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[E2EE] journal decrypt failed:', e);
    return { plaintextResponse: null, plaintextFollowUps: null, decrypted: false };
  }
};

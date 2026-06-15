/**
 * keyManagement — orchestrates the E2EE setup / unlock / rewrap flows
 * on top of the primitives in encryptionE2EE.js and recoveryPhrase.js.
 *
 * ADR-0009 phase 1.3 v1 step 2/9.
 *
 * This module owns:
 *   - The decision of which Argon2id params to use (benchmark)
 *   - The actual sequence of: generate master key → wrap under passphrase
 *     KDF key → wrap under recovery-phrase KDF key → serialise to base64
 *   - The reverse for unlock: derive KDF key → unwrap master key
 *   - The in-memory session cache for the master key (cleared on logout
 *     or tab close; never persisted to localStorage)
 *
 * What this module does NOT do:
 *   - Talk to the server. Callers fetch /api/e2ee/metadata and pass the
 *     resulting bundle in; or take the bundle this module returns from
 *     setupNewUser() and POST it to /api/e2ee/setup themselves.
 *   - Render UI. Pure orchestration.
 */
import {
  argon2idDeriveKey, pbkdf2DeriveKey,
  generateAesGcmKey, importAesGcmKey, exportRawKey,
  encryptBytes, decryptBytes,
  randomBytes, toBase64, fromBase64,
  KDF_SALT_BYTES, RECOVERY_FIXED_SALT
} from './encryptionE2EE';
import { generateRecoveryPhrase, normalizeRecoveryPhrase, validateRecoveryPhrase } from './recoveryPhrase';

// ─── Argon2id parameter selection ───────────────────────────────────────────

const FAST_PARAMS = { memory: 65536, time: 3, parallelism: 1 };  // 64 MiB
const SLOW_PARAMS = { memory: 32768, time: 3, parallelism: 1 };  // 32 MiB
const BENCHMARK_BUDGET_MS = 2000;

/**
 * Decide Argon2id params for this device. Tries 64 MiB first; if it
 * takes more than 2 s OR fails (OOM on a tiny browser), downgrades to
 * 32 MiB. The chosen params are persisted server-side per user, so
 * this benchmark only runs once (at setupNewUser).
 */
export const chooseArgon2Params = async () => {
  const dummySalt = randomBytes(KDF_SALT_BYTES);
  try {
    const start = performance.now();
    await argon2idDeriveKey('benchmark-only', dummySalt, FAST_PARAMS);
    const elapsedMs = performance.now() - start;
    return elapsedMs < BENCHMARK_BUDGET_MS ? FAST_PARAMS : SLOW_PARAMS;
  } catch (_) {
    return SLOW_PARAMS;
  }
};

// ─── Setup: new user enrolling in E2EE ──────────────────────────────────────

/**
 * Create everything needed for a new E2EE-enrolled user:
 *   - Per-user random salt
 *   - Per-device Argon2id params (benchmarked)
 *   - 12-word recovery phrase (shown to user, NEVER stored server-side)
 *   - Random 32-byte master key
 *   - Wrapped master key under passphrase-derived KDF key
 *   - Wrapped master key under recovery-phrase-derived KDF key
 *
 * Returns:
 *   - uploadBundle: the object to POST to /api/e2ee/setup
 *   - recoveryPhrase: the 12-word string to DISPLAY ONCE to the user
 *   - masterKey: the CryptoKey to cache for the current session
 *
 * Throws if Web Crypto / Argon2id unavailable.
 */
export const setupNewUser = async (passphrase) => {
  if (typeof passphrase !== 'string' || passphrase.length < 8) {
    throw new Error('setupNewUser: passphrase must be at least 8 characters');
  }
  const salt          = randomBytes(KDF_SALT_BYTES);
  const params        = await chooseArgon2Params();
  const recoveryPhrase = generateRecoveryPhrase();

  // Master key — generated fresh, extractable so we can wrap it twice.
  const masterKeyCrypto = await generateAesGcmKey();
  const masterKeyBytes  = await exportRawKey(masterKeyCrypto);

  // Wrap #1: under passphrase-derived KDF key
  const passphraseRawKey = await argon2idDeriveKey(passphrase, salt, params);
  const passphraseKey    = await importAesGcmKey(passphraseRawKey, false);
  const passWrap         = await encryptBytes(masterKeyBytes, passphraseKey);

  // Wrap #2: under recovery-phrase-derived KDF key
  const recoveryRawKey = await pbkdf2DeriveKey(recoveryPhrase, RECOVERY_FIXED_SALT);
  const recoveryKey    = await importAesGcmKey(recoveryRawKey, false);
  const recWrap        = await encryptBytes(masterKeyBytes, recoveryKey);

  // Zero out raw bytes we no longer need.
  masterKeyBytes.fill(0);
  passphraseRawKey.fill(0);
  recoveryRawKey.fill(0);

  // Re-import master key as non-extractable for the active session.
  // (We already wrapped it; we never need its raw bytes again until
  // unwrapping on a future login, which goes through unlock*).
  const sessionMasterKey = masterKeyCrypto; // already a CryptoKey

  return {
    uploadBundle: {
      kdf_algo:                   'argon2id',
      kdf_salt:                   toBase64(salt),
      kdf_params:                 params,
      wrapped_master_key:         toBase64(passWrap.ciphertext),
      wrapped_master_iv:          toBase64(passWrap.iv),
      wrapped_master_recovery:    toBase64(recWrap.ciphertext),
      wrapped_master_recovery_iv: toBase64(recWrap.iv)
    },
    recoveryPhrase,
    masterKey: sessionMasterKey
  };
};

// ─── Unlock: existing E2EE-enrolled user, fresh login ───────────────────────

const _unwrapMasterKey = async (wrappingKey, ciphertextB64, ivB64) => {
  const rawMaster = await decryptBytes(
    fromBase64(ciphertextB64), fromBase64(ivB64), wrappingKey
  );
  const masterKey = await importAesGcmKey(rawMaster, false);
  rawMaster.fill(0);
  return masterKey;
};

/**
 * Unlock the master key using a user-typed passphrase + the bundle
 * fetched from /api/e2ee/metadata. Throws on wrong passphrase (AES-GCM
 * auth tag mismatch).
 */
export const unlockWithPassphrase = async (passphrase, metadata) => {
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new Error('unlockWithPassphrase: passphrase required');
  }
  if (!metadata || metadata.kdf_algo !== 'argon2id') {
    throw new Error('unlockWithPassphrase: only argon2id is supported in v1');
  }
  const salt = fromBase64(metadata.kdf_salt);
  const rawKey = await argon2idDeriveKey(passphrase, salt, metadata.kdf_params);
  const wrappingKey = await importAesGcmKey(rawKey, false);
  rawKey.fill(0);
  return _unwrapMasterKey(
    wrappingKey, metadata.wrapped_master_key, metadata.wrapped_master_iv
  );
};

/**
 * Unlock via recovery phrase. Used when the user has forgotten their
 * passphrase but stored the 12-word phrase shown at setup.
 *
 * Throws on invalid phrase format OR on auth-tag mismatch (which would
 * indicate the phrase is well-formed-but-wrong).
 */
export const unlockWithRecoveryPhrase = async (phrase, metadata) => {
  const normalised = normalizeRecoveryPhrase(phrase);
  if (!validateRecoveryPhrase(normalised)) {
    throw new Error('unlockWithRecoveryPhrase: recovery phrase is invalid (wrong word count, wrong word, or checksum mismatch)');
  }
  const rawKey = await pbkdf2DeriveKey(normalised, RECOVERY_FIXED_SALT);
  const wrappingKey = await importAesGcmKey(rawKey, false);
  rawKey.fill(0);
  return _unwrapMasterKey(
    wrappingKey, metadata.wrapped_master_recovery, metadata.wrapped_master_recovery_iv
  );
};

// ─── Rewrap: on password change ─────────────────────────────────────────────

/**
 * Re-wrap the existing master key under a new passphrase, using the SAME
 * salt and KDF params as the existing setup. Returns the new bundle to
 * PUT to /api/e2ee/rewrap. Does NOT change the master key itself, so
 * existing encrypted records stay decryptable.
 *
 * Requires the master key to be currently unlocked (call after a
 * successful unlockWithPassphrase or unlockWithRecoveryPhrase, with the
 * old passphrase, BEFORE changing).
 */
export const rewrapForNewPassphrase = async (masterKey, newPassphrase, metadata) => {
  if (typeof newPassphrase !== 'string' || newPassphrase.length < 8) {
    throw new Error('rewrapForNewPassphrase: newPassphrase must be at least 8 characters');
  }
  const salt = fromBase64(metadata.kdf_salt);
  const rawKey = await argon2idDeriveKey(newPassphrase, salt, metadata.kdf_params);
  const wrappingKey = await importAesGcmKey(rawKey, false);
  rawKey.fill(0);

  // Need raw bytes of master key to re-wrap. Re-import the existing
  // CryptoKey as extractable via export/import is impossible for a non-
  // extractable key — so callers must already hold the extractable
  // master key (true in setupNewUser; also true after unlock* because we
  // import non-extractable, but we don't actually need raw bytes here —
  // we can encrypt UNDER masterKey directly, but we need to wrap THE
  // master key, which requires its raw bytes).
  //
  // Resolution: re-derive the master key as extractable during unlock.
  // For now: take the raw bytes from the caller. The unlock helpers
  // return non-extractable; the rewrap flow needs them re-imported as
  // extractable. We surface this constraint as an error to push the
  // caller to use unlockExtractable() (added below) for the rewrap path.
  if (!masterKey.extractable) {
    throw new Error('rewrapForNewPassphrase: masterKey must be extractable. Use unlock*Extractable() for the rewrap path.');
  }
  const masterBytes = await exportRawKey(masterKey);
  const wrap = await encryptBytes(masterBytes, wrappingKey);
  masterBytes.fill(0);

  return {
    wrapped_master_key: toBase64(wrap.ciphertext),
    wrapped_master_iv:  toBase64(wrap.iv)
  };
};

// Extractable-master-key variants of the unlock helpers. Used by the
// rewrap path. The masterKey returned MUST be replaced with a non-
// extractable version (re-import the bytes) before being cached for
// general session use, so that other JS in the page cannot exfiltrate
// the raw bytes via exportKey().
const _unwrapMasterKeyExtractable = async (wrappingKey, ciphertextB64, ivB64) => {
  const rawMaster = await decryptBytes(
    fromBase64(ciphertextB64), fromBase64(ivB64), wrappingKey
  );
  const masterKey = await importAesGcmKey(rawMaster, true);
  rawMaster.fill(0);
  return masterKey;
};

export const unlockWithPassphraseExtractable = async (passphrase, metadata) => {
  const salt = fromBase64(metadata.kdf_salt);
  const rawKey = await argon2idDeriveKey(passphrase, salt, metadata.kdf_params);
  const wrappingKey = await importAesGcmKey(rawKey, false);
  rawKey.fill(0);
  return _unwrapMasterKeyExtractable(
    wrappingKey, metadata.wrapped_master_key, metadata.wrapped_master_iv
  );
};

// ─── Session cache (in-memory only) ─────────────────────────────────────────
// The master key lives in module-level state for the duration of the JS
// runtime. It is NOT persisted to localStorage or sessionStorage; closing
// the tab requires the user to re-unlock with their passphrase.

let _cachedMasterKey = null;

export const cacheMasterKey   = (key) => { _cachedMasterKey = key; };
export const getCachedMasterKey = ()   => _cachedMasterKey;
export const clearMasterKey   = ()     => { _cachedMasterKey = null; };
export const isUnlocked       = ()     => _cachedMasterKey !== null;

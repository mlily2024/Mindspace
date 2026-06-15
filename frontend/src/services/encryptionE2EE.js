/**
 * encryptionE2EE — low-level crypto primitives for the client-side E2EE
 * design (ADR-0009, Phase 1.3 v1, step 2/9).
 *
 * What this module is:
 *   - A thin, audited-primitive-only wrapper around the Web Crypto API
 *     (AES-256-GCM, PBKDF2-SHA-256, randomness) PLUS Argon2id via the
 *     hash-wasm library (Web Crypto does not provide Argon2id natively).
 *   - Pure functions: no module-level state, no API calls, no DOM access.
 *
 * What this module is NOT:
 *   - It does not orchestrate the setup / unlock / rewrap flows. That is
 *     keyManagement.js.
 *   - It does not know about the BIP39 mnemonic format. That is
 *     recoveryPhrase.js.
 *
 * Security notes:
 *   - Requires a SECURE CONTEXT (HTTPS or localhost). Web Crypto is
 *     unavailable on http:// pages.
 *   - All keys returned are non-extractable from JavaScript where the API
 *     allows it; the raw bytes are only extracted where strictly needed
 *     (e.g. wrapping the master key requires raw bytes as the wrap target).
 *   - Every encrypt call generates a fresh random 12-byte IV. Never reuse.
 */
import { argon2id } from 'hash-wasm';

// 12 bytes is the IV length recommended by NIST for AES-GCM. We standardise
// on 12 across every primitive to avoid format-version surprises.
export const AES_GCM_IV_BYTES = 12;
// 16 bytes for the per-user KDF salt — 128 bits, well above the collision floor.
export const KDF_SALT_BYTES   = 16;
// The recovery-phrase derivation uses a fixed app-level salt because the
// BIP39 mnemonic already carries 128 bits of entropy; the KDF here only
// needs collision resistance, not GPU-attack resistance.
export const RECOVERY_FIXED_SALT = 'mindspace.recovery.v1';
export const RECOVERY_PBKDF2_ITERATIONS = 100_000;

// ─── Encoding / decoding helpers ─────────────────────────────────────────────

const _encoder = new TextEncoder();
const _decoder = new TextDecoder();

export const toText   = (bytes) => _decoder.decode(bytes);
export const fromText = (str)   => _encoder.encode(str);

/** Encode Uint8Array → standard (non-URL-safe) base64. */
export const toBase64 = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

/** Decode standard or URL-safe base64 → Uint8Array. */
export const fromBase64 = (b64) => {
  const normalised = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - normalised.length % 4) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

// ─── Randomness ──────────────────────────────────────────────────────────────

/** Cryptographically secure random bytes. */
export const randomBytes = (n) => {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
};

// ─── Argon2id KDF (passphrase → key) ─────────────────────────────────────────

/**
 * Derive a 256-bit key from a passphrase via Argon2id (the PHC winner).
 * Returns the raw 32 bytes; call importAesGcmKey() to wrap them as a
 * non-extractable CryptoKey for actual encryption.
 *
 * Default params (per ADR-0009): memory=65536 KiB (64 MiB), time=3, parallelism=1.
 * On low-end devices, a benchmark in keyManagement.js can downgrade to 32 MiB.
 */
export const argon2idDeriveKey = async (passphrase, salt, params) => {
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new Error('argon2idDeriveKey: passphrase must be a non-empty string');
  }
  if (!(salt instanceof Uint8Array) || salt.byteLength < 8) {
    throw new Error('argon2idDeriveKey: salt must be a Uint8Array of >= 8 bytes');
  }
  const { memory = 65536, time = 3, parallelism = 1 } = params || {};
  return argon2id({
    password:    passphrase,
    salt,
    parallelism,
    iterations:  time,
    memorySize:  memory,   // hash-wasm uses KiB, matches our `memory` param
    hashLength:  32,
    outputType:  'binary'
  });
};

// ─── PBKDF2-SHA-256 (recovery phrase → key) ──────────────────────────────────

/**
 * Derive a 256-bit key from a high-entropy input (e.g. BIP39 mnemonic) via
 * PBKDF2-SHA-256. Used only for the recovery-phrase path; the passphrase
 * path uses Argon2id (above). Returns raw 32 bytes.
 *
 * iterations defaults to 100k per OWASP 2024 for high-entropy inputs.
 */
export const pbkdf2DeriveKey = async (input, salt, iterations = RECOVERY_PBKDF2_ITERATIONS) => {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('pbkdf2DeriveKey: input must be a non-empty string');
  }
  const saltBytes = typeof salt === 'string' ? fromText(salt) : salt;
  if (!(saltBytes instanceof Uint8Array)) {
    throw new Error('pbkdf2DeriveKey: salt must be a string or Uint8Array');
  }
  const baseKey = await crypto.subtle.importKey(
    'raw', fromText(input), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    baseKey, 256
  );
  return new Uint8Array(bits);
};

// ─── AES-256-GCM ─────────────────────────────────────────────────────────────

/**
 * Import 32 raw key bytes as a non-extractable AES-GCM CryptoKey.
 * `extractable=false` so the raw bytes cannot be re-read from JS, which
 * is the right default for the MASTER KEY (held in memory long-term).
 *
 * Use extractable=true ONLY for keys whose bytes you need to re-extract
 * for wrapping (e.g. a fresh master key about to be wrapped under a KDF
 * key has to be exported once to AES-GCM-encrypt).
 */
export const importAesGcmKey = (rawBytes, extractable = false) => {
  if (!(rawBytes instanceof Uint8Array) || rawBytes.byteLength !== 32) {
    throw new Error('importAesGcmKey: rawBytes must be a Uint8Array of 32 bytes');
  }
  return crypto.subtle.importKey(
    'raw', rawBytes, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']
  );
};

/** Generate a fresh random AES-256-GCM CryptoKey (extractable for wrapping). */
export const generateAesGcmKey = () =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

/** Export a CryptoKey to its raw 32 bytes (caller must hold extractable=true). */
export const exportRawKey = async (cryptoKey) => {
  const raw = await crypto.subtle.exportKey('raw', cryptoKey);
  return new Uint8Array(raw);
};

/**
 * Encrypt `plaintextBytes` under `key` (AES-256-GCM).
 * Returns { iv, ciphertext } — both Uint8Array. The ciphertext already
 * has the 16-byte GCM auth tag appended by Web Crypto.
 */
export const encryptBytes = async (plaintextBytes, key) => {
  if (!(plaintextBytes instanceof Uint8Array)) {
    throw new Error('encryptBytes: plaintextBytes must be a Uint8Array');
  }
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintextBytes);
  return { iv, ciphertext: new Uint8Array(ct) };
};

/**
 * Decrypt `ciphertext` under `key`. Throws on auth-tag mismatch.
 */
export const decryptBytes = async (ciphertext, iv, key) => {
  if (!(ciphertext instanceof Uint8Array) || !(iv instanceof Uint8Array)) {
    throw new Error('decryptBytes: ciphertext and iv must be Uint8Array');
  }
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(pt);
};

/** Convenience: encrypt a string, return base64-encoded {ciphertext, iv}. */
export const encryptString = async (plaintext, key) => {
  const { iv, ciphertext } = await encryptBytes(fromText(plaintext), key);
  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) };
};

/** Convenience: decrypt base64-encoded ciphertext + iv to a string. */
export const decryptString = async (ciphertextB64, ivB64, key) =>
  toText(await decryptBytes(fromBase64(ciphertextB64), fromBase64(ivB64), key));

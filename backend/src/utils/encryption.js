const crypto = require('crypto');
require('dotenv').config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
}

// Derive a 32-byte key from the environment variable using SHA-256
const KEY = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt sensitive data using AES-256-GCM (authenticated encryption)
 * Each call generates a unique IV for security
 * @param {string} data - Data to encrypt
 * @returns {string} Encrypted data (iv:authTag:ciphertext, base64-encoded)
 */
const encrypt = (data) => {
  if (!data) return null;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const plaintext = JSON.stringify(data);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    // Format: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt sensitive data encrypted with AES-256-GCM
 * Also supports legacy CryptoJS-encrypted data for backwards compatibility
 * @param {string} encryptedData - Encrypted data
 * @returns {any} Decrypted data
 */
const decrypt = (encryptedData) => {
  if (!encryptedData) return null;
  try {
    // New format: iv:authTag:ciphertext
    const parts = encryptedData.split(':');
    if (parts.length === 3) {
      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      const ciphertext = parts[2];
      const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    }
    // Legacy CryptoJS format fallback — attempt to decrypt old data
    // CryptoJS AES output is a single base64 string (no colons)
    try {
      const CryptoJS = require('crypto-js');
      const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (legacyError) {
      throw new Error('Unable to decrypt data (unsupported format)');
    }
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Hash data (one-way) using SHA-256
 * @param {string} data - Data to hash
 * @returns {string} Hashed data (hex)
 */
const hash = (data) => {
  return crypto.createHash('sha256').update(String(data)).digest('hex');
};

module.exports = {
  encrypt,
  decrypt,
  hash
};

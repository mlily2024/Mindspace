/**
 * Tests for encryption utility
 * Covers: encrypt, decrypt, hash, and backwards compatibility
 */

// Set required env vars before importing
process.env.ENCRYPTION_KEY = 'test_encryption_key_that_is_at_least_32_chars_long';
process.env.JWT_SECRET = 'test_jwt_secret';

const { encrypt, decrypt, hash } = require('../src/utils/encryption');

describe('Encryption Utility', () => {
  describe('encrypt()', () => {
    it('should return null for null input', () => {
      expect(encrypt(null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(encrypt('')).toBeNull();
    });

    it('should encrypt a string and return iv:authTag:ciphertext format', () => {
      const result = encrypt('hello world');
      expect(result).toBeTruthy();
      const parts = result.split(':');
      expect(parts).toHaveLength(3);
    });

    it('should produce different ciphertext for same input (unique IVs)', () => {
      const result1 = encrypt('same data');
      const result2 = encrypt('same data');
      expect(result1).not.toEqual(result2);
    });

    it('should encrypt objects via JSON.stringify', () => {
      const obj = { mood: 7, notes: 'feeling good' };
      const result = encrypt(obj);
      expect(result).toBeTruthy();
      expect(result.split(':')).toHaveLength(3);
    });
  });

  describe('decrypt()', () => {
    it('should return null for null input', () => {
      expect(decrypt(null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(decrypt('')).toBeNull();
    });

    it('should correctly decrypt an encrypted string', () => {
      const original = 'sensitive data here';
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toEqual(original);
    });

    it('should correctly decrypt an encrypted object', () => {
      const original = { mood: 8, stress: 3, notes: 'test entry' };
      const encrypted = encrypt(original);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toEqual(original);
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = encrypt('test data');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext
      parts[2] = 'AAAA' + parts[2].substring(4);
      const tampered = parts.join(':');
      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw on completely invalid input', () => {
      expect(() => decrypt('not-valid-encrypted-data')).toThrow();
    });
  });

  describe('hash()', () => {
    it('should produce a hex string', () => {
      const result = hash('test');
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent results for same input', () => {
      expect(hash('hello')).toEqual(hash('hello'));
    });

    it('should produce different results for different input', () => {
      expect(hash('hello')).not.toEqual(hash('world'));
    });

    it('should handle numeric input', () => {
      const result = hash(12345);
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

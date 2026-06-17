/**
 * Tests for the common-password blocklist used by the register route.
 * ADR-0010 (NIST 800-63B alignment). Phase 1: blocklist contents +
 * case-insensitive lookup. Phase 2: integration test on the register
 * validator chain lives in auth.test.js (separate file).
 */

const { COMMON_PASSWORDS, isCommonPassword } = require('../src/utils/commonPasswords');

describe('commonPasswords blocklist', () => {
  test('blocks the top leaked passwords (canonical-case)', () => {
    expect(isCommonPassword('password')).toBe(true);
    expect(isCommonPassword('12345678')).toBe(true);
    expect(isCommonPassword('qwerty123')).toBe(true);
    expect(isCommonPassword('letmein')).toBe(true);
    expect(isCommonPassword('iloveyou')).toBe(true);
  });

  test('lookup is case-insensitive — Password / PASSWORD also blocked', () => {
    expect(isCommonPassword('Password')).toBe(true);
    expect(isCommonPassword('PASSWORD')).toBe(true);
    expect(isCommonPassword('Password123')).toBe(true);
    expect(isCommonPassword('LETMEIN')).toBe(true);
  });

  test('app-specific lazy choices are blocked', () => {
    expect(isCommonPassword('mindspace')).toBe(true);
    expect(isCommonPassword('mindspace123')).toBe(true);
    expect(isCommonPassword('Mindspace1')).toBe(true);
  });

  test('strong passphrases pass through', () => {
    expect(isCommonPassword('purple eagle jumped 2026')).toBe(false);
    expect(isCommonPassword('correct horse battery staple')).toBe(false);
    expect(isCommonPassword('Xq7$pLm9!Rt2#kEn')).toBe(false);
    expect(isCommonPassword('my-mind-space-is-cosy')).toBe(false);
  });

  test('handles non-string and empty input safely', () => {
    expect(isCommonPassword(null)).toBe(false);
    expect(isCommonPassword(undefined)).toBe(false);
    expect(isCommonPassword(123)).toBe(false);
    expect(isCommonPassword('')).toBe(false);
    expect(isCommonPassword({})).toBe(false);
  });

  test('blocklist is sensibly sized — not zero, not unbounded', () => {
    // Top-50 floor (catch lazy bots) but capped at 100 to keep lookup O(1)
    // small enough that the whole Set stays in CPU cache on every register.
    expect(COMMON_PASSWORDS.size).toBeGreaterThanOrEqual(50);
    expect(COMMON_PASSWORDS.size).toBeLessThanOrEqual(100);
  });

  test('every entry is lowercase (canonical form for case-insensitive lookup)', () => {
    for (const entry of COMMON_PASSWORDS) {
      expect(entry).toBe(entry.toLowerCase());
    }
  });
});

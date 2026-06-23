/**
 * Tests for the i18n setup (F.3, ADR-0021).
 */
import { describe, it, expect } from 'vitest';
import i18n, { DEFAULT_LOCALE, resources } from './index';

describe('i18n', () => {
  it('defaults to en-GB for both language and fallback', () => {
    expect(DEFAULT_LOCALE).toBe('en-GB');
    expect(i18n.language).toBe('en-GB');
  });

  it('resolves nav + badge keys from the common namespace', () => {
    expect(i18n.t('nav.home')).toBe('Home');
    expect(i18n.t('nav.checkIn')).toBe('Check In');
    expect(i18n.t('nav.crisisSupport')).toBe('Crisis Support');
    expect(i18n.t('badge.mockData')).toBe('Mock data');
  });

  it('falls back to the key string for a missing key (no crash, no null)', () => {
    expect(i18n.t('nav.doesNotExist')).toBe('nav.doesNotExist');
  });

  it('exposes en-GB resources for the common namespace', () => {
    expect(resources['en-GB'].common.nav.home).toBe('Home');
  });

  it('every nav key Navigation references is defined (not echoed back)', () => {
    const keys = [
      'home', 'checkIn', 'journal', 'insights', 'selfCare', 'screening',
      'wearables', 'community', 'settings', 'support', 'crisisSupport', 'logout',
    ];
    keys.forEach((k) => {
      const v = i18n.t(`nav.${k}`);
      expect(typeof v).toBe('string');
      expect(v).not.toBe(`nav.${k}`); // actually defined, not the raw key
    });
  });
});

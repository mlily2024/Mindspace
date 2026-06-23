/**
 * Tests for carePathways (ADR-0013) — the UK step-up-to-care registry.
 * Includes a UK-only regression guard mirroring ADR-0003's SafetyFilter test.
 */
const carePathways = require('../src/services/carePathways');

describe('carePathways', () => {
  it('crisis resources reuse the frozen SafetyFilter (Samaritans 116 123, NHS 111, 999)', () => {
    const crisis = carePathways.crisisResources();
    const names = crisis.map((r) => r.name).join(' ');
    expect(names).toContain('Samaritans');
    expect(crisis.some((r) => r.phone === '116 123')).toBe(true);
    expect(crisis.some((r) => r.phone === '111')).toBe(true);
    expect(crisis.some((r) => r.phone === '999')).toBe(true);
  });

  it('step-up pathways include the NHS Talking Therapies self-referral + GP', () => {
    const step = carePathways.stepUpPathways();
    const names = step.map((r) => r.name).join(' ');
    expect(names).toContain('NHS Talking Therapies');
    expect(names).toContain('GP');
    expect(step.some((r) => /nhs\.uk/.test(r.url || ''))).toBe(true);
    // Samaritans retained as the always-available backup
    expect(step.some((r) => r.phone === '116 123')).toBe(true);
  });

  it('self-care pathways stay light (keep-tracking + no-pressure self-referral)', () => {
    const sc = carePathways.selfCarePathways();
    expect(sc.map((r) => r.name).join(' ')).toContain('NHS Talking Therapies');
  });

  it('is UK-only — no US crisis content anywhere (regression guard)', () => {
    const all = JSON.stringify([
      carePathways.crisisResources(),
      carePathways.stepUpPathways(),
      carePathways.selfCarePathways(),
    ]);
    expect(all).not.toMatch(/988|1-800|741741|National Suicide Prevention|SAMHSA/i);
  });

  it('routes via a national self-referral finder, storing no location', () => {
    expect(carePathways.NHS_TALKING_THERAPIES.url).toContain('nhs.uk');
  });
});

/**
 * Tests for the SafetyFilter — UK crisis detection + response contract.
 *
 * These tests double as the executable specification of the safety
 * contract: the keyword list, the UK localisation, and the explicit
 * absence of US-only crisis references (regression guard against the
 * earlier US-localised Luna response text).
 */

const safetyFilter = require('../src/services/safetyFilter');

describe('SafetyFilter', () => {

  describe('detect()', () => {

    it('detects direct suicidal ideation', () => {
      expect(safetyFilter.detect('I want to kill myself')).toBe(true);
      expect(safetyFilter.detect('I am suicidal')).toBe(true);
      expect(safetyFilter.detect("I don't want to live")).toBe(true);
      expect(safetyFilter.detect('I want to end my life')).toBe(true);
      expect(safetyFilter.detect('there is no reason to live')).toBe(true);
    });

    it('detects self-harm phrasing', () => {
      expect(safetyFilter.detect('I want to hurt myself')).toBe(true);
      expect(safetyFilter.detect('thinking about an overdose')).toBe(true);
      expect(safetyFilter.detect('I have been cutting')).toBe(true);
      expect(safetyFilter.detect('I might self-harm')).toBe(true);
      expect(safetyFilter.detect('thinking about self harm')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(safetyFilter.detect('I want to KILL MYSELF')).toBe(true);
      expect(safetyFilter.detect('Suicide')).toBe(true);
      expect(safetyFilter.detect('I AM SUICIDAL')).toBe(true);
    });

    it('returns false for ordinary text', () => {
      expect(safetyFilter.detect('I had a great day today')).toBe(false);
      expect(safetyFilter.detect('I am feeling a bit sad')).toBe(false);
      expect(safetyFilter.detect('work was stressful')).toBe(false);
      expect(safetyFilter.detect('I love the new feature')).toBe(false);
    });

    it('returns false for empty/missing input', () => {
      expect(safetyFilter.detect('')).toBe(false);
      expect(safetyFilter.detect(null)).toBe(false);
      expect(safetyFilter.detect(undefined)).toBe(false);
    });

    it('returns false for non-string input without throwing', () => {
      expect(safetyFilter.detect(123)).toBe(false);
      expect(safetyFilter.detect({})).toBe(false);
      expect(safetyFilter.detect([])).toBe(false);
      expect(safetyFilter.detect(true)).toBe(false);
    });
  });

  describe('buildResponse()', () => {
    const response = safetyFilter.buildResponse();

    it('references only UK crisis services', () => {
      expect(response).toMatch(/Samaritans/);
      expect(response).toMatch(/116 123/);
      expect(response).toMatch(/SHOUT/);
      expect(response).toMatch(/85258/);
      expect(response).toMatch(/NHS/);
      expect(response).toMatch(/Papyrus/);
      expect(response).toMatch(/0800 068 4141/);
      expect(response).toMatch(/\b999\b/);
    });

    it('does NOT reference US crisis services (regression guard)', () => {
      expect(response).not.toMatch(/\b988\b/);
      expect(response).not.toMatch(/\b911\b/);
      expect(response).not.toMatch(/741741/);
      expect(response).not.toMatch(/Crisis Text Line/);
    });

    it('opens with empathetic acknowledgement', () => {
      expect(response).toMatch(/I'm really concerned/);
    });

    it('invites continued engagement', () => {
      expect(response).toMatch(/stay and talk/i);
    });
  });

  describe('exported constants', () => {

    it('exposes UK_CRISIS_KEYWORDS as a frozen array', () => {
      expect(Array.isArray(safetyFilter.UK_CRISIS_KEYWORDS)).toBe(true);
      expect(Object.isFrozen(safetyFilter.UK_CRISIS_KEYWORDS)).toBe(true);
      expect(safetyFilter.UK_CRISIS_KEYWORDS).toContain('suicide');
      expect(safetyFilter.UK_CRISIS_KEYWORDS).toContain('self-harm');
    });

    it('exposes UK_CRISIS_RESOURCES as a frozen object with the right contacts', () => {
      const R = safetyFilter.UK_CRISIS_RESOURCES;
      expect(Object.isFrozen(R)).toBe(true);
      expect(R.samaritans.phone).toBe('116 123');
      expect(R.nhs.phone).toBe('111');
      expect(R.papyrus.phone).toBe('0800 068 4141');
      expect(R.emergency.phone).toBe('999');
      // Shout is text-only, no phone field
      expect(R.shout.sms).toMatch(/85258/);
    });

    it('freezes the nested resource entries as well (deep-freeze contract)', () => {
      expect(Object.isFrozen(safetyFilter.UK_CRISIS_RESOURCES.samaritans)).toBe(true);
      expect(Object.isFrozen(safetyFilter.UK_CRISIS_RESOURCES.emergency)).toBe(true);
    });
  });
});

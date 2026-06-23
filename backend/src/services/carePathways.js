/**
 * UK step-up-to-care pathways (ADR-0013).
 *
 * SEPARATE from the frozen acute-crisis SafetyFilter (ADR-0003): this is the
 * "next level of help" signposting for ELEVATED (not acute) escalations.
 * UK-only by design. The crisis tier REUSES SafetyFilter's resources verbatim
 * (never redefines them). National services only — the user enters their own
 * postcode on the NHS site, so no location is ever stored.
 */
const { UK_CRISIS_RESOURCES } = require('./safetyFilter');

const NHS_TALKING_THERAPIES = Object.freeze({
  name: 'NHS Talking Therapies',
  url: 'https://www.nhs.uk/service-search/mental-health/find-an-NHS-talking-therapies-service',
  note: 'free NHS therapy for anxiety & depression — you can refer yourself, no GP needed',
});

const GP = Object.freeze({
  name: 'Your GP',
  note: 'can discuss options, refer you, and review any medication',
});

/** Acute-crisis resources, flattened from the frozen SafetyFilter (not redefined). */
function crisisResources() {
  const R = UK_CRISIS_RESOURCES;
  return [
    { name: R.samaritans.name, phone: R.samaritans.phone, note: R.samaritans.note },
    { name: R.nhs.name, phone: R.nhs.phone, note: R.nhs.note },
    { name: R.emergency.name, phone: R.emergency.phone, note: R.emergency.note },
  ];
}

/** Step-up-to-care for the ELEVATED tier: self-referral therapy + GP + Samaritans backup. */
function stepUpPathways() {
  const R = UK_CRISIS_RESOURCES;
  return [
    NHS_TALKING_THERAPIES,
    GP,
    { name: R.samaritans.name, phone: R.samaritans.phone, note: 'if things feel urgent — free, 24/7' },
  ];
}

/** MONITOR tier: light self-care signposting only. */
function selfCarePathways() {
  return [
    { name: 'Keep checking in', note: 'regular tracking helps you (and any clinician) see the trend' },
    NHS_TALKING_THERAPIES, // available with no pressure
  ];
}

module.exports = {
  NHS_TALKING_THERAPIES,
  GP,
  crisisResources,
  stepUpPathways,
  selfCarePathways,
};

/**
 * Reliable Change Index (RCI) — Jacobson & Truax (1991).
 *
 * Distinguishes clinically meaningful change on a validated screening
 * instrument from measurement noise. RCI = (recent - previous) / S_diff;
 * a change is "reliable" when |RCI| >= 1.96 (95% confidence, two-tailed).
 *
 * Pure module — no I/O, no persistence. See docs/adr/0011-reliable-change-index.md
 * for the decision, polarity handling, and the literature sources for S_diff.
 */

// Standard error of the difference per instrument (literature-anchored — see ADR-0011).
const SDIFF = {
  PHQ9: 2.43, // Kroenke 2001 (alpha ~= 0.89)
  GAD7: 2.33, // Spitzer 2006 (alpha ~= 0.92)
  PSS4: 1.70, // Cohen 1988
  ISI: 3.39, // Bastien 2001 (alpha ~= 0.86)
  WEMWBS: 4.67, // Tennant 2007 (alpha ~= 0.91)
};

// Instruments where a HIGHER score means WORSE (more symptom burden).
// WEMWBS is the exception: higher = better wellbeing.
const HIGHER_IS_WORSE = {
  PHQ9: true,
  GAD7: true,
  PSS4: true,
  ISI: true,
  WEMWBS: false,
};

const RCI_THRESHOLD = 1.96; // 95% two-tailed normal deviate

const DIRECTION = {
  IMPROVEMENT: 'reliable_improvement',
  DETERIORATION: 'reliable_deterioration',
  NONE: 'no_reliable_change',
};

/**
 * Normalise an instrument identifier to the canonical key used above.
 * Accepts "PHQ-9", "phq9", "PHQ9", etc.
 */
function normaliseInstrument(instrument) {
  if (instrument == null) return null;
  return String(instrument).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Compute the Reliable Change Index between two scores of the same instrument.
 *
 * @param {string} instrument - e.g. "PHQ9" / "PHQ-9" / "WEMWBS"
 * @param {number} prevScore  - the earlier (older) total score
 * @param {number} recentScore- the later (newer) total score
 * @returns {null | {
 *   rci: number, sdiff: number, delta: number, threshold: number,
 *   is_reliable: boolean, direction: string
 * }} null if the instrument is unknown or either score is missing/non-finite.
 */
function computeRCI(instrument, prevScore, recentScore) {
  const key = normaliseInstrument(instrument);
  const sdiff = SDIFF[key];
  if (sdiff == null) return null;
  if (!Number.isFinite(prevScore) || !Number.isFinite(recentScore)) return null;

  const delta = recentScore - prevScore; // raw change (recent minus previous)
  const rci = delta / sdiff; // signed RCI statistic
  const isReliable = Math.abs(rci) >= RCI_THRESHOLD;

  let direction = DIRECTION.NONE;
  if (isReliable) {
    const gotWorse = HIGHER_IS_WORSE[key] ? delta > 0 : delta < 0;
    direction = gotWorse ? DIRECTION.DETERIORATION : DIRECTION.IMPROVEMENT;
  }

  return {
    rci: Math.round(rci * 100) / 100, // 2 dp for display
    sdiff,
    delta,
    threshold: RCI_THRESHOLD,
    is_reliable: isReliable,
    direction,
  };
}

module.exports = {
  computeRCI,
  normaliseInstrument,
  SDIFF,
  HIGHER_IS_WORSE,
  RCI_THRESHOLD,
  DIRECTION,
};

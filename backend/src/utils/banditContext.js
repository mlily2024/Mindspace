/**
 * banditContext — builds the LinUCB context vector for micro-intervention
 * selection (C.1, ADR-0018). Pure: a mood entry + trigger + hour-of-day in,
 * a fixed-length normalised feature vector out.
 *
 * Dimensions (CONTEXT_DIM = 7):
 *   [ bias, mood, stress, anxiety, energy, sin(hour), cos(hour) ]
 * Mood/stress/anxiety/energy are 1..10 scales mapped to [0,1]; missing values
 * default to the neutral midpoint. Hour-of-day is encoded cyclically so 23:00
 * and 00:00 are close.
 */

const CONTEXT_DIM = 7;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Map a 1..10 scale value to [0,1]; default to neutral (0.5) when absent. */
function norm10(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return clamp01((n - 1) / 9);
}

/**
 * @param {object} moodEntry { mood_score, stress_level, anxiety_level, energy_level }
 * @param {string} [trigger] unused in v1 features (kept for signature stability)
 * @param {number} [hourOfDay] 0..23; defaults to 12 (neutral midday) when absent
 * @returns {number[]} length CONTEXT_DIM
 */
function buildContextVector(moodEntry = {}, trigger = null, hourOfDay = 12) {
  void trigger; // reserved: a trigger one-hot could be appended in a later version
  const h = Number.isFinite(Number(hourOfDay)) ? Number(hourOfDay) : 12;
  const angle = (2 * Math.PI * (((h % 24) + 24) % 24)) / 24;
  return [
    1,
    norm10(moodEntry.mood_score),
    norm10(moodEntry.stress_level),
    norm10(moodEntry.anxiety_level),
    norm10(moodEntry.energy_level),
    Math.sin(angle),
    Math.cos(angle),
  ];
}

module.exports = { buildContextVector, CONTEXT_DIM, norm10 };

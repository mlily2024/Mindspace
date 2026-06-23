/**
 * Protocol adaptation layer (C.2).
 *
 * Pure pacing logic: given a user's recent session completions for a protocol,
 * decide whether the NEXT session should be framed to ease off, stretch, or stay
 * steady. This is a *framing/pacing* layer — it never rewrites the evidence-based
 * protocol content (which stays frozen), it only attaches guidance the UI surfaces
 * before the user starts the next session.
 *
 * Primary signal: difficulty_rating (1 Very Easy … 5 Very Hard) of the most recent
 * completed session, smoothed lightly against the prior one so a single outlier
 * doesn't whipsaw the pacing. Mood change (mood_after - mood_before) is a secondary
 * softener for the "ease" message only.
 *
 * Returns null when there is no adaptation to make (no history yet, or the user is
 * pacing comfortably) so the UI stays uncluttered — a banner appears only when there
 * is a genuine adjustment to offer.
 *
 * Clinical guardrails:
 *   - This is pacing, not triage. It must NOT surface crisis content or attempt risk
 *     assessment — that is careEscalationService's job (ADR-0013) and the frozen
 *     SafetyFilter's (ADR-0003). Adaptation only ever softens or extends; it never
 *     pushes a struggling user forward.
 */

const DIFFICULTY_LABELS = ['Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard'];

// A session at/above this difficulty means "ease off"; at/below means "offer a stretch".
const HARD_THRESHOLD = 4;
const EASY_THRESHOLD = 2;

// Look back at most this many recent sessions when smoothing.
const WINDOW = 2;

const clampRating = (r) => {
  if (r === null || r === undefined || r === '') return null;
  const n = Number(r);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.round(n)));
};

const labelFor = (rating) => DIFFICULTY_LABELS[rating - 1] || 'Moderate';

/**
 * @param {Array<{difficulty_rating:number, mood_before?:number, mood_after?:number,
 *                session_number?:number}>} completions
 *        Recent completions for one enrollment, MOST RECENT FIRST.
 * @returns {null | {
 *   level: 'ease' | 'stretch',
 *   title: string,
 *   message: string,
 *   basis: { lastDifficulty: number, lastDifficultyLabel: string, smoothed: number, window: number }
 * }}
 */
function computeAdaptation(completions) {
  if (!Array.isArray(completions) || completions.length === 0) return null;

  const recent = completions
    .slice(0, WINDOW)
    .map((c) => clampRating(c.difficulty_rating))
    .filter((r) => r !== null);

  if (recent.length === 0) return null;

  const last = recent[0];
  // Light smoothing: average the last <=2 ratings, but let the most recent dominate
  // by rounding toward it. This keeps a one-off spike from over-steering.
  const smoothed = recent.reduce((a, b) => a + b, 0) / recent.length;

  if (smoothed >= HARD_THRESHOLD) {
    // Secondary softener: did the most recent session also leave them feeling worse?
    const top = completions[0] || {};
    const moodDelta =
      Number.isFinite(Number(top.mood_after)) && Number.isFinite(Number(top.mood_before))
        ? Number(top.mood_after) - Number(top.mood_before)
        : null;

    let message =
      'The last session felt challenging. Take this one gently — there is no rush. ' +
      'It is completely fine to spread it over more time, or to revisit the previous skill before moving on.';
    if (moodDelta !== null && moodDelta <= -2) {
      message +=
        ' If sessions are consistently leaving you feeling worse, consider pausing and talking it through with someone you trust.';
    }

    return {
      level: 'ease',
      title: 'Taking it gently',
      message,
      basis: { lastDifficulty: last, lastDifficultyLabel: labelFor(last), smoothed, window: recent.length },
    };
  }

  if (smoothed <= EASY_THRESHOLD) {
    return {
      level: 'stretch',
      title: 'Ready for a little more?',
      message:
        'You have found recent sessions manageable. If you would like, there is room to go a little deeper this ' +
        'time — spend longer on the exercise, or apply the skill to a harder situation. Only if it feels right.',
      basis: { lastDifficulty: last, lastDifficultyLabel: labelFor(last), smoothed, window: recent.length },
    };
  }

  // Pacing comfortably — no banner.
  return null;
}

module.exports = { computeAdaptation, DIFFICULTY_LABELS, HARD_THRESHOLD, EASY_THRESHOLD, WINDOW };

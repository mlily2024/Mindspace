/**
 * Validated screening instruments — questions, scoring, severity tiers.
 *
 * All five instruments are free for clinical / research / commercial use:
 *
 *   PHQ-9   — Kroenke, Spitzer, Williams. Released by Pfizer; no permission
 *             needed for use, reproduction, translation, or display.
 *             Ref: phqscreeners.com
 *   GAD-7   — Spitzer, Kroenke, Williams, Löwe. Released by Pfizer; same
 *             open-use terms as PHQ-9.
 *             Ref: phqscreeners.com
 *   PSS-4   — Cohen et al, 1988. 4-item short form of the Perceived Stress
 *             Scale. Public-domain since publication.
 *             Ref: Cohen S, Williamson G. Perceived stress in a probability
 *             sample of the United States. In: Spacapam S, Oskamp S, eds.
 *             The Social Psychology of Health. Sage; 1988.
 *   ISI     — Bastien, Vallières, Morin, 2001. Insomnia Severity Index.
 *             Public clinical instrument.
 *             Ref: Sleep Medicine 2(4):297-307
 *   WEMWBS  — Warwick-Edinburgh Mental Wellbeing Scale. Free for research,
 *             public, and clinical use under a registration agreement
 *             (warwick.ac.uk/fac/sci/med/research/platform/wemwbs).
 *             We use the 14-item version.
 *
 * Server-side definitions because (a) the question wording is fixed,
 * validated, and changes would invalidate the instrument; (b) the frontend
 * fetches them via GET /api/assessments/:instrument; (c) keeping them on
 * the server makes future translations and accessibility tweaks a single
 * deployment, not a frontend rebuild.
 *
 * Severity tier names follow the published bands for each instrument.
 * scoreResponses() returns { total_score, severity_tier, has_crisis_flag }.
 */

// --- PHQ-9 ----------------------------------------------------------------

const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling or staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
  'Trouble concentrating on things, such as reading the newspaper or watching television',
  'Moving or speaking so slowly that other people could have noticed, or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
  'Thoughts that you would be better off dead, or of hurting yourself in some way',
];

const PHQ9_RESPONSE_LABELS = [
  'Not at all', 'Several days', 'More than half the days', 'Nearly every day',
];

// Q9 (index 8) is the suicidal-ideation item. ANY value ≥ 1 fires the crisis flag.
const PHQ9_CRISIS_INDEX = 8;
const PHQ9_CRISIS_THRESHOLD = 1;

const phq9Severity = (total) => {
  if (total >= 20) return 'severe';
  if (total >= 15) return 'moderately_severe';
  if (total >= 10) return 'moderate';
  if (total >= 5)  return 'mild';
  return 'minimal';
};

// --- GAD-7 ----------------------------------------------------------------

const GAD7_QUESTIONS = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid, as if something awful might happen',
];

const GAD7_RESPONSE_LABELS = PHQ9_RESPONSE_LABELS;

const gad7Severity = (total) => {
  if (total >= 15) return 'severe';
  if (total >= 10) return 'moderate';
  if (total >= 5)  return 'mild';
  return 'minimal';
};

// --- PSS-4 ----------------------------------------------------------------

const PSS4_QUESTIONS = [
  'In the last month, how often have you felt that you were unable to control the important things in your life?',
  'In the last month, how often have you felt confident about your ability to handle your personal problems?',
  'In the last month, how often have you felt that things were going your way?',
  'In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?',
];

const PSS4_RESPONSE_LABELS = [
  'Never', 'Almost never', 'Sometimes', 'Fairly often', 'Very often',
];
// Items 2 and 3 (indices 1, 2) are positively worded; reverse-score 4 - value.
const PSS4_REVERSE_ITEMS = new Set([1, 2]);

const pss4Severity = (total) => {
  if (total >= 13) return 'high';
  if (total >= 7)  return 'moderate';
  return 'low';
};

// --- ISI ------------------------------------------------------------------

const ISI_QUESTIONS = [
  'Difficulty falling asleep',
  'Difficulty staying asleep',
  'Problem waking up too early',
  'How satisfied / dissatisfied are you with your current sleep pattern?',
  'How noticeable to others do you think your sleep problem is in terms of impairing the quality of your life?',
  'How worried / distressed are you about your current sleep problem?',
  'To what extent do you consider your sleep problem to interfere with your daily functioning (e.g. daytime fatigue, mood, ability to function at work / daily chores, concentration, memory, mood, etc.)?',
];

const ISI_RESPONSE_LABELS = [
  'None', 'Mild', 'Moderate', 'Severe', 'Very severe',
];

const isiSeverity = (total) => {
  if (total >= 22) return 'severe';
  if (total >= 15) return 'moderate';
  if (total >= 8)  return 'subthreshold';
  return 'absent';
};

// --- WEMWBS (Warwick-Edinburgh Mental Wellbeing Scale, 14-item) -----------

const WEMWBS_QUESTIONS = [
  'I have been feeling optimistic about the future',
  'I have been feeling useful',
  'I have been feeling relaxed',
  'I have been feeling interested in other people',
  'I have had energy to spare',
  'I have been dealing with problems well',
  'I have been thinking clearly',
  'I have been feeling good about myself',
  'I have been feeling close to other people',
  'I have been feeling confident',
  'I have been able to make up my own mind about things',
  'I have been feeling loved',
  'I have been interested in new things',
  'I have been feeling cheerful',
];

const WEMWBS_RESPONSE_LABELS = [
  'None of the time', 'Rarely', 'Some of the time', 'Often', 'All of the time',
];

// WEMWBS uses 1-5 (not 0-4). Higher total = better wellbeing.
const wemwbsSeverity = (total) => {
  if (total >= 60) return 'high_wellbeing';
  if (total >= 41) return 'average_wellbeing';
  return 'low_wellbeing';
};

// --- Registry -------------------------------------------------------------

const INSTRUMENTS = {
  PHQ9: {
    name: 'PHQ-9',
    fullName: 'Patient Health Questionnaire (9-item)',
    description: 'Screens for depression severity over the last 2 weeks. Validated in primary care and specialty settings.',
    questions: PHQ9_QUESTIONS,
    responseLabels: PHQ9_RESPONSE_LABELS,
    responseRange: [0, 3],
    scoreRange: [0, 27],
    recommendedFrequencyDays: 7,
    citation: 'Kroenke K, Spitzer RL, Williams JBW. The PHQ-9: validity of a brief depression severity measure. J Gen Intern Med. 2001;16(9):606-613.',
    severityFn: phq9Severity,
    crisisIndex: PHQ9_CRISIS_INDEX,
    crisisThreshold: PHQ9_CRISIS_THRESHOLD,
  },
  GAD7: {
    name: 'GAD-7',
    fullName: 'Generalized Anxiety Disorder (7-item)',
    description: 'Screens for generalized anxiety disorder severity over the last 2 weeks.',
    questions: GAD7_QUESTIONS,
    responseLabels: GAD7_RESPONSE_LABELS,
    responseRange: [0, 3],
    scoreRange: [0, 21],
    recommendedFrequencyDays: 14,
    citation: 'Spitzer RL, Kroenke K, Williams JBW, Löwe B. A brief measure for assessing generalized anxiety disorder: the GAD-7. Arch Intern Med. 2006;166(10):1092-1097.',
    severityFn: gad7Severity,
  },
  PSS4: {
    name: 'PSS-4',
    fullName: 'Perceived Stress Scale (4-item)',
    description: 'Brief measure of perceived stress over the last month. Two items are reverse-scored (positively-worded).',
    questions: PSS4_QUESTIONS,
    responseLabels: PSS4_RESPONSE_LABELS,
    responseRange: [0, 4],
    scoreRange: [0, 16],
    recommendedFrequencyDays: 30,
    citation: 'Cohen S, Williamson G. Perceived stress in a probability sample of the United States. In: Spacapam S, Oskamp S, eds. The Social Psychology of Health. Sage; 1988.',
    severityFn: pss4Severity,
    reverseItems: PSS4_REVERSE_ITEMS,
  },
  ISI: {
    name: 'ISI',
    fullName: 'Insomnia Severity Index',
    description: 'Measures perceived severity of insomnia and its impact on daytime functioning over the last 2 weeks.',
    questions: ISI_QUESTIONS,
    responseLabels: ISI_RESPONSE_LABELS,
    responseRange: [0, 4],
    scoreRange: [0, 28],
    recommendedFrequencyDays: 14,
    citation: 'Bastien CH, Vallières A, Morin CM. Validation of the Insomnia Severity Index as an outcome measure for insomnia research. Sleep Med. 2001;2(4):297-307.',
    severityFn: isiSeverity,
  },
  WEMWBS: {
    name: 'WEMWBS',
    fullName: 'Warwick-Edinburgh Mental Wellbeing Scale (14-item)',
    description: 'Measures positive mental wellbeing over the last 2 weeks. Higher score = better wellbeing.',
    questions: WEMWBS_QUESTIONS,
    responseLabels: WEMWBS_RESPONSE_LABELS,
    responseRange: [1, 5],
    scoreRange: [14, 70],
    recommendedFrequencyDays: 14,
    citation: 'Tennant R, Hiller L, Fishwick R, et al. The Warwick-Edinburgh Mental Wellbeing Scale (WEMWBS): development and UK validation. Health Qual Life Outcomes. 2007;5:63.',
    severityFn: wemwbsSeverity,
  },
};

const getInstrument = (code) => INSTRUMENTS[code] || null;
const listInstrumentSummaries = () => Object.entries(INSTRUMENTS).map(([code, def]) => ({
  code,
  name: def.name,
  fullName: def.fullName,
  description: def.description,
  questionCount: def.questions.length,
  recommendedFrequencyDays: def.recommendedFrequencyDays,
  citation: def.citation,
}));

/**
 * Score a response array against the instrument's rules.
 * @param {string} code - instrument code (PHQ9 / GAD7 / PSS4 / ISI / WEMWBS)
 * @param {number[]} responses - integer per question
 * @returns {{ total_score: number, severity_tier: string, has_crisis_flag: boolean }}
 * @throws if code is unknown OR responses count mismatches the instrument
 */
const scoreResponses = (code, responses) => {
  const inst = getInstrument(code);
  if (!inst) throw new Error(`Unknown instrument code: ${code}`);
  if (!Array.isArray(responses) || responses.length !== inst.questions.length) {
    throw new Error(`Instrument ${code} expects ${inst.questions.length} responses; got ${responses?.length}`);
  }
  const [minR, maxR] = inst.responseRange;
  for (let i = 0; i < responses.length; i += 1) {
    const v = responses[i];
    if (!Number.isInteger(v) || v < minR || v > maxR) {
      throw new Error(`Instrument ${code} response ${i} out of range [${minR}, ${maxR}]: ${v}`);
    }
  }

  // Reverse-score positively-worded items if applicable (PSS-4 only currently).
  let total = 0;
  for (let i = 0; i < responses.length; i += 1) {
    const v = responses[i];
    if (inst.reverseItems && inst.reverseItems.has(i)) total += (maxR - v);
    else total += v;
  }

  const severity_tier = inst.severityFn(total);
  const has_crisis_flag = inst.crisisIndex !== undefined
    && responses[inst.crisisIndex] >= inst.crisisThreshold;

  return { total_score: total, severity_tier, has_crisis_flag };
};

module.exports = {
  INSTRUMENTS,
  getInstrument,
  listInstrumentSummaries,
  scoreResponses,
};

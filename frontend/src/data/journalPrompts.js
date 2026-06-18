/**
 * Journal prompts — single source of truth shared between the guided
 * Journal flow (`pages/Journal.jsx`) and the history view
 * (`pages/JournalHistory.jsx`).
 *
 * Previously lived inline in Journal.jsx. Extracted on 2026-06-18 when
 * J1 (Journal history page) needed the same prompt → category / emoji /
 * colour mapping to render past entries with their prompt context.
 *
 * Each entry's `id` is what the backend stores as `prompt_id`; everything
 * else is presentation. Adding a new prompt: append to this array; both
 * pages will pick it up.
 */

export const JOURNAL_PROMPTS = [
  {
    id: 'gratitude',
    category: 'Gratitude',
    emoji: '🙏',
    color: '#A8C5A8',
    text: 'What are three things, big or small, that brought you a moment of peace today?',
    followUps: [
      'Why did each of these matter to you?',
      'How can you create more of these moments?',
    ],
  },
  {
    id: 'reflection',
    category: 'Reflection',
    emoji: '🪞',
    color: '#9B8AA5',
    text: 'What emotion has been most present for you today? Where do you feel it in your body?',
    followUps: [
      'What might this emotion be trying to tell you?',
      'What does this feeling need right now?',
    ],
  },
  {
    id: 'cbt',
    category: 'Thought Challenge',
    emoji: '💭',
    color: '#F5C9B3',
    text: 'What thought has been bothering you most today? Let\'s examine it together.',
    followUps: [
      'What evidence supports this thought?',
      'What evidence challenges it?',
      'What would you tell a friend with this thought?',
    ],
  },
  {
    id: 'self_compassion',
    category: 'Self-Compassion',
    emoji: '💜',
    color: '#E8A5A5',
    text: 'If your best friend was going through exactly what you\'re experiencing, what would you say to them?',
    followUps: [
      'Can you offer yourself the same kindness?',
      'What do you need to hear right now?',
    ],
  },
  {
    id: 'goals',
    category: 'Looking Ahead',
    emoji: '🌱',
    color: '#F5D89A',
    text: 'What\'s one small thing you could do tomorrow that future-you would thank you for?',
    followUps: [
      'What might get in the way?',
      'How will you overcome that?',
    ],
  },
];

/** Find a prompt definition by stored id, fallback to a sane default. */
export const getPromptById = (id) =>
  JOURNAL_PROMPTS.find((p) => p.id === id) || {
    id: id || 'unknown',
    category: 'Entry',
    emoji: '📝',
    color: '#9B8AA5',
    text: '',
    followUps: [],
  };

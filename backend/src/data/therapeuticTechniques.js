/**
 * Therapeutic Techniques Library
 * Evidence-based interventions for Luna to offer
 */

const techniques = {
  breathing: {
    '4-7-8': {
      name: '4-7-8 Breathing',
      description: 'A calming technique to reduce anxiety and promote relaxation',
      steps: [
        'Find a comfortable position',
        'Breathe in quietly through your nose for 4 seconds',
        'Hold your breath for 7 seconds',
        'Exhale completely through your mouth for 8 seconds',
        'Repeat 3-4 times'
      ],
      duration: 4,
      forEmotions: ['anxiety', 'panic', 'stressed', 'overwhelmed']
    },
    box: {
      name: 'Box Breathing',
      description: 'A grounding technique used by Navy SEALs for staying calm under pressure',
      steps: [
        'Breathe in for 4 seconds',
        'Hold for 4 seconds',
        'Breathe out for 4 seconds',
        'Hold for 4 seconds',
        'Repeat 4 times'
      ],
      duration: 4,
      forEmotions: ['anxiety', 'overwhelmed', 'angry', 'stressed']
    },
    calming: {
      name: 'Calming Breath',
      description: 'Simple technique for quick relief',
      steps: [
        'Breathe in slowly for 4 seconds',
        'Breathe out slowly for 6 seconds',
        'Focus only on your breath',
        'Repeat 5-6 times'
      ],
      duration: 3,
      forEmotions: ['anxiety', 'nervous', 'tense']
    }
  },

  grounding: {
    '5-4-3-2-1': {
      name: '5-4-3-2-1 Senses',
      description: 'Grounding technique to bring you back to the present moment',
      steps: [
        'Name 5 things you can see',
        'Name 4 things you can touch',
        'Name 3 things you can hear',
        'Name 2 things you can smell',
        'Name 1 thing you can taste'
      ],
      forEmotions: ['anxiety', 'dissociation', 'panic', 'overwhelmed']
    },
    physicalGrounding: {
      name: 'Physical Grounding',
      description: 'Connect with your body and surroundings',
      steps: [
        'Press your feet firmly into the floor',
        'Notice the sensation of your body against the chair',
        'Touch something with an interesting texture',
        'Take three slow, deliberate breaths',
        'Gently stretch your arms and neck'
      ],
      forEmotions: ['dissociation', 'anxiety', 'floating', 'unreal']
    }
  },

  cognitive: {
    thoughtChallenge: {
      name: 'Thought Challenge',
      description: 'Examine unhelpful thoughts with compassion',
      prompts: [
        'What evidence supports this thought?',
        'What evidence contradicts it?',
        'What would you tell a friend thinking this?',
        'Is there another way to look at this situation?',
        'What\'s the most balanced way to see this?'
      ],
      forEmotions: ['depression', 'anxiety', 'negative', 'self_critical']
    },
    worrySifting: {
      name: 'Worry Sifting',
      description: 'Sort worries into actionable and non-actionable',
      prompts: [
        'Is this something I can actually control?',
        'If yes, what\'s one small step I could take?',
        'If no, can I practice letting this go for now?',
        'Is this worry about the future or past?',
        'What would help me feel even 1% better right now?'
      ],
      forEmotions: ['anxiety', 'worried', 'overthinking']
    }
  },

  behavioural: {
    behaviouralActivation: {
      name: 'Small Win',
      description: 'One tiny action to shift your state',
      suggestions: [
        'Drink a glass of water',
        'Step outside for 60 seconds',
        'Send one text to someone you care about',
        'Open a window and take 3 deep breaths',
        'Stretch for 30 seconds',
        'Make your bed or tidy one small area',
        'Listen to one song you love',
        'Wash your face with cool water'
      ],
      forEmotions: ['depression', 'low_energy', 'unmotivated', 'stuck']
    },
    oppositeAction: {
      name: 'Opposite Action',
      description: 'Act opposite to the unhelpful urge',
      examples: [
        'Feeling like isolating? → Send one message to a friend',
        'Feeling like giving up? → Do one tiny task',
        'Feeling like avoiding? → Take one small step toward it',
        'Feeling like staying in bed? → Get up for just 5 minutes'
      ],
      forEmotions: ['depression', 'avoidance', 'low', 'withdrawn']
    }
  },

  selfCompassion: {
    kindWords: {
      name: 'Kind Words',
      description: 'Speak to yourself as you would a dear friend',
      prompts: [
        'What do I need to hear right now?',
        'How would I comfort a friend feeling this way?',
        'Can I place my hand on my heart and offer myself kindness?'
      ],
      affirmations: [
        'This is a moment of difficulty, and that\'s okay.',
        'I\'m doing my best with what I have right now.',
        'I deserve compassion, especially from myself.',
        'It\'s okay to not be okay sometimes.',
        'This feeling will pass. I\'ve survived difficult times before.',
        'I am enough, exactly as I am in this moment.'
      ],
      forEmotions: ['self_critical', 'shame', 'guilt', 'sad', 'depression']
    }
  }
};

/**
 * Get techniques appropriate for a detected emotion
 */
const getTechniquesForEmotion = (emotion) => {
  const suitable = [];

  Object.entries(techniques).forEach(([category, categoryTechniques]) => {
    Object.entries(categoryTechniques).forEach(([key, technique]) => {
      if (technique.forEmotions?.includes(emotion)) {
        suitable.push({
          category,
          key,
          ...technique
        });
      }
    });
  });

  return suitable;
};

/**
 * Get a random affirmation
 */
const getRandomAffirmation = () => {
  const affirmations = techniques.selfCompassion.kindWords.affirmations;
  return affirmations[Math.floor(Math.random() * affirmations.length)];
};

/**
 * Get a random small win suggestion
 */
const getRandomSmallWin = () => {
  const suggestions = techniques.behavioural.behaviouralActivation.suggestions;
  return suggestions[Math.floor(Math.random() * suggestions.length)];
};

module.exports = {
  techniques,
  getTechniquesForEmotion,
  getRandomAffirmation,
  getRandomSmallWin
};

const ChatbotMessage = require('../models/ChatbotMessage');
const logger = require('../config/logger');
const { techniques, getTechniquesForEmotion, getRandomAffirmation, getRandomSmallWin } = require('../data/therapeuticTechniques');

/**
 * Luna - AI Wellness Companion
 * Enhanced with crisis detection, conversation memory, and therapeutic techniques
 */

// Emotion patterns for detection (ordered by priority)
const emotionPatterns = {
  crisis: /\b(suicide|suicidal|kill myself|end my life|end it all|want to die|don't want to live|no reason to live|better off dead|can't go on|give up on life|self.?harm|cut myself|hurt myself|ending it|final goodbye)\b/i,
  anxiety: /\b(anxious|anxiety|worried|worrying|nervous|panic|panicking|scared|fear|frightened|terrified|overwhelmed|racing thoughts|can't calm down|heart racing|chest tight|can't breathe|spiraling|doom|dread|on edge)\b/i,
  depression: /\b(depressed|depression|sad|miserable|hopeless|empty|worthless|numb|nothing matters|no point|tired of everything|exhausted|drained|lonely|alone|crying|can't stop crying|no motivation|don't care anymore|giving up|low mood)\b/i,
  angry: /\b(angry|furious|frustrated|annoyed|irritated|mad|rage|hate|pissed|fed up|livid|fuming|seething|resentful)\b/i,
  stressed: /\b(stressed|stress|pressure|too much|overwhelmed|burnt out|burnout|can't cope|breaking point|falling apart|deadline|workload|swamped)\b/i,
  positive: /\b(happy|great|wonderful|amazing|good|fantastic|excited|grateful|thankful|blessed|joyful|content|peaceful|better|improving|hopeful|optimistic|proud)\b/i,
  tired: /\b(tired|exhausted|sleepy|fatigued|drained|no energy|worn out|wiped|can't sleep|insomnia|restless|sluggish)\b/i,
  confused: /\b(confused|lost|uncertain|don't know|unsure|mixed feelings|conflicted|torn|indecisive)\b/i,
  lonely: /\b(lonely|isolated|disconnected|no friends|no one understands|alone in this|nobody cares|invisible)\b/i,
  guilty: /\b(guilty|ashamed|shame|regret|my fault|blame myself|should have|shouldn't have)\b/i
};

// Crisis response - immediate support with UK resources
const crisisResponse = {
  immediate: `I'm really concerned about what you've shared, and I want you to know that you matter. You're not alone in this.

Please reach out to these services right now - they have people who understand and want to help:

**Immediate Support (UK):**
- **Samaritans:** 116 123 (free, 24/7)
- **Text SHOUT:** Text "SHOUT" to 85258
- **NHS Crisis Line:** 111, then press 2
- **Papyrus (under 35):** 0800 068 4141

I'm here with you. Would you like me to stay and talk while you consider reaching out?`,

  followUp: `I'm still here with you. Whatever you're feeling right now is valid, and there are people who specialise in helping with exactly this.

Is there anything specific that's brought you to this point? Sometimes just sharing can help lighten the load.`
};

// Luna's enhanced response templates
const responses = {
  greeting: [
    "Hi there! I'm Luna, your wellness companion. How are you feeling right now?",
    "Hello! It's lovely to see you. What's on your mind today?",
    "Hey! I'm here whenever you need to talk. How's your day going?",
    "Welcome back! I'm here to listen. How are you doing?"
  ],

  anxiety: [
    "I hear that you're feeling anxious. That can be really uncomfortable, but you're safe right now. Would you like to try a breathing exercise together?",
    "Anxiety can feel so overwhelming sometimes. Let's take this moment by moment. Would a grounding exercise help right now?",
    "Those anxious feelings are your mind trying to protect you, even when the danger isn't real. I'm here with you. What would feel most helpful - breathing, grounding, or just talking?",
    "I understand how challenging anxiety can be. You're doing something brave by reaching out. Would you like to try the 5-4-3-2-1 grounding technique?"
  ],

  depression: [
    "I'm so sorry you're feeling this way. It takes real courage to acknowledge these feelings. I'm here with you - there's no rush.",
    "Those feelings of sadness are valid, and you don't have to face them alone. What would feel supportive right now?",
    "When everything feels heavy, even small steps matter. Would you like to try a tiny action together, or would you prefer to just talk?",
    "Depression can make everything feel impossible. But you reached out, and that's something. Would a gentle affirmation help, or would you rather vent?"
  ],

  angry: [
    "I can sense some frustration there, and that's completely valid. Would you like to vent about what happened?",
    "Anger often tells us something important about our boundaries. What's been going on?",
    "Those feelings are real and valid. Sometimes we need to let the steam out. I'm here to listen without judgment.",
    "It sounds like something really bothered you. Would you like to talk it through, or would a breathing exercise help first?"
  ],

  stressed: [
    "It sounds like you're carrying a heavy load right now. Let's see if we can make it feel a bit lighter. What's weighing on you most?",
    "Stress can really build up. Sometimes breaking things down into smaller pieces helps. Would you like to try that together?",
    "I hear you - being stressed is exhausting. Would a quick grounding exercise help reset, or would you prefer to talk about what's happening?",
    "When everything feels urgent, it helps to pause. You're doing that now. What feels most pressing?"
  ],

  positive: [
    "That's wonderful to hear! Celebrating the good moments is so important. What's been going well?",
    "I'm so glad you're feeling positive! Would you like to capture this moment by reflecting on what contributed to it?",
    "Your positive energy is lovely! These feelings build resilience for when things get tough. What's making today good?",
    "It's great to hear you're doing well! I'm here whether things are good or challenging."
  ],

  tired: [
    "Feeling drained is your body asking for rest. Have you been able to get enough sleep lately?",
    "It's okay to feel tired. Our energy naturally ebbs and flows. What do you think might help recharge you?",
    "That exhaustion is real. Be gentle with yourself. Is there anything you could take off your plate today?",
    "Sometimes our bodies need rest more than we realise. What feels most tiring right now?"
  ],

  confused: [
    "It sounds like things feel unclear right now. That's a really uncomfortable place to be. Would it help to talk through what's going on?",
    "When we're feeling confused, it often helps to slow down and take things one at a time. What's the main thing weighing on you?",
    "Mixed feelings can be so exhausting. There's no rush to figure everything out. What feels most pressing right now?",
    "Uncertainty is hard. Sometimes writing things down helps organise thoughts. Would you like to talk it out?"
  ],

  lonely: [
    "Feeling disconnected is so painful. I want you to know that reaching out here is a real connection, and I'm glad you did.",
    "Loneliness can feel overwhelming, but you're not truly alone - you reached out, and I'm here with you.",
    "It takes courage to share that you're feeling lonely. What would help you feel more connected right now?",
    "I hear you. Feeling invisible is one of the hardest experiences. What's been going on?"
  ],

  guilty: [
    "It sounds like you're being really hard on yourself. Everyone makes mistakes - that's part of being human. What happened?",
    "That guilt sounds heavy to carry. Sometimes we need to examine whether we're being fair to ourselves. Would you like to talk about it?",
    "Self-compassion can be so hard when we feel we've done something wrong. What would you say to a friend in your situation?",
    "Guilt often comes from caring deeply. That's not a bad thing. Can you tell me more about what's weighing on you?"
  ],

  neutral: [
    "I'm here and listening. Feel free to share whatever's on your mind.",
    "How has your day been so far? Sometimes just talking things through can help.",
    "What brings you here today? I'd love to hear how you're doing.",
    "I'm here whenever you need to talk. What's going on?"
  ],

  encouragement: [
    "You're doing something really valuable by taking time to check in with yourself.",
    "Remember, it's okay not to be okay sometimes. What matters is that you're here.",
    "Every step you take toward understanding yourself is progress.",
    "I'm proud of you for reaching out. That takes courage."
  ],

  farewell: [
    "Take care of yourself. Remember, I'm here whenever you need to talk.",
    "Thank you for sharing with me. Be gentle with yourself today.",
    "I'm glad we could chat. Come back anytime you need a friendly ear.",
    "Take it one moment at a time. You've got this, and I'm always here."
  ]
};

/**
 * Detect emotion from message text
 */
const detectEmotion = (text) => {
  const lowerText = text.toLowerCase();

  // Check patterns in priority order
  for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
    if (pattern.test(lowerText)) {
      return emotion;
    }
  }

  return 'neutral';
};

/**
 * Get random response from array
 */
const getRandomResponse = (responseArray) => {
  if (Array.isArray(responseArray)) {
    return responseArray[Math.floor(Math.random() * responseArray.length)];
  }
  return responseArray;
};

/**
 * Format breathing exercise for chat
 */
const formatBreathingExercise = (technique) => {
  const t = techniques.breathing[technique] || techniques.breathing['4-7-8'];
  return {
    type: 'breathing_exercise',
    content: `**${t.name}**\n${t.description}\n\n${t.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\nTake your time with this. How do you feel after?`
  };
};

/**
 * Format grounding exercise for chat
 */
const formatGroundingExercise = (technique) => {
  const t = techniques.grounding[technique] || techniques.grounding['5-4-3-2-1'];
  return {
    type: 'grounding',
    content: `**${t.name}**\n${t.description}\n\n${t.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\nThis helps bring you back to the present moment. Try it now if you'd like.`
  };
};

/**
 * Generate Luna's response based on user message and context
 */
const generateResponse = (userMessage, conversationHistory = [], emotion = null) => {
  const lowerMessage = userMessage.toLowerCase().trim();
  const detectedEmotion = emotion || detectEmotion(userMessage);

  // Handle crisis situations first - ALWAYS prioritise safety
  if (detectedEmotion === 'crisis') {
    return {
      type: 'crisis',
      content: crisisResponse.immediate,
      emotion: 'crisis',
      showResources: true
    };
  }

  // Check for specific technique requests
  if (lowerMessage.includes('breathing') || lowerMessage.includes('breath') || lowerMessage.includes('breathe')) {
    return formatBreathingExercise('4-7-8');
  }

  if (lowerMessage.includes('ground') || lowerMessage.includes('5-4-3-2-1') || lowerMessage.includes('present')) {
    return formatGroundingExercise('5-4-3-2-1');
  }

  if (lowerMessage.includes('affirmation') || lowerMessage.includes('positive') || lowerMessage.includes('encourage')) {
    return {
      type: 'affirmation',
      content: getRandomAffirmation()
    };
  }

  if (lowerMessage.includes('something small') || lowerMessage.includes('small step') || lowerMessage.includes('tiny action')) {
    const suggestion = getRandomSmallWin();
    return {
      type: 'text',
      content: `Here's one small thing you could try: **${suggestion}**\n\nSmall actions can shift our state more than we expect. No pressure - only if it feels right.`
    };
  }

  // Farewell responses
  if (/\b(bye|goodbye|thanks|thank you|that's all|gotta go)\b/i.test(lowerMessage)) {
    return {
      type: 'text',
      content: getRandomResponse(responses.farewell)
    };
  }

  // Greeting responses
  if (/\b(hi|hello|hey|morning|afternoon|evening)\b/i.test(lowerMessage) || conversationHistory.length === 0) {
    if (conversationHistory.length === 0) {
      return {
        type: 'text',
        content: getRandomResponse(responses.greeting)
      };
    }
  }

  // Build response based on detected emotion
  let response = getRandomResponse(responses[detectedEmotion] || responses.neutral);

  // Add encouragement sometimes for difficult emotions
  if (['anxiety', 'depression', 'stressed', 'tired'].includes(detectedEmotion)) {
    if (Math.random() > 0.6) {
      response += '\n\n' + getRandomResponse(responses.encouragement);
    }
  }

  // Suggest relevant techniques for specific emotions
  if (detectedEmotion === 'anxiety' && conversationHistory.length > 1) {
    response += '\n\nI can guide you through a breathing exercise or grounding technique if you\'d like. Just say the word.';
  }

  if (detectedEmotion === 'depression' && conversationHistory.length > 1) {
    response += '\n\nWould an affirmation help, or would you like to try one small action together?';
  }

  return {
    type: 'text',
    content: response,
    emotion: detectedEmotion
  };
};

/**
 * Start or continue a conversation
 */
const chat = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Get or create active conversation
    let conversation = await ChatbotMessage.getActiveConversation(userId);

    if (!conversation) {
      conversation = await ChatbotMessage.startConversation(userId);
    }

    // Get conversation history for context
    const history = await ChatbotMessage.getMessages(conversation.conversation_id, 10);

    // Detect emotion
    const detectedEmotion = detectEmotion(message);

    // Log crisis for safety monitoring (no personal data stored)
    if (detectedEmotion === 'crisis') {
      logger.warn('Crisis keywords detected in chat', {
        userId,
        conversationId: conversation.conversation_id,
        timestamp: new Date().toISOString()
      });
    }

    // Save user message
    await ChatbotMessage.saveMessage(
      conversation.conversation_id,
      userId,
      'user',
      message,
      'text',
      detectedEmotion
    );

    // Generate Luna's response
    const lunaResponse = generateResponse(message, history, detectedEmotion);

    // Save Luna's response
    const savedResponse = await ChatbotMessage.saveMessage(
      conversation.conversation_id,
      userId,
      'luna',
      lunaResponse.content,
      lunaResponse.type || 'text',
      null
    );

    res.json({
      success: true,
      data: {
        conversationId: conversation.conversation_id,
        message: {
          id: savedResponse.message_id,
          sender: 'luna',
          content: lunaResponse.content,
          type: lunaResponse.type || 'text',
          timestamp: savedResponse.created_at
        },
        emotionDetected: detectedEmotion,
        showResources: lunaResponse.showResources || false
      }
    });

  } catch (error) {
    logger.error('Chatbot: Chat error', { error: error.message });
    next(error);
  }
};

/**
 * Get conversation history
 */
const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const conversation = await ChatbotMessage.getActiveConversation(userId);

    if (!conversation) {
      return res.json({
        success: true,
        data: {
          messages: [],
          conversationId: null
        }
      });
    }

    const messages = await ChatbotMessage.getMessages(conversation.conversation_id);

    res.json({
      success: true,
      data: {
        conversationId: conversation.conversation_id,
        messages: messages.map(m => ({
          id: m.message_id,
          sender: m.sender,
          content: m.message_content,
          type: m.message_type,
          timestamp: m.created_at
        }))
      }
    });

  } catch (error) {
    logger.error('Chatbot: Get history error', { error: error.message });
    next(error);
  }
};

/**
 * Start a new conversation
 */
const newConversation = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    // End any active conversation
    const activeConversation = await ChatbotMessage.getActiveConversation(userId);
    if (activeConversation) {
      await ChatbotMessage.endConversation(activeConversation.conversation_id);
    }

    // Start new conversation
    const newConvo = await ChatbotMessage.startConversation(userId);

    // Send initial greeting
    const greeting = getRandomResponse(responses.greeting);
    await ChatbotMessage.saveMessage(
      newConvo.conversation_id,
      userId,
      'luna',
      greeting,
      'text',
      null
    );

    res.json({
      success: true,
      data: {
        conversationId: newConvo.conversation_id,
        message: {
          sender: 'luna',
          content: greeting,
          type: 'text',
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    logger.error('Chatbot: New conversation error', { error: error.message });
    next(error);
  }
};

/**
 * Get past conversations
 */
const getPastConversations = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const conversations = await ChatbotMessage.getRecentConversations(userId);

    res.json({
      success: true,
      data: {
        conversations
      }
    });

  } catch (error) {
    logger.error('Chatbot: Get past conversations error', { error: error.message });
    next(error);
  }
};

module.exports = {
  chat,
  getHistory,
  newConversation,
  getPastConversations
};

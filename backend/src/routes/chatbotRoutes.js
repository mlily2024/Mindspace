const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbotController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/chatbot/chat
 * @desc    Send a message to Luna and get a response
 * @access  Private
 */
router.post('/chat', chatbotController.chat);

/**
 * @route   GET /api/chatbot/history
 * @desc    Get current conversation history
 * @access  Private
 */
router.get('/history', chatbotController.getHistory);

/**
 * @route   POST /api/chatbot/new
 * @desc    Start a new conversation
 * @access  Private
 */
router.post('/new', chatbotController.newConversation);

/**
 * @route   GET /api/chatbot/conversations
 * @desc    Get past conversations
 * @access  Private
 */
router.get('/conversations', chatbotController.getPastConversations);

module.exports = router;

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const peerSupportController = require('../controllers/peerSupportController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// ==================== VALIDATION RULES ====================

const createGroupValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Group name must be 3-100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be under 500 characters'),
  body('groupType')
    .optional()
    .isIn(['student', 'professional', 'parent', 'elderly', 'general'])
    .withMessage('Invalid group type'),
  body('maxMembers')
    .optional()
    .isInt({ min: 2, max: 100 })
    .withMessage('Max members must be 2-100'),
  body('isModerated')
    .optional()
    .isBoolean()
    .withMessage('isModerated must be a boolean')
];

const joinGroupValidation = [
  param('groupId')
    .isUUID()
    .withMessage('Invalid group ID'),
  body('anonymousNickname')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Nickname must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Nickname can only contain letters, numbers, and underscores')
];

const sendMessageValidation = [
  param('groupId')
    .isUUID()
    .withMessage('Invalid group ID'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be 1-2000 characters')
];

const flagMessageValidation = [
  param('messageId')
    .isUUID()
    .withMessage('Invalid message ID'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason must be under 200 characters')
];

const moderateMessageValidation = [
  param('messageId')
    .isUUID()
    .withMessage('Invalid message ID'),
  body('action')
    .isIn(['approve', 'delete'])
    .withMessage('Action must be "approve" or "delete"')
];

// ==================== ALL ROUTES REQUIRE AUTHENTICATION ====================

router.use(authenticateToken);

// ==================== GROUP ROUTES ====================

// Get all available groups
router.get('/groups', peerSupportController.getGroups);

// Get user's joined groups
router.get('/my-groups', peerSupportController.getUserGroups);

// Get a specific group
router.get('/groups/:groupId',
  param('groupId').isUUID().withMessage('Invalid group ID'),
  validate,
  peerSupportController.getGroupById
);

// Create a new group
router.post('/groups',
  createGroupValidation,
  validate,
  peerSupportController.createGroup
);

// Join a group
router.post('/groups/:groupId/join',
  joinGroupValidation,
  validate,
  peerSupportController.joinGroup
);

// Leave a group
router.post('/groups/:groupId/leave',
  param('groupId').isUUID().withMessage('Invalid group ID'),
  validate,
  peerSupportController.leaveGroup
);

// Get group members
router.get('/groups/:groupId/members',
  param('groupId').isUUID().withMessage('Invalid group ID'),
  validate,
  peerSupportController.getGroupMembers
);

// Generate a nickname for a group
router.get('/groups/:groupId/generate-nickname',
  param('groupId').isUUID().withMessage('Invalid group ID'),
  validate,
  peerSupportController.generateNickname
);

// ==================== MESSAGE ROUTES ====================

// Get messages from a group
router.get('/groups/:groupId/messages',
  param('groupId').isUUID().withMessage('Invalid group ID'),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('before').optional().isISO8601(),
  query('after').optional().isISO8601(),
  validate,
  peerSupportController.getMessages
);

// Send a message to a group
router.post('/groups/:groupId/messages',
  sendMessageValidation,
  validate,
  peerSupportController.sendMessage
);

// Flag a message
router.post('/messages/:messageId/flag',
  flagMessageValidation,
  validate,
  peerSupportController.flagMessage
);

// Delete own message
router.delete('/messages/:messageId',
  param('messageId').isUUID().withMessage('Invalid message ID'),
  validate,
  peerSupportController.deleteMessage
);

// ==================== MODERATION ROUTES ====================

// Get flagged messages (moderator)
router.get('/moderation/flagged',
  query('groupId').optional().isUUID(),
  validate,
  peerSupportController.getFlaggedMessages
);

// Moderate a message (moderator)
router.put('/messages/:messageId/moderate',
  moderateMessageValidation,
  validate,
  peerSupportController.moderateMessage
);

module.exports = router;

const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const journalController = require('../controllers/journalController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

router.use(authenticateToken);

const createValidation = [
  body('promptId').isString().isLength({ min: 1, max: 50 }).withMessage('promptId is required (≤ 50 chars)'),
  body('promptText').isString().isLength({ min: 1, max: 1000 }).withMessage('promptText is required (≤ 1000 chars)'),
  body('response').optional({ values: 'null' }).isString().isLength({ max: 20000 }).withMessage('response too long (max 20 000 chars)'),
  body('followUpResponses').optional({ values: 'null' }).isString().isLength({ max: 20000 }).withMessage('followUpResponses too long (max 20 000 chars)'),
  body('moodBefore').optional({ values: 'null' }).isInt({ min: 1, max: 10 }).withMessage('moodBefore must be 1-10'),
  body('moodAfter').optional({ values: 'null' }).isInt({ min: 1, max: 10 }).withMessage('moodAfter must be 1-10'),
  body('is_e2ee_encrypted').optional().isBoolean(),
];

const listValidation = [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
];

const deleteValidation = [
  param('entryId').isUUID().withMessage('entryId must be a UUID'),
];

router.post('/', createValidation, validate, journalController.createEntry);
router.get('/', listValidation, validate, journalController.listEntries);
router.delete('/:entryId', deleteValidation, validate, journalController.deleteEntry);

module.exports = router;

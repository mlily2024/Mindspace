const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// Validation rules
const registerValidation = [
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('username').optional().isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('userGroup').optional({ values: 'null' }).isIn(['student', 'professional', 'parent', 'elderly', 'other']).withMessage('User group must be one of: student, professional, parent, elderly, or other')
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
];

// Public routes
router.post('/register', registerValidation, validate, authController.register);
router.post('/login', loginValidation, validate, authController.login);

// Protected routes
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, authController.updateProfile);
router.put('/preferences', authenticateToken, authController.updatePreferences);
router.delete('/account', authenticateToken, authController.deleteAccount);
router.post('/data-export', authenticateToken, authController.requestDataExport);
router.get('/data-export/download', authenticateToken, authController.downloadDataExport);
router.delete('/account/permanent', authenticateToken, authController.permanentDeleteAccount);

module.exports = router;

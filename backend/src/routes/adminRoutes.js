const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { adminLogin, verifyAdmin, checkAdminStatus } = require('../middleware/adminAuth');

// Public admin routes
router.post('/login', adminLogin);
router.get('/status', checkAdminStatus);

// Protected admin routes - require admin authentication
router.use(verifyAdmin);

// Users management
router.get('/users', adminController.getAllUsers);
router.put('/users/:userId', adminController.manageUser);

// Mood entries
router.get('/mood-entries', adminController.getAllMoodEntries);

// Statistics
router.get('/stats', adminController.getDatabaseStats);

// System logs
router.get('/logs', adminController.getSystemLogs);

// Test data management
router.post('/test-data/generate', adminController.generateTestData);
router.delete('/test-data', adminController.deleteTestData);

module.exports = router;

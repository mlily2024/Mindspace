const express = require('express');
const router = express.Router();
const gamificationController = require('../controllers/gamificationController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Streak routes
router.get('/streak', gamificationController.getStreak);
router.post('/streak/freeze', gamificationController.useStreakFreeze);

// Achievement routes
router.get('/achievements', gamificationController.getAchievements);
router.get('/achievements/earned', gamificationController.getUserAchievements);
router.post('/achievements/check', gamificationController.checkAchievements);
router.post('/achievements/notified', gamificationController.markAchievementsNotified);

// Combined stats
router.get('/stats', gamificationController.getGamificationStats);

module.exports = router;

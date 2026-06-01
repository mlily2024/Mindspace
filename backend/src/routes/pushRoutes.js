const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const { authenticateToken } = require('../middleware/auth');

// Public — the frontend needs the VAPID public key to register the
// service worker before the user logs in.
router.get('/vapid-public-key', pushController.vapidPublicKey);

// Authenticated routes for managing the user's own subscriptions.
router.use(authenticateToken);
router.post('/subscribe',   pushController.subscribe);
router.delete('/unsubscribe', pushController.unsubscribe);

module.exports = router;

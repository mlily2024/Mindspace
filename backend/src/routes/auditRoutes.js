const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateToken } = require('../middleware/auth');

// All audit routes are user-scoped via the bearer JWT; the controller reads
// req.user.userId. There is no admin/all-users variant by design — verifying
// or downloading someone else's chain would violate the chain-per-user
// privacy contract of ADR-0004.
router.use(authenticateToken);

// Phase 1.2 (2026-06-15) — user-facing audit-log endpoints.
router.get('/verify-mine',   auditController.verifyMyChain);
router.get('/download-mine', auditController.downloadMyChain);

module.exports = router;

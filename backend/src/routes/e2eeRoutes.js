const express = require('express');
const router = express.Router();
const e2eeController = require('../controllers/e2eeController');
const { authenticateToken } = require('../middleware/auth');

// All E2EE routes are user-scoped via bearer JWT. The controller reads
// req.user.userId. There is no admin variant — by design (ADR-0009).
router.use(authenticateToken);

// Phase 1.3 v1 (2026-06-16) — client-side-key E2EE storage endpoints.
router.post('/setup',    e2eeController.setupE2EE);
router.get('/metadata',  e2eeController.getMetadata);
router.put('/rewrap',    e2eeController.rewrapMasterKey);

module.exports = router;

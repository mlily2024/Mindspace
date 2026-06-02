const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const cohortInsightsController = require('../controllers/cohortInsightsController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All cohort-insights endpoints require an authenticated user.
// The release itself is DP-protected and contains no per-user data,
// but authentication is required so that budget consumption is
// attributable (per audit-log ADR-0004).
router.use(authenticateToken);

router.get('/mood-by-day-of-week',
  query('epsilon').optional().isFloat({ min: 0.01, max: 5.0 })
    .withMessage('epsilon must be a float in [0.01, 5.0]'),
  query('minN').optional().isInt({ min: 1, max: 1000 })
    .withMessage('minN must be an integer in [1, 1000]'),
  validate,
  cohortInsightsController.getMoodByDayOfWeek
);

module.exports = router;

const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const clinicianReportController = require('../controllers/clinicianReportController');
const { authenticateToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

// All routes require authentication
router.use(authenticateToken);

// Validation rules
const generateValidation = [
  body('startDate').isISO8601().withMessage('Start date must be a valid ISO8601 date'),
  body('endDate').isISO8601().withMessage('End date must be a valid ISO8601 date')
];

const reportIdValidation = [
  param('reportId').isUUID().withMessage('Invalid report ID')
];

// Clinician report routes
router.post('/generate', generateValidation, validate, clinicianReportController.generateReport);
router.get('/', clinicianReportController.getReports);
router.get('/escalation', clinicianReportController.checkEscalation);
router.get('/:reportId', reportIdValidation, validate, clinicianReportController.getReport);

module.exports = router;

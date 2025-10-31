const express = require('express');
const router = express.Router();
const {
    createDualAssignment,
    assignAMMCSurveyor,
    assignNIASurveyor,
    getDualAssignmentByPolicy,
    getDualAssignments,
    updateReportSubmission,
    getSurveyorContacts,
    getDualAssignmentStats
} = require('../controllers/dualAssignment');

const authenticateUser = require('../middlewares/authentication');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Create dual assignment
router.post('/', createDualAssignment);

// Get all dual assignments with filters
router.get('/', getDualAssignments);

// Get dual assignment statistics
router.get('/stats', getDualAssignmentStats);

// Get dual assignment by policy ID
router.get('/policy/:policyId', getDualAssignmentByPolicy);

// Get surveyor contacts for dual assignment
router.get('/:dualAssignmentId/contacts', getSurveyorContacts);

// Assign AMMC surveyor
router.post('/:dualAssignmentId/assign-ammc', assignAMMCSurveyor);

// Assign NIA surveyor
router.post('/:dualAssignmentId/assign-nia', assignNIASurveyor);

// Update report submission status
router.patch('/:dualAssignmentId/report-submitted', updateReportSubmission);

module.exports = router;
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

const { protect } = require('../middlewares/authentication');
const {
    requireAnyAdmin,
    requireOrganization,
    requireDualAssignmentAccess,
    logNIAAdminActivity
} = require('../middlewares/niaAuth');

// Apply basic authentication to all routes
router.use(protect);

// Create dual assignment (requires any admin)
router.post('/', requireAnyAdmin, logNIAAdminActivity('CREATE_DUAL_ASSIGNMENT'), createDualAssignment);

// Get all dual assignments with filters (requires any admin)
router.get('/', requireAnyAdmin, getDualAssignments);

// Get dual assignment statistics (requires any admin)
router.get('/stats', requireAnyAdmin, getDualAssignmentStats);

// Get dual assignment by policy ID (requires any admin)
router.get('/policy/:policyId', requireAnyAdmin, getDualAssignmentByPolicy);

// Get surveyor contacts for dual assignment (accessible to surveyors and admins)
router.get('/:dualAssignmentId/contacts', getSurveyorContacts);

// Assign AMMC surveyor (requires AMMC admin or any admin with dual assignment access)
router.post('/:dualAssignmentId/assign-ammc', requireDualAssignmentAccess, logNIAAdminActivity('ASSIGN_AMMC_SURVEYOR'), assignAMMCSurveyor);

// Assign NIA surveyor (requires NIA admin or any admin with dual assignment access)
router.post('/:dualAssignmentId/assign-nia', requireDualAssignmentAccess, logNIAAdminActivity('ASSIGN_NIA_SURVEYOR'), assignNIASurveyor);

// Update report submission status (accessible to surveyors)
router.patch('/:dualAssignmentId/report-submitted', updateReportSubmission);

module.exports = router;
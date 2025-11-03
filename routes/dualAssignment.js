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

// Update all assignment contacts (admin only)
router.post('/update-contacts', requireAnyAdmin, async (req, res) => {
    try {
        const { updateAllAssignmentContacts, updateAllDualAssignmentContacts } = require('../scripts/updateAssignmentContacts');

        console.log('Starting contact update process via API...');

        // Update dual assignments first
        const dualAssignmentResults = await updateAllDualAssignmentContacts();

        // Then update individual assignments
        const assignmentResults = await updateAllAssignmentContacts();

        res.status(200).json({
            success: true,
            message: 'Contact update process completed',
            data: {
                dualAssignments: dualAssignmentResults,
                assignments: assignmentResults,
                summary: {
                    totalProcessed: dualAssignmentResults.processed + assignmentResults.processed,
                    totalUpdated: dualAssignmentResults.updated + assignmentResults.updated,
                    totalErrors: dualAssignmentResults.errors + assignmentResults.errors
                }
            }
        });
    } catch (error) {
        console.error('Contact update API error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update contacts',
            error: error.message
        });
    }
});

// Get dual assignment by policy ID (requires any admin)
router.get('/policy/:policyId', requireAnyAdmin, getDualAssignmentByPolicy);

// Get surveyor contacts for dual assignment (accessible to surveyors and admins)
router.get('/:dualAssignmentId/contacts', getSurveyorContacts);

// Get complete dual assignment details with all contact information
router.get('/:dualAssignmentId/details', async (req, res) => {
    try {
        const AssignmentContactService = require('../services/AssignmentContactService');
        const details = await AssignmentContactService.getDualAssignmentContacts(req.params.dualAssignmentId);

        res.status(200).json({
            success: true,
            data: details
        });
    } catch (error) {
        console.error('Get dual assignment details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get dual assignment details',
            error: error.message
        });
    }
});

// Assign AMMC surveyor (requires AMMC admin or any admin with dual assignment access)
router.post('/:dualAssignmentId/assign-ammc', requireDualAssignmentAccess, logNIAAdminActivity('ASSIGN_AMMC_SURVEYOR'), assignAMMCSurveyor);

// Assign NIA surveyor (requires NIA admin or any admin with dual assignment access)
router.post('/:dualAssignmentId/assign-nia', requireDualAssignmentAccess, logNIAAdminActivity('ASSIGN_NIA_SURVEYOR'), assignNIASurveyor);

// Update report submission status (accessible to surveyors)
router.patch('/:dualAssignmentId/report-submitted', updateReportSubmission);

module.exports = router;
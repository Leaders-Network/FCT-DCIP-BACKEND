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

// Create dual assignment for existing policy (requires any admin)
router.post('/policy/:policyId/create', requireAnyAdmin, async (req, res) => {
    try {
        const { policyId } = req.params;
        const { priority = 'medium', deadline } = req.body;

        // Check if policy exists
        const PolicyRequest = require('../models/PolicyRequest');
        const policy = await PolicyRequest.findById(policyId);
        if (!policy) {
            return res.status(404).json({
                success: false,
                message: 'Policy request not found'
            });
        }

        // Check if dual assignment already exists
        const DualAssignment = require('../models/DualAssignment');
        const existingDualAssignment = await DualAssignment.findOne({ policyId });
        if (existingDualAssignment) {
            return res.status(409).json({
                success: false,
                message: 'Dual assignment already exists for this policy',
                data: { existingAssignmentId: existingDualAssignment._id }
            });
        }

        // Calculate deadline
        const assignmentDeadline = deadline ? new Date(deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Create dual assignment
        const dualAssignment = new DualAssignment({
            policyId,
            priority,
            estimatedCompletion: {
                overallDeadline: assignmentDeadline,
                ammcDeadline: assignmentDeadline,
                niaDeadline: assignmentDeadline
            }
        });

        // Add creation timeline event
        dualAssignment.timeline.push({
            event: 'created',
            timestamp: new Date(),
            performedBy: req.user.userId,
            organization: req.user.organization || 'SYSTEM',
            details: `Dual assignment created manually for existing policy`,
            metadata: {
                policyId: policyId,
                priority: priority,
                deadline: assignmentDeadline
            }
        });

        await dualAssignment.save();

        // Update policy status
        policy.status = 'assigned';
        policy.statusHistory.push({
            status: 'assigned',
            changedBy: req.user.userId,
            changedAt: new Date(),
            reason: 'Dual assignment created - ready for AMMC and NIA surveyor assignment'
        });
        await policy.save();

        // Populate policy details for response
        await dualAssignment.populate('policyId', 'propertyDetails contactDetails status priority');

        res.status(201).json({
            success: true,
            message: 'Dual assignment created successfully for existing policy',
            data: {
                dualAssignment,
                nextSteps: [
                    'Assign AMMC surveyor using POST /:dualAssignmentId/assign-ammc',
                    'Assign NIA surveyor using POST /:dualAssignmentId/assign-nia'
                ]
            }
        });
    } catch (error) {
        console.error('Create dual assignment for policy error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create dual assignment for policy',
            error: error.message
        });
    }
});

// Get all dual assignments with filters (requires any admin)
router.get('/', requireAnyAdmin, getDualAssignments);

// Get dual assignment statistics (requires any admin)
router.get('/stats', requireAnyAdmin, getDualAssignmentStats);

// Debug route to check assignment data (requires any admin)
router.get('/debug', requireAnyAdmin, async (req, res) => {
    try {
        const assignments = await require('../models/DualAssignment').find({}).limit(5);

        const debugData = assignments.map(assignment => ({
            id: assignment._id,
            assignmentStatus: assignment.assignmentStatus,
            ammcSurveyorContact: assignment.ammcSurveyorContact,
            niaSurveyorContact: assignment.niaSurveyorContact,
            ammcContactType: typeof assignment.ammcSurveyorContact,
            niaContactType: typeof assignment.niaSurveyorContact,
            ammcContactKeys: assignment.ammcSurveyorContact ? Object.keys(assignment.ammcSurveyorContact) : [],
            niaContactKeys: assignment.niaSurveyorContact ? Object.keys(assignment.niaSurveyorContact) : [],
            ammcHasName: !!assignment.ammcSurveyorContact?.name,
            niaHasName: !!assignment.niaSurveyorContact?.name
        }));

        res.status(200).json({
            success: true,
            data: debugData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Debug failed',
            error: error.message
        });
    }
});

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
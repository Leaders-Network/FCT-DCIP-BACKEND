const express = require('express');
const router = express.Router();
const MergedReport = require('../models/MergedReport');
const DualAssignment = require('../models/DualAssignment');
const SurveySubmission = require('../models/SurveySubmission');
const PolicyRequest = require('../models/PolicyRequest');
const AutoReportMerger = require('../services/AutoReportMerger');
const DualSurveyTrigger = require('../services/DualSurveyTrigger');
const { protect, requireSuperAdminAccess } = require('../middlewares/authentication');

// Apply authentication to all routes
router.use(protect);
router.use(requireSuperAdminAccess);

/**
 * Test endpoint to create sample data and test the merging workflow
 * POST /api/v1/test-merged-reports/create-test-data
 */
router.post('/create-test-data', async (req, res) => {
    try {
        console.log('🧪 Creating test data for merged reports workflow...');

        // Find a policy that doesn't have a dual assignment yet
        const policy = await PolicyRequest.findOne({
            status: { $in: ['assigned', 'surveyed'] }
        });

        if (!policy) {
            return res.status(400).json({
                success: false,
                message: 'No suitable policy found for testing. Please create a policy first.'
            });
        }

        // Create a dual assignment for this policy
        const dualAssignment = new DualAssignment({
            policyId: policy._id,
            ammcAssignmentId: null, // Will be populated when assignments are created
            niaAssignmentId: null,
            completionStatus: 0,
            processingStatus: 'pending'
        });

        await dualAssignment.save();

        // Create mock survey submissions for both organizations
        const ammcSubmission = new SurveySubmission({
            ammcId: policy._id,
            surveyorId: req.user.userId, // Use current user as mock surveyor
            surveyDetails: {
                propertyCondition: 'Good condition with minor wear',
                structuralAssessment: 'Structurally sound, no major issues detected',
                riskFactors: 'Low risk - standard residential property',
                recommendations: 'Property is suitable for insurance coverage',
                estimatedValue: 15000000
            },
            surveyNotes: 'AMMC survey completed successfully. Property meets all requirements.',
            recommendedAction: 'approve',
            status: 'submitted',
            organization: 'AMMC'
        });

        const niaSubmission = new SurveySubmission({
            ammcId: policy._id,
            surveyorId: req.user.userId, // Use current user as mock surveyor
            surveyDetails: {
                propertyCondition: 'Excellent condition, well maintained',
                structuralAssessment: 'Strong structural integrity, recent renovations',
                riskFactors: 'Very low risk - premium location and construction',
                recommendations: 'Highly recommended for insurance approval',
                estimatedValue: 16000000
            },
            surveyNotes: 'NIA survey completed. Property exceeds standard requirements.',
            recommendedAction: 'approve',
            status: 'submitted',
            organization: 'NIA'
        });

        await Promise.all([ammcSubmission.save(), niaSubmission.save()]);

        console.log('✅ Test data created successfully');

        res.status(201).json({
            success: true,
            message: 'Test data created successfully',
            data: {
                policyId: policy._id,
                dualAssignmentId: dualAssignment._id,
                ammcSubmissionId: ammcSubmission._id,
                niaSubmissionId: niaSubmission._id
            }
        });

    } catch (error) {
        console.error('❌ Error creating test data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test data',
            error: error.message
        });
    }
});

/**
 * Test endpoint to trigger the merging process
 * POST /api/v1/test-merged-reports/trigger-merge/:policyId
 */
router.post('/trigger-merge/:policyId', async (req, res) => {
    try {
        const { policyId } = req.params;

        console.log(`🚀 Testing merge trigger for policy: ${policyId}`);

        // Trigger the merging process
        const result = await DualSurveyTrigger.checkAndTriggerMerging(policyId, 'TEST');

        res.status(200).json({
            success: true,
            message: 'Merge trigger test completed',
            data: result
        });

    } catch (error) {
        console.error('❌ Error in merge trigger test:', error);
        res.status(500).json({
            success: false,
            message: 'Merge trigger test failed',
            error: error.message
        });
    }
});

/**
 * Get all merged reports for testing
 * GET /api/v1/test-merged-reports/all
 */
router.get('/all', async (req, res) => {
    try {
        const reports = await MergedReport.find()
            .populate('policyId', 'policyNumber contactDetails propertyDetails')
            .populate('dualAssignmentId')
            .sort({ createdAt: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            data: {
                reports,
                count: reports.length
            }
        });

    } catch (error) {
        console.error('❌ Error fetching merged reports:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch merged reports',
            error: error.message
        });
    }
});

/**
 * Test the complete workflow
 * POST /api/v1/test-merged-reports/full-workflow-test
 */
router.post('/full-workflow-test', async (req, res) => {
    try {
        console.log('🧪 Starting full workflow test...');

        // Step 1: Create test data
        const policy = await PolicyRequest.findOne({
            status: { $in: ['assigned', 'surveyed'] }
        });

        if (!policy) {
            return res.status(400).json({
                success: false,
                message: 'No suitable policy found for testing'
            });
        }

        // Step 2: Create dual assignment
        const dualAssignment = new DualAssignment({
            policyId: policy._id,
            completionStatus: 100, // Mark as completed
            processingStatus: 'ready_for_merging'
        });
        await dualAssignment.save();

        // Step 3: Create survey submissions
        const ammcSubmission = new SurveySubmission({
            ammcId: policy._id,
            surveyorId: req.user.userId,
            surveyDetails: {
                propertyCondition: 'Good condition',
                structuralAssessment: 'Structurally sound',
                riskFactors: 'Low risk',
                recommendations: 'Approved for coverage',
                estimatedValue: 15000000
            },
            surveyNotes: 'AMMC survey completed',
            recommendedAction: 'approve',
            status: 'submitted',
            organization: 'AMMC'
        });

        const niaSubmission = new SurveySubmission({
            ammcId: policy._id,
            surveyorId: req.user.userId,
            surveyDetails: {
                propertyCondition: 'Excellent condition',
                structuralAssessment: 'Strong integrity',
                riskFactors: 'Very low risk',
                recommendations: 'Highly recommended',
                estimatedValue: 16000000
            },
            surveyNotes: 'NIA survey completed',
            recommendedAction: 'approve',
            status: 'submitted',
            organization: 'NIA'
        });

        await Promise.all([ammcSubmission.save(), niaSubmission.save()]);

        // Step 4: Trigger merging
        const autoMerger = new AutoReportMerger();
        const mergingResult = await autoMerger.processDualAssignment(dualAssignment._id);

        console.log('✅ Full workflow test completed successfully');

        res.status(200).json({
            success: true,
            message: 'Full workflow test completed successfully',
            data: {
                policyId: policy._id,
                dualAssignmentId: dualAssignment._id,
                mergingResult,
                testSteps: [
                    'Created dual assignment',
                    'Created AMMC survey submission',
                    'Created NIA survey submission',
                    'Triggered automatic merging',
                    'Generated merged report'
                ]
            }
        });

    } catch (error) {
        console.error('❌ Full workflow test failed:', error);
        res.status(500).json({
            success: false,
            message: 'Full workflow test failed',
            error: error.message,
            stack: error.stack
        });
    }
});

/**
 * Clean up test data
 * DELETE /api/v1/test-merged-reports/cleanup
 */
router.delete('/cleanup', async (req, res) => {
    try {
        console.log('🧹 Cleaning up test data...');

        // Delete test merged reports
        const deletedReports = await MergedReport.deleteMany({
            'mergingMetadata.mergedBy': 'SYSTEM'
        });

        // Delete test dual assignments
        const deletedAssignments = await DualAssignment.deleteMany({
            processingStatus: { $in: ['ready_for_merging', 'completed', 'error'] }
        });

        // Delete test survey submissions
        const deletedSubmissions = await SurveySubmission.deleteMany({
            surveyorId: req.user.userId,
            organization: { $in: ['AMMC', 'NIA'] }
        });

        console.log('✅ Test data cleanup completed');

        res.status(200).json({
            success: true,
            message: 'Test data cleanup completed',
            data: {
                deletedReports: deletedReports.deletedCount,
                deletedAssignments: deletedAssignments.deletedCount,
                deletedSubmissions: deletedSubmissions.deletedCount
            }
        });

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        res.status(500).json({
            success: false,
            message: 'Cleanup failed',
            error: error.message
        });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const DualAssignment = require('../models/DualAssignment');
const SurveySubmission = require('../models/SurveySubmission');
const MergedReport = require('../models/MergedReport');
const PolicyRequest = require('../models/PolicyRequest');
const DualSurveyTrigger = require('../services/DualSurveyTrigger');
const { protect, requireSuperAdminAccess } = require('../middlewares/authentication');

// Apply authentication
router.use(protect);
router.use(requireSuperAdminAccess);

/**
 * Debug: Check current state of surveys and assignments
 * GET /api/v1/debug-merged-reports/status
 */
router.get('/status', async (req, res) => {
    try {
        // Get counts of different entities
        const [
            totalPolicies,
            totalDualAssignments,
            totalSurveySubmissions,
            totalMergedReports,
            ammcSubmissions,
            niaSubmissions,
            completedDualAssignments,
            pendingDualAssignments
        ] = await Promise.all([
            PolicyRequest.countDocuments(),
            DualAssignment.countDocuments(),
            SurveySubmission.countDocuments(),
            MergedReport.countDocuments(),
            SurveySubmission.countDocuments({ organization: 'AMMC', status: 'submitted' }),
            SurveySubmission.countDocuments({ organization: 'NIA', status: 'submitted' }),
            DualAssignment.countDocuments({ completionStatus: 100 }),
            DualAssignment.countDocuments({ completionStatus: { $lt: 100 } })
        ]);

        // Get sample data
        const samplePolicies = await PolicyRequest.find({ status: { $in: ['assigned', 'surveyed'] } })
            .limit(5)
            .select('_id status propertyDetails.address');

        const sampleDualAssignments = await DualAssignment.find()
            .populate('policyId', 'propertyDetails.address status')
            .limit(5);

        const sampleSubmissions = await SurveySubmission.find({ status: 'submitted' })
            .limit(5)
            .select('ammcId organization recommendedAction submissionTime');

        const sampleMergedReports = await MergedReport.find()
            .populate('policyId', 'propertyDetails.address')
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalPolicies,
                    totalDualAssignments,
                    totalSurveySubmissions,
                    totalMergedReports,
                    ammcSubmissions,
                    niaSubmissions,
                    completedDualAssignments,
                    pendingDualAssignments
                },
                samples: {
                    policies: samplePolicies,
                    dualAssignments: sampleDualAssignments,
                    submissions: sampleSubmissions,
                    mergedReports: sampleMergedReports
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get debug status',
            error: error.message
        });
    }
});

/**
 * Debug: Find policies that should have merged reports but don't
 * GET /api/v1/debug-merged-reports/missing-reports
 */
router.get('/missing-reports', async (req, res) => {
    try {
        // Find policies that have both AMMC and NIA submissions but no merged report
        const ammcSubmissions = await SurveySubmission.find({
            organization: 'AMMC',
            status: 'submitted'
        }).select('ammcId');

        const niaSubmissions = await SurveySubmission.find({
            organization: 'NIA',
            status: 'submitted'
        }).select('ammcId');

        const ammcPolicyIds = ammcSubmissions.map(s => s.ammcId.toString());
        const niaPolicyIds = niaSubmissions.map(s => s.ammcId.toString());

        // Find policies that have both submissions
        const policiesWithBothSubmissions = ammcPolicyIds.filter(id => niaPolicyIds.includes(id));

        // Check which of these don't have merged reports
        const existingMergedReports = await MergedReport.find({
            policyId: { $in: policiesWithBothSubmissions }
        }).select('policyId');

        const existingReportPolicyIds = existingMergedReports.map(r => r.policyId.toString());
        const missingReportPolicyIds = policiesWithBothSubmissions.filter(id => !existingReportPolicyIds.includes(id));

        // Get details for missing reports
        const missingReportPolicies = await PolicyRequest.find({
            _id: { $in: missingReportPolicyIds }
        }).select('_id status propertyDetails.address');

        res.status(200).json({
            success: true,
            data: {
                totalPoliciesWithBothSubmissions: policiesWithBothSubmissions.length,
                totalExistingMergedReports: existingMergedReports.length,
                totalMissingReports: missingReportPolicyIds.length,
                missingReportPolicies,
                policiesWithBothSubmissions,
                missingReportPolicyIds
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to find missing reports',
            error: error.message
        });
    }
});

/**
 * Debug: Trigger merging for a specific policy
 * POST /api/v1/debug-merged-reports/trigger-merge/:policyId
 */
router.post('/trigger-merge/:policyId', async (req, res) => {
    try {
        const { policyId } = req.params;

        console.log(`🔧 Debug: Manually triggering merge for policy: ${policyId}`);

        // Check if policy has both submissions
        const [ammcSubmission, niaSubmission] = await Promise.all([
            SurveySubmission.findOne({
                ammcId: policyId,
                organization: 'AMMC',
                status: 'submitted'
            }),
            SurveySubmission.findOne({
                ammcId: policyId,
                organization: 'NIA',
                status: 'submitted'
            })
        ]);

        if (!ammcSubmission || !niaSubmission) {
            return res.status(400).json({
                success: false,
                message: 'Policy does not have both AMMC and NIA submissions',
                data: {
                    hasAMMC: !!ammcSubmission,
                    hasNIA: !!niaSubmission
                }
            });
        }

        // Trigger the merging process
        const result = await DualSurveyTrigger.checkAndTriggerMerging(policyId, 'DEBUG');

        res.status(200).json({
            success: true,
            message: 'Merge triggered successfully',
            data: result
        });

    } catch (error) {
        console.error('Debug merge trigger error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger merge',
            error: error.message
        });
    }
});

/**
 * Debug: Trigger merging for all eligible policies
 * POST /api/v1/debug-merged-reports/trigger-all-missing
 */
router.post('/trigger-all-missing', async (req, res) => {
    try {
        console.log('🔧 Debug: Triggering merge for all missing reports...');

        // Get missing report policy IDs
        const missingResponse = await fetch(`${req.protocol}://${req.get('host')}/api/v1/debug-merged-reports/missing-reports`, {
            headers: {
                'Authorization': req.headers.authorization
            }
        });

        const missingData = await missingResponse.json();
        const missingPolicyIds = missingData.data.missingReportPolicyIds;

        console.log(`Found ${missingPolicyIds.length} policies that need merged reports`);

        const results = [];
        for (const policyId of missingPolicyIds) {
            try {
                const result = await DualSurveyTrigger.checkAndTriggerMerging(policyId, 'DEBUG_BATCH');
                results.push({
                    policyId,
                    success: true,
                    result
                });
                console.log(`✅ Successfully triggered merge for policy: ${policyId}`);
            } catch (error) {
                results.push({
                    policyId,
                    success: false,
                    error: error.message
                });
                console.error(`❌ Failed to trigger merge for policy: ${policyId}`, error);
            }
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        res.status(200).json({
            success: true,
            message: `Batch merge trigger completed: ${successful} successful, ${failed} failed`,
            data: {
                totalProcessed: results.length,
                successful,
                failed,
                results
            }
        });

    } catch (error) {
        console.error('Batch merge trigger error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to trigger batch merge',
            error: error.message
        });
    }
});

module.exports = router;
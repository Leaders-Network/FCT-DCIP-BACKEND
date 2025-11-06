const express = require('express');
const router = express.Router();
const SurveySubmission = require('../models/SurveySubmission');
const MergedReport = require('../models/MergedReport');
const PolicyRequest = require('../models/PolicyRequest');
const DualAssignment = require('../models/DualAssignment');
const { protect, requireSuperAdminAccess } = require('../middlewares/authentication');

router.use(protect);
router.use(requireSuperAdminAccess);

/**
 * Diagnose why merged reports aren't showing for users
 */
router.get('/diagnose', async (req, res) => {
    try {
        // Get counts
        const [
            totalPolicies,
            totalSubmissions,
            ammcSubmissions,
            niaSubmissions,
            totalMergedReports,
            totalDualAssignments,
            submittedSubmissions
        ] = await Promise.all([
            PolicyRequest.countDocuments(),
            SurveySubmission.countDocuments(),
            SurveySubmission.countDocuments({ organization: 'AMMC' }),
            SurveySubmission.countDocuments({ organization: 'NIA' }),
            MergedReport.countDocuments(),
            DualAssignment.countDocuments(),
            SurveySubmission.countDocuments({ status: 'submitted' })
        ]);

        // Get sample data
        const sampleSubmissions = await SurveySubmission.find()
            .select('ammcId organization status submissionTime')
            .limit(5);

        const sampleMergedReports = await MergedReport.find()
            .populate('policyId', 'propertyDetails.address')
            .limit(3);

        // Check for policies with both AMMC and NIA submissions
        const policiesWithBothSubmissions = await SurveySubmission.aggregate([
            { $match: { status: 'submitted' } },
            {
                $group: {
                    _id: '$ammcId',
                    organizations: { $addToSet: '$organization' },
                    count: { $sum: 1 }
                }
            },
            { $match: { 'organizations.1': { $exists: true } } }
        ]);

        res.json({
            success: true,
            data: {
                summary: {
                    totalPolicies,
                    totalSubmissions,
                    ammcSubmissions,
                    niaSubmissions,
                    totalMergedReports,
                    totalDualAssignments,
                    submittedSubmissions,
                    policiesWithBothSubmissions: policiesWithBothSubmissions.length
                },
                samples: {
                    submissions: sampleSubmissions,
                    mergedReports: sampleMergedReports,
                    policiesWithBothSubmissions
                },
                diagnosis: {
                    hasNiaSubmissions: niaSubmissions > 0,
                    hasDualAssignments: totalDualAssignments > 0,
                    hasMergedReports: totalMergedReports > 0,
                    canCreateMergedReports: policiesWithBothSubmissions.length > 0
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
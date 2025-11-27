const express = require('express');
const router = express.Router();
const SurveySubmission = require('../models/SurveySubmission');
const MergedReport = require('../models/MergedReport');
const PolicyRequest = require('../models/PolicyRequest');
const DualAssignment = require('../models/DualAssignment');
const { protect, requireSuperAdminAccess } = require('../middlewares/authentication');

// Apply authentication
router.use(protect);
router.use(requireSuperAdminAccess);

/**
 * Quick test to see current state and create test merged report
 * GET /api/v1/quick-test/status
 */
router.get('/status', async (req, res) => {
    try {
        // Get basic counts
        const [policies, submissions, mergedReports, dualAssignments] = await Promise.all([
            PolicyRequest.countDocuments(),
            SurveySubmission.countDocuments(),
            MergedReport.countDocuments(),
            DualAssignment.countDocuments()
        ]);

        // Get sample data
        const samplePolicy = await PolicyRequest.findOne({ status: { $in: ['assigned', 'surveyed'] } });
        const sampleSubmissions = await SurveySubmission.find().limit(3);
        const sampleMergedReports = await MergedReport.find().limit(3);

        res.json({
            success: true,
            data: {
                counts: { policies, submissions, mergedReports, dualAssignments },
                samples: {
                    policy: samplePolicy,
                    submissions: sampleSubmissions,
                    mergedReports: sampleMergedReports
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Create merged reports for all policies that need them
 * POST /api/v1/quick-test/create-all-missing-reports
 */
router.post('/create-all-missing-reports', async (req, res) => {
    try {
        // Find all policies that don't have merged reports yet
        const policies = await PolicyRequest.find({
            status: { $in: ['assigned', 'surveyed', 'approved'] }
        });

        const results = [];
        let created = 0;
        let skipped = 0;

        for (const policy of policies) {
            // Check if merged report already exists
            const existingReport = await MergedReport.findOne({ policyId: policy._id });
            if (existingReport) {
                skipped++;
                continue;
            }

            // Create a test merged report
            const testReport = new MergedReport({
                policyId: policy._id,
                dualAssignmentId: null,
                ammcReportId: null,
                niaReportId: null,
                conflictDetected: false,
                conflictResolved: true,
                finalRecommendation: 'approve',
                paymentEnabled: true,
                reportSections: {
                    ammc: {
                        propertyCondition: 'Good condition with minor wear and tear',
                        structuralAssessment: 'Structurally sound building with solid foundation',
                        riskFactors: 'Low risk property in safe neighborhood',
                        recommendations: 'Property is suitable for insurance coverage',
                        estimatedValue: Math.floor(Math.random() * 10000000) + 10000000, // Random value between 10M-20M
                        surveyorName: 'AMMC Surveyor',
                        surveyorLicense: 'AMMC-2024-001',
                        submissionDate: new Date(),
                        photos: []
                    },
                    nia: {
                        propertyCondition: 'Excellent condition, well maintained',
                        structuralAssessment: 'Strong structural integrity with recent renovations',
                        riskFactors: 'Very low risk - premium location and construction',
                        recommendations: 'Highly recommended for insurance approval',
                        estimatedValue: Math.floor(Math.random() * 10000000) + 12000000, // Slightly higher value
                        surveyorName: 'NIA Surveyor',
                        surveyorLicense: 'NIA-2024-001',
                        submissionDate: new Date(),
                        photos: []
                    }
                },
                mergingMetadata: {
                    mergedBy: 'QUICK_TEST_SYSTEM',
                    mergedAt: new Date(),
                    mergingAlgorithmVersion: '1.0.0',
                    processingTime: Math.floor(Math.random() * 5000) + 1000,
                    qualityScore: Math.floor(Math.random() * 20) + 80 // Score between 80-100
                },
                releaseStatus: 'released',
                releasedAt: new Date(),
                notifications: {
                    userNotified: false,
                    adminNotified: false,
                    conflictNotificationSent: false,
                    releaseNotificationSent: false
                }
            });

            await testReport.save();
            created++;

            results.push({
                policyId: policy._id,
                reportId: testReport._id,
                propertyAddress: policy.propertyDetails?.address
            });
        }

        res.json({
            success: true,
            message: `Created ${created} merged reports, skipped ${skipped} existing reports`,
            data: {
                created,
                skipped,
                total: policies.length,
                reports: results
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Create a test merged report for the first available policy
 * POST /api/v1/quick-test/create-test-report
 */
router.post('/create-test-report', async (req, res) => {
    try {
        // Find a policy that doesn't have a merged report yet
        const policy = await PolicyRequest.findOne({
            status: { $in: ['assigned', 'surveyed', 'approved'] }
        });

        if (!policy) {
            return res.status(400).json({
                success: false,
                message: 'No suitable policy found'
            });
        }

        // Check if merged report already exists
        const existingReport = await MergedReport.findOne({ policyId: policy._id });
        if (existingReport) {
            return res.json({
                success: true,
                message: 'Merged report already exists for this policy',
                data: { reportId: existingReport._id, policyId: policy._id }
            });
        }

        // Create a test merged report
        const testReport = new MergedReport({
            policyId: policy._id,
            dualAssignmentId: null, // We'll create this if needed
            ammcReportId: null,
            niaReportId: null,
            conflictDetected: false,
            conflictResolved: true,
            finalRecommendation: 'approve',
            paymentEnabled: true,
            reportSections: {
                ammc: {
                    propertyCondition: 'Good condition with minor wear and tear',
                    structuralAssessment: 'Structurally sound building with solid foundation',
                    riskFactors: 'Low risk property in safe neighborhood',
                    recommendations: 'Property is suitable for insurance coverage',
                    estimatedValue: 15000000,
                    surveyorName: 'Test AMMC Surveyor',
                    surveyorLicense: 'AMMC-2024-001',
                    submissionDate: new Date(),
                    photos: []
                },
                nia: {
                    propertyCondition: 'Excellent condition, well maintained',
                    structuralAssessment: 'Strong structural integrity with recent renovations',
                    riskFactors: 'Very low risk - premium location and construction',
                    recommendations: 'Highly recommended for insurance approval',
                    estimatedValue: 16000000,
                    surveyorName: 'Test NIA Surveyor',
                    surveyorLicense: 'NIA-2024-001',
                    submissionDate: new Date(),
                    photos: []
                }
            },
            mergingMetadata: {
                mergedBy: 'TEST_SYSTEM',
                mergedAt: new Date(),
                mergingAlgorithmVersion: '1.0.0',
                processingTime: 2500,
                qualityScore: 95
            },
            releaseStatus: 'released',
            releasedAt: new Date(),
            notifications: {
                userNotified: false,
                adminNotified: false,
                conflictNotificationSent: false,
                releaseNotificationSent: false
            }
        });

        await testReport.save();

        res.json({
            success: true,
            message: 'Test merged report created successfully',
            data: {
                reportId: testReport._id,
                policyId: policy._id,
                propertyAddress: policy.propertyDetails?.address
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
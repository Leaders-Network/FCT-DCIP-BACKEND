const express = require('express');
const router = express.Router();
const MergedReport = require('../models/MergedReport');
const PolicyRequest = require('../models/PolicyRequest');
const { protect } = require('../middlewares/authentication');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../errors');

/**
 * Get all reports for the authenticated user
 * GET /api/v1/user-reports
 */
router.get('/', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Find all policies for this user
        const userPolicies = await PolicyRequest.find({ userId }).select('_id');
        const policyIds = userPolicies.map(policy => policy._id);

        if (policyIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    reports: [],
                    pagination: {
                        currentPage: page,
                        totalPages: 0,
                        totalReports: 0,
                        hasNext: false,
                        hasPrev: false
                    }
                }
            });
        }

        // Get merged reports for user's policies
        const mergedReports = await MergedReport.find({
            policyId: { $in: policyIds }
        })
            .populate({
                path: 'policyId',
                select: 'propertyDetails.address propertyDetails.propertyType'
            })
            .select('policyId releaseStatus finalRecommendation paymentEnabled conflictDetected createdAt accessHistory');

        // Get completed individual reports
        const completedReports = await PolicyRequest.find({
            _id: { $in: policyIds },
            status: 'completed'
        })
            .select('propertyDetails.address propertyDetails.propertyType status createdAt');

        // Format and combine reports
        const formattedMergedReports = await Promise.all(mergedReports.map(async (report) => {
            // Get document URLs from merged report or fetch from submissions
            let ammcDocumentUrl = report.ammcDocumentUrl;
            let niaDocumentUrl = report.niaDocumentUrl;

            // If not stored in merged report, fetch from submissions
            if (!ammcDocumentUrl || !niaDocumentUrl) {
                const SurveySubmission = require('../models/SurveySubmission');
                const [ammcSubmission, niaSubmission] = await Promise.all([
                    SurveySubmission.findById(report.ammcReportId),
                    SurveySubmission.findById(report.niaReportId)
                ]);

                if (ammcSubmission) {
                    const ammcDocs = ammcSubmission.documents || [];
                    if (ammcDocs.length > 0) {
                        const mainDoc = ammcDocs.find(doc => doc.isMainReport) || ammcDocs[0];
                        ammcDocumentUrl = mainDoc.cloudinaryUrl;
                    } else if (ammcSubmission.surveyDocument) {
                        ammcDocumentUrl = typeof ammcSubmission.surveyDocument === 'string'
                            ? ammcSubmission.surveyDocument
                            : ammcSubmission.surveyDocument.url;
                    }
                }

                if (niaSubmission) {
                    const niaDocs = niaSubmission.documents || [];
                    if (niaDocs.length > 0) {
                        const mainDoc = niaDocs.find(doc => doc.isMainReport) || niaDocs[0];
                        niaDocumentUrl = mainDoc.cloudinaryUrl;
                    } else if (niaSubmission.surveyDocument) {
                        niaDocumentUrl = typeof niaSubmission.surveyDocument === 'string'
                            ? niaSubmission.surveyDocument
                            : niaSubmission.surveyDocument.url;
                    }
                }
            }

            return {
                reportId: report._id,
                policyId: report.policyId._id,
                propertyAddress: report.policyId.propertyDetails?.address || 'Address not available',
                propertyType: report.policyId.propertyDetails?.propertyType || 'Type not specified',
                status: report.releaseStatus,
                finalRecommendation: report.finalRecommendation,
                paymentEnabled: report.paymentEnabled,
                conflictDetected: report.conflictDetected,
                createdAt: report.createdAt,
                downloadCount: report.accessHistory?.filter(access => access.accessType === 'download').length || 0,
                canDownload: report.releaseStatus === 'released' && report.finalRecommendation,
                isMerged: true,
                documentUrls: {
                    ammc: ammcDocumentUrl,
                    nia: niaDocumentUrl,
                    merged: report.mergedDocumentUrl
                }
            };
        }));

        const formattedCompletedReports = completedReports.map(report => ({
            reportId: report._id,
            policyId: report._id,
            propertyAddress: report.propertyDetails?.address || 'Address not available',
            propertyType: report.propertyDetails?.propertyType || 'Type not specified',
            status: report.status,
            finalRecommendation: null,
            paymentEnabled: false,
            conflictDetected: false,
            createdAt: report.createdAt,
            downloadCount: 0,
            canDownload: true, // Or based on some other logic
            isMerged: false
        }));

        const allReports = [...formattedMergedReports, ...formattedCompletedReports];

        // Sort all reports by creation date
        allReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const totalReports = allReports.length;
        const paginatedReports = allReports.slice(skip, skip + limit);
        const totalPages = Math.ceil(totalReports / limit);

        res.status(200).json({
            success: true,
            data: {
                reports: paginatedReports,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalReports,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Error fetching user reports:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch reports',
            error: error.message
        });
    }
});

/**
 * Get detailed report information
 * GET /api/v1/user-reports/:reportId
 */
router.get('/:reportId', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { reportId } = req.params;

        // Find the report and verify ownership
        const report = await MergedReport.findById(reportId)
            .populate({
                path: 'policyId',
                select: 'userId propertyDetails'
            });

        if (!report) {
            throw new NotFoundError('Report not found');
        }

        // Verify user owns this policy
        if (report.policyId.userId.toString() !== userId) {
            throw new UnauthorizedError('Access denied to this report');
        }

        // Log access
        report.logAccess(
            userId,
            'view',
            req.ip,
            req.get('User-Agent')
        );
        await report.save();

        // Format detailed report data
        const detailedReport = {
            reportId: report._id,
            policyId: report.policyId._id,
            propertyDetails: report.policyId.propertyDetails,
            status: report.releaseStatus,
            finalRecommendation: report.finalRecommendation,
            paymentEnabled: report.paymentEnabled,
            conflictDetected: report.conflictDetected,
            conflictResolved: report.conflictResolved,
            conflictDetails: report.conflictDetails,
            reportSections: report.reportSections,
            mergingMetadata: report.mergingMetadata,
            createdAt: report.createdAt,
            releasedAt: report.releasedAt,
            downloadCount: report.accessHistory?.filter(access => access.accessType === 'download').length || 0,
            canDownload: report.releaseStatus === 'released' && report.finalRecommendation
        };

        res.status(200).json({
            success: true,
            data: detailedReport
        });

    } catch (error) {
        console.error('Error fetching report details:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid report ID format'
            });
        }
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch report details'
        });
    }
});

/**
 * Download report (placeholder - would generate PDF in real implementation)
 * POST /api/v1/user-reports/:reportId/download
 */
router.post('/:reportId/download', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { reportId } = req.params;

        // Find the report and verify ownership
        const report = await MergedReport.findById(reportId)
            .populate({
                path: 'policyId',
                select: 'userId propertyDetails'
            });

        if (!report) {
            throw new NotFoundError('Report not found');
        }

        // Verify user owns this policy
        if (report.policyId.userId.toString() !== userId) {
            throw new UnauthorizedError('Access denied to this report');
        }

        // Check if report is released
        if (report.releaseStatus !== 'released') {
            throw new BadRequestError('Report is not yet available for download');
        }

        // Log download access
        report.logAccess(
            userId,
            'download',
            req.ip,
            req.get('User-Agent')
        );
        await report.save();

        // In a real implementation, you would generate and return a PDF here
        // For now, we'll return the report data
        res.status(200).json({
            success: true,
            message: 'Report download initiated',
            data: {
                reportId: report._id,
                downloadUrl: `/api/v1/user-reports/${reportId}/pdf`, // Future PDF endpoint
                downloadCount: report.accessHistory?.filter(access => access.accessType === 'download').length || 0
            }
        });

    } catch (error) {
        console.error('Error downloading report:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid report ID format'
            });
        }
        res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to download report'
        });
    }
});

/**
 * Get user's report summary/statistics
 * GET /api/v1/user-reports/summary
 */
router.get('/summary/stats', protect, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Find all policies for this user
        const userPolicies = await PolicyRequest.find({ userId }).select('_id');
        const policyIds = userPolicies.map(policy => policy._id);

        if (policyIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    totalReports: 0,
                    releasedReports: 0,
                    pendingReports: 0,
                    approvedReports: 0,
                    rejectedReports: 0,
                    conflictReports: 0,
                    paymentEnabledReports: 0
                }
            });
        }

        // Get aggregated statistics
        const stats = await MergedReport.aggregate([
            { $match: { policyId: { $in: policyIds } } },
            {
                $group: {
                    _id: null,
                    totalReports: { $sum: 1 },
                    releasedReports: {
                        $sum: { $cond: [{ $eq: ['$releaseStatus', 'released'] }, 1, 0] }
                    },
                    pendingReports: {
                        $sum: { $cond: [{ $eq: ['$releaseStatus', 'pending'] }, 1, 0] }
                    },
                    approvedReports: {
                        $sum: { $cond: [{ $eq: ['$finalRecommendation', 'approve'] }, 1, 0] }
                    },
                    rejectedReports: {
                        $sum: { $cond: [{ $eq: ['$finalRecommendation', 'reject'] }, 1, 0] }
                    },
                    conflictReports: {
                        $sum: { $cond: ['$conflictDetected', 1, 0] }
                    },
                    paymentEnabledReports: {
                        $sum: { $cond: ['$paymentEnabled', 1, 0] }
                    }
                }
            }
        ]);

        const summary = stats[0] || {
            totalReports: 0,
            releasedReports: 0,
            pendingReports: 0,
            approvedReports: 0,
            rejectedReports: 0,
            conflictReports: 0,
            paymentEnabledReports: 0
        };

        res.status(200).json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error('Error fetching report summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch report summary',
            error: error.message
        });
    }
});

module.exports = router;
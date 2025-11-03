const express = require('express');
const router = express.Router();
const { StatusCodes } = require('http-status-codes');
const ReportReleaseService = require('../services/ReportReleaseService');
const MergedReport = require('../models/MergedReport');
const { protect, restrictTo } = require('../middlewares/authentication');

const reportReleaseService = new ReportReleaseService();

/**
 * GET /api/v1/report-release/status/:policyId
 * Get report processing status for a specific policy
 */
router.get('/status/:policyId', protect, async (req, res) => {
    try {
        const { policyId } = req.params;

        const status = await reportReleaseService.getReportProcessingStatus(policyId);

        res.status(StatusCodes.OK).json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting report processing status:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get report processing status',
            error: error.message
        });
    }
});

/**
 * GET /api/v1/report-release/report/:reportId
 * Get merged report details for user
 */
router.get('/report/:reportId', protect, async (req, res) => {
    try {
        const { reportId } = req.params;

        const mergedReport = await MergedReport.findById(reportId)
            .populate('policyId')
            .populate('dualAssignmentId');

        if (!mergedReport) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Check if user has access to this report
        if (mergedReport.policyId.userId.toString() !== req.user.userId) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied to this report'
            });
        }

        // Check if report is released
        if (mergedReport.releaseStatus !== 'released') {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Report is not yet available',
                status: mergedReport.releaseStatus
            });
        }

        // Log access
        mergedReport.logAccess(
            req.user.userId,
            'view',
            req.ip,
            req.get('User-Agent')
        );
        await mergedReport.save();

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                reportId: mergedReport._id,
                policyId: mergedReport.policyId._id,
                releaseStatus: mergedReport.releaseStatus,
                releasedAt: mergedReport.releasedAt,
                finalRecommendation: mergedReport.finalRecommendation,
                paymentEnabled: mergedReport.paymentEnabled,
                conflictDetected: mergedReport.conflictDetected,
                conflictResolved: mergedReport.conflictResolved,
                conflictDetails: mergedReport.conflictDetails,
                reportSections: mergedReport.reportSections,
                mergingMetadata: mergedReport.mergingMetadata,
                accessHistory: mergedReport.accessHistory.slice(-10) // Last 10 access records
            }
        });
    } catch (error) {
        console.error('Error getting merged report:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get report',
            error: error.message
        });
    }
});

/**
 * POST /api/v1/report-release/download/:reportId
 * Log report download and return download URL
 */
router.post('/download/:reportId', protect, async (req, res) => {
    try {
        const { reportId } = req.params;

        const mergedReport = await MergedReport.findById(reportId)
            .populate('policyId');

        if (!mergedReport) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Check if user has access to this report
        if (mergedReport.policyId.userId.toString() !== req.user.userId) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied to this report'
            });
        }

        // Check if report is released
        if (mergedReport.releaseStatus !== 'released') {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Report is not yet available for download',
                status: mergedReport.releaseStatus
            });
        }

        // Log download access
        mergedReport.logAccess(
            req.user.userId,
            'download',
            req.ip,
            req.get('User-Agent')
        );
        await mergedReport.save();

        // Generate download URL (this would typically be a signed URL for cloud storage)
        const downloadUrl = mergedReport.mergedDocumentUrl ||
            `${process.env.FRONTEND_URL}/api/v1/report-release/file/${reportId}`;

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                downloadUrl: downloadUrl,
                fileName: `merged_report_${mergedReport.policyId._id}.pdf`,
                reportId: mergedReport._id,
                downloadedAt: new Date()
            }
        });
    } catch (error) {
        console.error('Error processing report download:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to process download',
            error: error.message
        });
    }
});

/**
 * POST /api/v1/report-release/manual-release/:reportId
 * Manually release a withheld report (admin only)
 */
router.post('/manual-release/:reportId',
    protect,
    restrictTo('Admin', 'Super-admin'),
    async (req, res) => {
        try {
            const { reportId } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: 'Release reason is required'
                });
            }

            const result = await reportReleaseService.manualReleaseReport(
                reportId,
                req.user.userId,
                reason
            );

            res.status(StatusCodes.OK).json({
                success: true,
                message: 'Report manually released successfully',
                data: result
            });
        } catch (error) {
            console.error('Error manually releasing report:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to manually release report',
                error: error.message
            });
        }
    }
);

/**
 * GET /api/v1/report-release/admin/pending
 * Get all reports pending release (admin only)
 */
router.get('/admin/pending',
    protect,
    restrictTo('Admin', 'Super-admin'),
    async (req, res) => {
        try {
            const { page = 1, limit = 20, status = 'all' } = req.query;

            let filter = {};
            if (status !== 'all') {
                filter.releaseStatus = status;
            } else {
                filter.releaseStatus = { $in: ['pending', 'withheld'] };
            }

            const reports = await MergedReport.find(filter)
                .populate('policyId', 'propertyDetails contactDetails')
                .populate('dualAssignmentId')
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            const total = await MergedReport.countDocuments(filter);

            res.status(StatusCodes.OK).json({
                success: true,
                data: {
                    reports: reports.map(report => ({
                        reportId: report._id,
                        policyId: report.policyId._id,
                        propertyAddress: report.policyId.propertyDetails?.address || 'N/A',
                        releaseStatus: report.releaseStatus,
                        conflictDetected: report.conflictDetected,
                        conflictSeverity: report.conflictDetails?.conflictSeverity,
                        finalRecommendation: report.finalRecommendation,
                        createdAt: report.createdAt,
                        processingTime: report.mergingMetadata?.processingTime
                    })),
                    pagination: {
                        current: parseInt(page),
                        pages: Math.ceil(total / limit),
                        total: total
                    }
                }
            });
        } catch (error) {
            console.error('Error getting pending reports:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: 'Failed to get pending reports',
                error: error.message
            });
        }
    }
);

/**
 * GET /api/v1/report-release/user/reports
 * Get all reports for the authenticated user
 */
router.get('/user/reports', protect, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        // Find all merged reports for user's policies
        const reports = await MergedReport.find({})
            .populate({
                path: 'policyId',
                match: { userId: req.user.userId },
                select: 'propertyDetails contactDetails status'
            })
            .populate('dualAssignmentId')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        // Filter out reports where policyId is null (no match)
        const userReports = reports.filter(report => report.policyId !== null);

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                reports: userReports.map(report => ({
                    reportId: report._id,
                    policyId: report.policyId._id,
                    propertyAddress: report.policyId.propertyDetails?.address || 'N/A',
                    releaseStatus: report.releaseStatus,
                    releasedAt: report.releasedAt,
                    finalRecommendation: report.finalRecommendation,
                    paymentEnabled: report.paymentEnabled,
                    conflictDetected: report.conflictDetected,
                    conflictResolved: report.conflictResolved,
                    createdAt: report.createdAt,
                    canDownload: report.releaseStatus === 'released'
                })),
                pagination: {
                    current: parseInt(page),
                    total: userReports.length
                }
            }
        });
    } catch (error) {
        console.error('Error getting user reports:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get user reports',
            error: error.message
        });
    }
});

module.exports = router;
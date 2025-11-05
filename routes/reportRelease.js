const express = require('express');
const router = express.Router();
const { protect, restrictTo, allowUserOrAdmin } = require('../middlewares/authentication');
const MergedReport = require('../models/MergedReport');
const PolicyRequest = require('../models/PolicyRequest');
const { StatusCodes } = require('http-status-codes');

// Apply authentication to all routes
router.use(protect);

// Get user's reports
router.get('/user/reports', allowUserOrAdmin, async (req, res) => {
    try {
        const { userId } = req.user;
        const { page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Find policies belonging to the user that have merged reports
        const policies = await PolicyRequest.find({ userId })
            .select('_id propertyDetails contactDetails status createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const policyIds = policies.map(p => p._id);

        // Find merged reports for these policies
        const mergedReports = await MergedReport.find({
            policyId: { $in: policyIds },
            releaseStatus: 'released'
        }).populate('policyId', 'propertyDetails contactDetails status');

        // Format response
        const reports = mergedReports.map(report => ({
            reportId: report._id,
            policyId: report.policyId._id,
            propertyAddress: report.policyId.propertyDetails.address,
            propertyType: report.policyId.propertyDetails.propertyType,
            status: report.releaseStatus,
            createdAt: report.createdAt,
            downloadCount: report.downloadCount || 0,
            canDownload: report.releaseStatus === 'released'
        }));

        const total = await MergedReport.countDocuments({
            policyId: { $in: policyIds },
            releaseStatus: 'released'
        });

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                reports,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get user reports error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get user reports',
            error: error.message
        });
    }
});

// Get report processing status
router.get('/status/:policyId', allowUserOrAdmin, async (req, res) => {
    try {
        const { policyId } = req.params;
        const { userId } = req.user;

        // Check if user owns this policy (unless admin)
        const policy = await PolicyRequest.findById(policyId);
        if (!policy) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Policy not found'
            });
        }

        // Check ownership for non-admin users
        if (req.user.model === 'User' && policy.userId !== userId) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Check for merged report
        const mergedReport = await MergedReport.findOne({ policyId });

        if (!mergedReport) {
            return res.status(StatusCodes.OK).json({
                success: true,
                data: {
                    status: 'pending',
                    message: 'Survey reports are still being processed',
                    stage: 'awaiting_reports'
                }
            });
        }

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                status: mergedReport.releaseStatus,
                message: mergedReport.releaseStatus === 'released'
                    ? 'Report is ready for download'
                    : 'Report is being processed',
                stage: mergedReport.releaseStatus === 'released' ? 'completed' : 'processing',
                reportId: mergedReport._id,
                createdAt: mergedReport.createdAt
            }
        });
    } catch (error) {
        console.error('Get report status error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get report status',
            error: error.message
        });
    }
});

// Get specific report details
router.get('/report/:reportId', allowUserOrAdmin, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { userId } = req.user;

        const mergedReport = await MergedReport.findById(reportId)
            .populate('policyId', 'propertyDetails contactDetails userId');

        if (!mergedReport) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Check ownership for non-admin users
        if (req.user.model === 'User' && mergedReport.policyId.userId !== userId) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied'
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
                propertyDetails: mergedReport.policyId.propertyDetails,
                status: mergedReport.releaseStatus,
                finalRecommendation: mergedReport.finalRecommendation,
                paymentEnabled: mergedReport.paymentEnabled,
                conflictDetected: mergedReport.conflictDetected,
                conflictResolved: mergedReport.conflictResolved,
                conflictDetails: mergedReport.conflictDetails,
                reportSections: mergedReport.reportSections,
                mergingMetadata: mergedReport.mergingMetadata,
                createdAt: mergedReport.createdAt,
                releasedAt: mergedReport.releasedAt,
                downloadCount: mergedReport.downloadCount || 0,
                canDownload: mergedReport.releaseStatus === 'released'
            }
        });
    } catch (error) {
        console.error('Get report error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get report',
            error: error.message
        });
    }
});

// Download report
router.post('/download/:reportId', allowUserOrAdmin, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { userId } = req.user;

        const mergedReport = await MergedReport.findById(reportId)
            .populate('policyId', 'propertyDetails contactDetails userId');

        if (!mergedReport) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Check ownership for non-admin users
        if (req.user.model === 'User' && mergedReport.policyId.userId !== userId) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (mergedReport.releaseStatus !== 'released') {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Report is not yet available for download'
            });
        }

        // Log access and increment download count
        mergedReport.logAccess(
            req.user.userId,
            'download',
            req.ip,
            req.get('User-Agent')
        );
        mergedReport.downloadCount = (mergedReport.downloadCount || 0) + 1;
        mergedReport.lastDownloadedAt = new Date();
        await mergedReport.save();

        // Return the complete report data
        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Report downloaded successfully',
            data: {
                reportId: mergedReport._id,
                policyId: mergedReport.policyId._id,
                downloadCount: mergedReport.downloadCount,
                propertyDetails: mergedReport.policyId.propertyDetails,
                finalRecommendation: mergedReport.finalRecommendation,
                paymentEnabled: mergedReport.paymentEnabled,
                conflictDetected: mergedReport.conflictDetected,
                reportSections: mergedReport.reportSections,
                mergingMetadata: mergedReport.mergingMetadata,
                releasedAt: mergedReport.releasedAt
            }
        });
    } catch (error) {
        console.error('Download report error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to download report',
            error: error.message
        });
    }
});

module.exports = router;
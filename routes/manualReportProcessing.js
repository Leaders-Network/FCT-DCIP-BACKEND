const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middlewares/authentication');
const DualAssignment = require('../models/DualAssignment');
const MergedReport = require('../models/MergedReport');
const AutoReportMerger = require('../services/AutoReportMerger');
const { StatusCodes } = require('http-status-codes');

// @route   GET /api/v1/manual-processing/status
// @desc    Get processing status and pending assignments
// @access  Private (Admin)
router.get('/status', protect, restrictTo('Admin', 'Super-admin'), async (req, res) => {
    try {
        // Get pending assignments
        const pendingAssignments = await DualAssignment.find({
            completionStatus: 100,
            $or: [
                { processingStatus: { $exists: false } },
                { processingStatus: { $ne: 'completed' } },
                { mergedReportId: { $exists: false } }
            ]
        }).populate('policyId', 'propertyDetails.address userId');

        // Get merged reports stats
        const [totalMerged, releasedReports, pendingReports, withheldReports] = await Promise.all([
            MergedReport.countDocuments(),
            MergedReport.countDocuments({ releaseStatus: 'released' }),
            MergedReport.countDocuments({ releaseStatus: 'pending' }),
            MergedReport.countDocuments({ releaseStatus: 'withheld' })
        ]);

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                pendingAssignments: {
                    count: pendingAssignments.length,
                    assignments: pendingAssignments.map(assignment => ({
                        id: assignment._id,
                        policyId: assignment.policyId._id,
                        address: assignment.policyId.propertyDetails?.address,
                        userId: assignment.policyId.userId,
                        completionStatus: assignment.completionStatus,
                        processingStatus: assignment.processingStatus,
                        hasMergedReport: !!assignment.mergedReportId,
                        createdAt: assignment.createdAt,
                        updatedAt: assignment.updatedAt
                    }))
                },
                mergedReports: {
                    total: totalMerged,
                    released: releasedReports,
                    pending: pendingReports,
                    withheld: withheldReports
                }
            }
        });
    } catch (error) {
        console.error('Get processing status error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get processing status',
            error: error.message
        });
    }
});

// @route   POST /api/v1/manual-processing/process-all
// @desc    Manually process all pending assignments
// @access  Private (Admin)
router.post('/process-all', protect, restrictTo('Admin', 'Super-admin'), async (req, res) => {
    try {
        const pendingAssignments = await DualAssignment.find({
            completionStatus: 100,
            $or: [
                { processingStatus: { $exists: false } },
                { processingStatus: { $ne: 'completed' } },
                { mergedReportId: { $exists: false } }
            ]
        }).limit(10); // Process max 10 at a time

        if (pendingAssignments.length === 0) {
            return res.status(StatusCodes.OK).json({
                success: true,
                message: 'No pending assignments to process',
                data: { processed: 0, errors: [] }
            });
        }

        const autoMerger = new AutoReportMerger();
        const results = [];
        const errors = [];

        for (const assignment of pendingAssignments) {
            try {
                console.log(`Processing assignment: ${assignment._id}`);
                const result = await autoMerger.processDualAssignment(assignment._id);
                results.push({
                    assignmentId: assignment._id,
                    success: true,
                    mergedReportId: result.mergedReportId,
                    conflictsDetected: result.conflictsDetected,
                    recommendation: result.recommendation
                });
            } catch (error) {
                console.error(`Failed to process assignment ${assignment._id}:`, error);
                errors.push({
                    assignmentId: assignment._id,
                    error: error.message
                });
            }
        }

        res.status(StatusCodes.OK).json({
            success: true,
            message: `Processed ${results.length} assignments successfully`,
            data: {
                processed: results.length,
                failed: errors.length,
                results,
                errors
            }
        });
    } catch (error) {
        console.error('Manual processing error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to process assignments',
            error: error.message
        });
    }
});

// @route   POST /api/v1/manual-processing/process-single/:assignmentId
// @desc    Manually process a single assignment
// @access  Private (Admin)
router.post('/process-single/:assignmentId', protect, restrictTo('Admin', 'Super-admin'), async (req, res) => {
    try {
        const { assignmentId } = req.params;

        const assignment = await DualAssignment.findById(assignmentId);
        if (!assignment) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        if (assignment.completionStatus !== 100) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Assignment is not yet completed'
            });
        }

        const autoMerger = new AutoReportMerger();
        const result = await autoMerger.processDualAssignment(assignmentId);

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Assignment processed successfully',
            data: {
                assignmentId,
                mergedReportId: result.mergedReportId,
                conflictsDetected: result.conflictsDetected,
                recommendation: result.recommendation,
                processingTime: result.processingTime
            }
        });
    } catch (error) {
        console.error('Single assignment processing error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to process assignment',
            error: error.message
        });
    }
});

// @route   POST /api/v1/manual-processing/release-reports
// @desc    Release all pending merged reports
// @access  Private (Admin)
router.post('/release-reports', protect, restrictTo('Admin', 'Super-admin'), async (req, res) => {
    try {
        const pendingReports = await MergedReport.find({
            releaseStatus: 'pending',
            conflictDetected: false
        });

        let releasedCount = 0;
        const errors = [];

        for (const report of pendingReports) {
            try {
                report.releaseStatus = 'released';
                report.releasedAt = new Date();
                report.releasedBy = req.user.userId;
                await report.save();
                releasedCount++;
            } catch (error) {
                errors.push({
                    reportId: report._id,
                    error: error.message
                });
            }
        }

        res.status(StatusCodes.OK).json({
            success: true,
            message: `Released ${releasedCount} reports successfully`,
            data: {
                released: releasedCount,
                failed: errors.length,
                errors
            }
        });
    } catch (error) {
        console.error('Release reports error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to release reports',
            error: error.message
        });
    }
});

module.exports = router;
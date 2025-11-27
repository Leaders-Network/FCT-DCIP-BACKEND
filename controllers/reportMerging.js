const { StatusCodes } = require('http-status-codes');
const AutoReportMerger = require('../services/AutoReportMerger');
const MergedReport = require('../models/MergedReport');
const DualAssignment = require('../models/DualAssignment');
const ProcessingJob = require('../models/ProcessingJob');

// Initialize the auto report merger
const autoMerger = new AutoReportMerger();

// @desc    Trigger automatic report merging for a specific dual assignment
// @route   POST /api/v1/report-merging/process/:dualAssignmentId
// @access  Private (Admin)
const processDualAssignment = async (req, res) => {
    try {
        const { dualAssignmentId } = req.params;

        // Check if assignment exists
        const assignment = await DualAssignment.findById(dualAssignmentId);
        if (!assignment) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Dual assignment not found'
            });
        }

        // Check if already processed
        if (assignment.mergedReportId) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: 'Assignment already processed',
                mergedReportId: assignment.mergedReportId
            });
        }

        // Create processing job
        const processingJob = new ProcessingJob({
            jobType: 'report_merging',
            entityId: dualAssignmentId,
            entityType: 'DualAssignment',
            status: 'processing',
            startedAt: new Date(),
            initiatedBy: req.user.userId
        });
        await processingJob.save();

        // Process the assignment
        const result = await autoMerger.processDualAssignment(dualAssignmentId);

        // Update processing job
        processingJob.status = 'completed';
        processingJob.completedAt = new Date();
        processingJob.result = result;
        await processingJob.save();

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Report merging completed successfully',
            data: {
                mergedReportId: result.mergedReportId,
                conflictsDetected: result.conflictsDetected,
                processingTime: result.processingTime,
                recommendation: result.recommendation,
                processingJobId: processingJob._id
            }
        });

    } catch (error) {
        console.error('Process dual assignment error:', error);

        // Update processing job with error
        if (processingJob) {
            processingJob.status = 'failed';
            processingJob.completedAt = new Date();
            processingJob.error = error.message;
            await processingJob.save();
        }

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to process dual assignment',
            error: error.message
        });
    }
};

// @desc    Process all pending dual assignments
// @route   POST /api/v1/report-merging/process-all
// @access  Private (Admin)
const processAllPending = async (req, res) => {
    try {
        // Get count of pending assignments
        const pendingCount = await DualAssignment.countDocuments({
            completionStatus: 100,
            processingStatus: { $ne: 'completed' },
            mergedReportId: { $exists: false }
        });

        if (pendingCount === 0) {
            return res.status(StatusCodes.OK).json({
                success: true,
                message: 'No pending assignments to process',
                data: { processedCount: 0 }
            });
        }

        // Create batch processing job
        const batchJob = new ProcessingJob({
            jobType: 'batch_report_merging',
            entityType: 'DualAssignment',
            status: 'processing',
            startedAt: new Date(),
            initiatedBy: req.user.userId,
            metadata: { expectedCount: pendingCount }
        });
        await batchJob.save();

        // Process all pending (run in background)
        setImmediate(async () => {
            try {
                await autoMerger.processAllPending();

                batchJob.status = 'completed';
                batchJob.completedAt = new Date();
                batchJob.result = { processedCount: pendingCount };
                await batchJob.save();
            } catch (error) {
                batchJob.status = 'failed';
                batchJob.completedAt = new Date();
                batchJob.error = error.message;
                await batchJob.save();
            }
        });

        res.status(StatusCodes.ACCEPTED).json({
            success: true,
            message: `Batch processing started for ${pendingCount} assignments`,
            data: {
                batchJobId: batchJob._id,
                expectedCount: pendingCount,
                status: 'processing'
            }
        });

    } catch (error) {
        console.error('Process all pending error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to start batch processing',
            error: error.message
        });
    }
};

// @desc    Get merged report details
// @route   GET /api/v1/report-merging/merged-report/:reportId
// @access  Private (Admin/User)
const getMergedReport = async (req, res) => {
    try {
        const { reportId } = req.params;

        const report = await MergedReport.findById(reportId)
            .populate('policyId', 'propertyDetails contactDetails status')
            .populate('dualAssignmentId')
            .populate('ammcSubmissionId')
            .populate('niaSubmissionId');

        if (!report) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Merged report not found'
            });
        }

        res.status(StatusCodes.OK).json({
            success: true,
            data: report
        });

    } catch (error) {
        console.error('Get merged report error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get merged report',
            error: error.message
        });
    }
};

// @desc    Get processing job status
// @route   GET /api/v1/report-merging/job/:jobId
// @access  Private (Admin)
const getProcessingJobStatus = async (req, res) => {
    try {
        const { jobId } = req.params;

        const job = await ProcessingJob.findById(jobId);
        if (!job) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Processing job not found'
            });
        }

        res.status(StatusCodes.OK).json({
            success: true,
            data: job
        });

    } catch (error) {
        console.error('Get processing job status error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get job status',
            error: error.message
        });
    }
};

// @desc    Get merging statistics
// @route   GET /api/v1/report-merging/stats
// @access  Private (Admin)
const getMergingStats = async (req, res) => {
    try {
        const { timeframe = '7d' } = req.query;

        // Calculate time filter
        const now = new Date();
        let timeFilter;
        switch (timeframe) {
            case '24h':
                timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30d':
                timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        const stats = await Promise.all([
            // Total merged reports
            MergedReport.countDocuments({ createdAt: { $gte: timeFilter } }),

            // Reports by release status
            MergedReport.aggregate([
                { $match: { createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$releaseStatus', count: { $sum: 1 } } }
            ]),

            // Conflict detection rate
            MergedReport.aggregate([
                { $match: { createdAt: { $gte: timeFilter } } },
                {
                    $group: {
                        _id: '$conflictDetected',
                        count: { $sum: 1 },
                        avgConfidence: { $avg: '$confidenceScore' }
                    }
                }
            ]),

            // Average processing time
            MergedReport.aggregate([
                {
                    $match: {
                        createdAt: { $gte: timeFilter },
                        'mergingMetadata.processingTime': { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgProcessingTime: { $avg: '$mergingMetadata.processingTime' },
                        minProcessingTime: { $min: '$mergingMetadata.processingTime' },
                        maxProcessingTime: { $max: '$mergingMetadata.processingTime' }
                    }
                }
            ]),

            // Pending assignments
            DualAssignment.countDocuments({
                completionStatus: 100,
                processingStatus: { $ne: 'completed' },
                mergedReportId: { $exists: false }
            })
        ]);

        const [totalReports, statusBreakdown, conflictStats, processingTimes, pendingCount] = stats;

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                timeframe,
                totalReports,
                pendingAssignments: pendingCount,
                statusBreakdown: statusBreakdown.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                conflictDetection: {
                    withConflicts: conflictStats.find(s => s._id === true)?.count || 0,
                    withoutConflicts: conflictStats.find(s => s._id === false)?.count || 0,
                    avgConfidenceWithConflicts: conflictStats.find(s => s._id === true)?.avgConfidence || 0,
                    avgConfidenceWithoutConflicts: conflictStats.find(s => s._id === false)?.avgConfidence || 0
                },
                processingPerformance: processingTimes[0] || {
                    avgProcessingTime: 0,
                    minProcessingTime: 0,
                    maxProcessingTime: 0
                }
            }
        });

    } catch (error) {
        console.error('Get merging stats error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get merging statistics',
            error: error.message
        });
    }
};

// @desc    Reprocess a merged report (admin override)
// @route   POST /api/v1/report-merging/reprocess/:reportId
// @access  Private (Admin)
const reprocessMergedReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { reason } = req.body;

        const report = await MergedReport.findById(reportId);
        if (!report) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Merged report not found'
            });
        }

        // Archive the old report
        report.releaseStatus = 'archived';
        report.archiveReason = reason || 'Reprocessed by admin';
        report.archivedAt = new Date();
        report.archivedBy = req.user.userId;
        await report.save();

        // Reprocess the dual assignment
        const result = await autoMerger.processDualAssignment(report.dualAssignmentId);

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Report reprocessed successfully',
            data: {
                oldReportId: reportId,
                newReportId: result.mergedReportId,
                conflictsDetected: result.conflictsDetected,
                processingTime: result.processingTime
            }
        });

    } catch (error) {
        console.error('Reprocess merged report error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to reprocess report',
            error: error.message
        });
    }
};

module.exports = {
    processDualAssignment,
    processAllPending,
    getMergedReport,
    getProcessingJobStatus,
    getMergingStats,
    reprocessMergedReport
};
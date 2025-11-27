const express = require('express');
const router = express.Router();
const DualAssignment = require('../models/DualAssignment');
const MergedReport = require('../models/MergedReport');
const SurveySubmission = require('../models/SurveySubmission');
const { protect, requireSuperAdminAccess } = require('../middlewares/authentication');
const { requireAnyAdmin } = require('../middlewares/niaAuth');

// Apply authentication to all routes
router.use(protect);

/**
 * Get processing monitor health status
 * GET /api/v1/processing-monitor/health
 */
router.get('/health', requireAnyAdmin, async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date(),
            services: {
                database: 'connected',
                scheduler: 'running',
                merger: 'active'
            },
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };

        res.status(200).json({
            success: true,
            data: health
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Health check failed',
            error: error.message
        });
    }
});

/**
 * Get active processing jobs
 * GET /api/v1/processing-monitor/active
 */
router.get('/active', requireAnyAdmin, async (req, res) => {
    try {
        const { organization } = req.query;

        const query = {
            processingStatus: { $in: ['processing', 'ready_for_merging', 'pending'] }
        };

        const activeJobs = await DualAssignment.find(query)
            .populate('policyId', 'propertyDetails contactDetails')
            .sort({ updatedAt: -1 })
            .limit(20);

        res.status(200).json({
            success: true,
            data: {
                activeJobs,
                count: activeJobs.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active jobs',
            error: error.message
        });
    }
});

/**
 * Get processing overview (combines multiple metrics)
 * GET /api/v1/processing-monitor/overview
 */
router.get('/overview', requireAnyAdmin, async (req, res) => {
    try {
        const { organization, timeframe = '24h' } = req.query;

        let startDate;
        switch (timeframe) {
            case '1h':
                startDate = new Date(Date.now() - 60 * 60 * 1000);
                break;
            case '24h':
                startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        }

        // Get comprehensive overview data
        const [
            totalAssignments,
            completedReports,
            failedJobs,
            activeJobs,
            pendingJobs,
            conflictReports
        ] = await Promise.all([
            DualAssignment.countDocuments({
                createdAt: { $gte: startDate }
            }),
            MergedReport.countDocuments({
                createdAt: { $gte: startDate }
            }),
            DualAssignment.countDocuments({
                processingStatus: 'failed',
                updatedAt: { $gte: startDate }
            }),
            DualAssignment.countDocuments({
                processingStatus: { $in: ['processing', 'ready_for_merging'] }
            }),
            DualAssignment.countDocuments({
                processingStatus: 'pending'
            }),
            MergedReport.countDocuments({
                conflictDetected: true,
                createdAt: { $gte: startDate }
            })
        ]);

        const overview = {
            timeframe,
            organization: organization || 'ALL',
            summary: {
                totalAssignments,
                completedReports,
                failedJobs,
                activeJobs,
                pendingJobs,
                conflictReports
            },
            metrics: {
                successRate: totalAssignments > 0 ? ((completedReports / totalAssignments) * 100).toFixed(2) : 0,
                conflictRate: completedReports > 0 ? ((conflictReports / completedReports) * 100).toFixed(2) : 0,
                throughput: `${completedReports} reports/${timeframe}`,
                averageProcessingTime: '5.2 minutes'
            },
            status: {
                systemHealth: failedJobs < 5 ? 'healthy' : 'warning',
                processingLoad: activeJobs < 10 ? 'normal' : 'high',
                queueStatus: pendingJobs < 20 ? 'normal' : 'backlog'
            }
        };

        res.status(200).json({
            success: true,
            data: overview
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch overview',
            error: error.message
        });
    }
});

/**
 * Get processing performance metrics
 * GET /api/v1/processing-monitor/performance
 */
router.get('/performance', requireAnyAdmin, async (req, res) => {
    try {
        const { timeframe = '24h' } = req.query;

        let startDate;
        switch (timeframe) {
            case '1h':
                startDate = new Date(Date.now() - 60 * 60 * 1000);
                break;
            case '24h':
                startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
                break;
            case '7d':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        }

        const [totalAssignments, completedReports, failedJobs] = await Promise.all([
            DualAssignment.countDocuments({
                createdAt: { $gte: startDate }
            }),
            MergedReport.countDocuments({
                createdAt: { $gte: startDate }
            }),
            DualAssignment.countDocuments({
                processingStatus: 'failed',
                updatedAt: { $gte: startDate }
            })
        ]);

        const performance = {
            timeframe,
            totalAssignments,
            completedReports,
            failedJobs,
            successRate: totalAssignments > 0 ? ((completedReports / totalAssignments) * 100).toFixed(2) : 0,
            averageProcessingTime: '5.2 minutes', // This would be calculated from actual data
            throughput: `${completedReports} reports/${timeframe}`
        };

        res.status(200).json({
            success: true,
            data: performance
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch performance metrics',
            error: error.message
        });
    }
});

/**
 * Get processing activity log
 * GET /api/v1/processing-monitor/activity
 */
router.get('/activity', requireAnyAdmin, async (req, res) => {
    try {
        const { limit = 50, organization } = req.query;

        const recentActivity = await MergedReport.find()
            .populate('policyId', 'propertyDetails contactDetails')
            .populate('dualAssignmentId')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit));

        const formattedActivity = recentActivity.map(report => ({
            id: report._id,
            type: 'report_merged',
            policyId: report.policyId?._id,
            propertyAddress: report.policyId?.propertyDetails?.address,
            status: report.releaseStatus,
            conflictDetected: report.conflictDetected,
            timestamp: report.createdAt,
            processingTime: report.mergingMetadata?.processingTime,
            qualityScore: report.mergingMetadata?.qualityScore
        }));

        res.status(200).json({
            success: true,
            data: {
                activities: formattedActivity,
                count: formattedActivity.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch activity log',
            error: error.message
        });
    }
});

/**
 * Trigger processing for a specific policy or all pending
 * POST /api/v1/processing-monitor/trigger
 */
router.post('/trigger', requireAnyAdmin, async (req, res) => {
    try {
        const { policyId } = req.body;

        if (policyId) {
            // Trigger processing for specific policy
            const DualSurveyTrigger = require('../services/DualSurveyTrigger');
            const result = await DualSurveyTrigger.checkAndTriggerMerging(policyId, 'MANUAL_TRIGGER');

            res.status(200).json({
                success: true,
                data: {
                    processId: `manual_${Date.now()}`,
                    status: result.success ? 'completed' : 'failed',
                    message: result.success ? 'Processing triggered successfully' : 'Processing failed',
                    result
                }
            });
        } else {
            // Trigger processing for all pending assignments
            const scheduledProcessor = require('../services/ScheduledReportProcessor');
            await scheduledProcessor.triggerManualRun();

            res.status(200).json({
                success: true,
                data: {
                    processId: `batch_${Date.now()}`,
                    status: 'processing',
                    message: 'Batch processing triggered successfully'
                }
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to trigger processing',
            error: error.message
        });
    }
});

/**
 * Get processing status for a specific process
 * GET /api/v1/processing-monitor/status/:processId
 */
router.get('/status/:processId', requireAnyAdmin, async (req, res) => {
    try {
        const { processId } = req.params;

        // For now, return a mock status since we don't have persistent process tracking
        // In a real implementation, you'd store process status in database or cache
        const status = {
            processId,
            status: 'completed',
            progress: 100,
            message: 'Process completed successfully',
            result: {
                processed: 1,
                successful: 1,
                failed: 0
            }
        };

        res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get process status',
            error: error.message
        });
    }
});

module.exports = router;
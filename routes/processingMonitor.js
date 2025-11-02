const express = require('express');
const router = express.Router();
const MergedReport = require('../models/MergedReport');
const DualAssignment = require('../models/DualAssignment');
const AutomaticConflictFlag = require('../models/AutomaticConflictFlag');
const UserConflictInquiry = require('../models/UserConflictInquiry');
const SurveySubmission = require('../models/SurveySubmission');
const { protect, restrictTo } = require('../middlewares/authentication');

// @route   GET /api/v1/admin/processing-monitor/overview
// @desc    Get processing overview statistics
// @access  Private (Admin)
router.get('/overview', protect, restrictTo('Admin', 'Super-admin', 'NIA-Admin'), async (req, res) => {
    try {
        const { organization, timeframe = '24h' } = req.query;

        // Calculate time filter
        const timeFilter = getTimeFilter(timeframe);

        // Build organization filter
        let orgFilter = {};
        if (organization && organization !== 'all') {
            orgFilter = { organization: organization };
        }

        // Get processing statistics
        const stats = await Promise.all([
            // Total dual assignments
            DualAssignment.countDocuments({ createdAt: { $gte: timeFilter } }),

            // Assignments by status
            DualAssignment.aggregate([
                { $match: { createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$assignmentStatus', count: { $sum: 1 } } }
            ]),

            // Completion status
            DualAssignment.aggregate([
                { $match: { createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$completionStatus', count: { $sum: 1 } } }
            ]),

            // Merged reports
            MergedReport.countDocuments({ createdAt: { $gte: timeFilter } }),

            // Reports by status
            MergedReport.aggregate([
                { $match: { createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$releaseStatus', count: { $sum: 1 } } }
            ]),

            // Conflict flags
            AutomaticConflictFlag.countDocuments({ createdAt: { $gte: timeFilter } }),

            // Active conflicts by severity
            AutomaticConflictFlag.aggregate([
                { $match: { createdAt: { $gte: timeFilter }, flagStatus: 'active' } },
                { $group: { _id: '$conflictSeverity', count: { $sum: 1 } } }
            ]),

            // User inquiries
            UserConflictInquiry.countDocuments({ createdAt: { $gte: timeFilter } }),

            // Processing performance (average processing time)
            MergedReport.aggregate([
                { $match: { createdAt: { $gte: timeFilter }, 'mergingMetadata.processingTime': { $exists: true } } },
                { $group: { _id: null, avgProcessingTime: { $avg: '$mergingMetadata.processingTime' } } }
            ])
        ]);

        // Format response
        const assignmentStatusMap = { unassigned: 0, partially_assigned: 0, fully_assigned: 0 };
        stats[1].forEach(item => assignmentStatusMap[item._id] = item.count);

        const completionStatusMap = { 0: 0, 50: 0, 100: 0 };
        stats[2].forEach(item => completionStatusMap[item._id] = item.count);

        const releaseStatusMap = { pending: 0, withheld: 0, released: 0 };
        stats[4].forEach(item => releaseStatusMap[item._id] = item.count);

        const conflictSeverityMap = { low: 0, medium: 0, high: 0, critical: 0 };
        stats[6].forEach(item => conflictSeverityMap[item._id] = item.count);

        res.json({
            success: true,
            data: {
                timeframe: timeframe,
                organization: organization || 'all',
                overview: {
                    totalDualAssignments: stats[0],
                    totalMergedReports: stats[3],
                    totalConflictFlags: stats[5],
                    totalUserInquiries: stats[7],
                    averageProcessingTime: stats[8][0]?.avgProcessingTime || 0
                },
                assignmentStatus: assignmentStatusMap,
                completionStatus: completionStatusMap,
                releaseStatus: releaseStatusMap,
                activeConflictsBySeverity: conflictSeverityMap,
                generatedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Error fetching processing overview:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch processing overview',
            error: error.message
        });
    }
});

// @route   GET /api/v1/admin/processing-monitor/active-processing
// @desc    Get currently active processing jobs
// @access  Private (Admin)
router.get('/active-processing', protect, restrictTo('Admin', 'Super-admin', 'NIA-Admin'), async (req, res) => {
    try {
        const { organization } = req.query;

        // Get dual assignments that are currently being processed
        let filter = {
            $or: [
                { assignmentStatus: 'partially_assigned' },
                { completionStatus: 50 }
            ]
        };

        const activeProcessing = await DualAssignment.find(filter)
            .populate('policyId', 'propertyDetails contactDetails status')
            .populate('ammcAssignmentId', 'assignedSurveyor status')
            .populate('niaAssignmentId', 'assignedSurveyor status')
            .sort({ updatedAt: -1 })
            .limit(50);

        // Get pending merged reports
        const pendingReports = await MergedReport.find({
            releaseStatus: 'pending',
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        })
            .populate('policyId', 'propertyDetails contactDetails')
            .populate('dualAssignmentId', 'assignmentStatus completionStatus')
            .sort({ createdAt: -1 })
            .limit(20);

        // Get recent survey submissions waiting for merge
        const recentSubmissions = await SurveySubmission.find({
            is_merged: false,
            createdAt: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } // Last 6 hours
        })
            .populate('policyId', 'propertyDetails')
            .populate('assignmentId', 'organization')
            .sort({ createdAt: -1 })
            .limit(30);

        res.json({
            success: true,
            data: {
                activeAssignments: activeProcessing,
                pendingReports: pendingReports,
                recentSubmissions: recentSubmissions,
                lastUpdated: new Date()
            }
        });

    } catch (error) {
        console.error('Error fetching active processing:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active processing data',
            error: error.message
        });
    }
});

// @route   GET /api/v1/admin/processing-monitor/performance-metrics
// @desc    Get processing performance metrics
// @access  Private (Admin)
router.get('/performance-metrics', protect, restrictTo('Admin', 'Super-admin', 'NIA-Admin'), async (req, res) => {
    try {
        const { timeframe = '7d', organization } = req.query;
        const timeFilter = getTimeFilter(timeframe);

        // Get performance metrics
        const metrics = await Promise.all([
            // Average processing times
            MergedReport.aggregate([
                { $match: { createdAt: { $gte: timeFilter } } },
                {
                    $group: {
                        _id: null,
                        avgProcessingTime: { $avg: '$mergingMetadata.processingTime' },
                        minProcessingTime: { $min: '$mergingMetadata.processingTime' },
                        maxProcessingTime: { $max: '$mergingMetadata.processingTime' },
                        totalReports: { $sum: 1 }
                    }
                }
            ]),

            // Success rates
            MergedReport.aggregate([
                { $match: { createdAt: { $gte: timeFilter } } },
                {
                    $group: {
                        _id: '$releaseStatus',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Conflict detection rates
            AutomaticConflictFlag.aggregate([
                { $match: { createdAt: { $gte: timeFilter } } },
                {
                    $group: {
                        _id: '$conflictSeverity',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Assignment completion times
            DualAssignment.aggregate([
                {
                    $match: {
                        createdAt: { $gte: timeFilter },
                        completionStatus: 100
                    }
                },
                {
                    $addFields: {
                        completionTime: { $subtract: ['$updatedAt', '$createdAt'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgCompletionTime: { $avg: '$completionTime' },
                        minCompletionTime: { $min: '$completionTime' },
                        maxCompletionTime: { $max: '$completionTime' }
                    }
                }
            ]),

            // Daily processing volume
            MergedReport.aggregate([
                { $match: { createdAt: { $gte: timeFilter } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        // Format success rates
        const successRates = { pending: 0, withheld: 0, released: 0 };
        metrics[1].forEach(item => successRates[item._id] = item.count);

        // Format conflict rates
        const conflictRates = { low: 0, medium: 0, high: 0, critical: 0 };
        metrics[2].forEach(item => conflictRates[item._id] = item.count);

        res.json({
            success: true,
            data: {
                timeframe: timeframe,
                processingPerformance: metrics[0][0] || {
                    avgProcessingTime: 0,
                    minProcessingTime: 0,
                    maxProcessingTime: 0,
                    totalReports: 0
                },
                successRates: successRates,
                conflictDetectionRates: conflictRates,
                assignmentCompletion: metrics[3][0] || {
                    avgCompletionTime: 0,
                    minCompletionTime: 0,
                    maxCompletionTime: 0
                },
                dailyVolume: metrics[4],
                generatedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Error fetching performance metrics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch performance metrics',
            error: error.message
        });
    }
});

// @route   GET /api/v1/admin/processing-monitor/system-health
// @desc    Get system health indicators
// @access  Private (Admin)
router.get('/system-health', protect, restrictTo('Admin', 'Super-admin', 'NIA-Admin'), async (req, res) => {
    try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Check for system health indicators
        const healthChecks = await Promise.all([
            // Recent processing activity
            MergedReport.countDocuments({ createdAt: { $gte: oneHourAgo } }),

            // Stuck processing (reports pending for more than 1 hour)
            MergedReport.countDocuments({
                releaseStatus: 'pending',
                createdAt: { $lt: oneHourAgo }
            }),

            // High priority conflicts unresolved
            AutomaticConflictFlag.countDocuments({
                priority: { $in: ['high', 'urgent'] },
                flagStatus: 'active',
                createdAt: { $lt: oneDayAgo }
            }),

            // User inquiries without response
            UserConflictInquiry.countDocuments({
                inquiryStatus: 'open',
                createdAt: { $lt: oneDayAgo }
            }),

            // Failed processing attempts (reports withheld)
            MergedReport.countDocuments({
                releaseStatus: 'withheld',
                createdAt: { $gte: oneDayAgo }
            })
        ]);

        // Determine system health status
        const recentActivity = healthChecks[0];
        const stuckProcessing = healthChecks[1];
        const unresolvedHighPriorityConflicts = healthChecks[2];
        const unansweredInquiries = healthChecks[3];
        const failedProcessing = healthChecks[4];

        let systemStatus = 'healthy';
        let alerts = [];

        if (stuckProcessing > 5) {
            systemStatus = 'warning';
            alerts.push(`${stuckProcessing} reports stuck in processing for over 1 hour`);
        }

        if (unresolvedHighPriorityConflicts > 3) {
            systemStatus = 'warning';
            alerts.push(`${unresolvedHighPriorityConflicts} high-priority conflicts unresolved for over 24 hours`);
        }

        if (unansweredInquiries > 10) {
            systemStatus = 'warning';
            alerts.push(`${unansweredInquiries} user inquiries without response for over 24 hours`);
        }

        if (failedProcessing > 10) {
            systemStatus = 'critical';
            alerts.push(`${failedProcessing} reports failed processing in the last 24 hours`);
        }

        if (recentActivity === 0 && new Date().getHours() > 8 && new Date().getHours() < 18) {
            systemStatus = 'warning';
            alerts.push('No processing activity in the last hour during business hours');
        }

        res.json({
            success: true,
            data: {
                systemStatus: systemStatus,
                alerts: alerts,
                metrics: {
                    recentActivity: recentActivity,
                    stuckProcessing: stuckProcessing,
                    unresolvedHighPriorityConflicts: unresolvedHighPriorityConflicts,
                    unansweredInquiries: unansweredInquiries,
                    failedProcessing: failedProcessing
                },
                lastChecked: new Date()
            }
        });

    } catch (error) {
        console.error('Error checking system health:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check system health',
            error: error.message
        });
    }
});

// @route   GET /api/v1/admin/processing-monitor/recent-activity
// @desc    Get recent processing activity feed
// @access  Private (Admin)
router.get('/recent-activity', protect, restrictTo('Admin', 'Super-admin', 'NIA-Admin'), async (req, res) => {
    try {
        const { limit = 50, organization } = req.query;
        const timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

        // Get recent activities from different sources
        const activities = [];

        // Recent merged reports
        const recentReports = await MergedReport.find({ createdAt: { $gte: timeFilter } })
            .populate('policyId', 'propertyDetails')
            .sort({ createdAt: -1 })
            .limit(20);

        recentReports.forEach(report => {
            activities.push({
                type: 'report_merged',
                timestamp: report.createdAt,
                policyId: report.policyId._id,
                propertyAddress: report.policyId.propertyDetails?.address || 'N/A',
                status: report.releaseStatus,
                conflictDetected: report.conflictDetected,
                details: `Report merged and ${report.releaseStatus}`
            });
        });

        // Recent conflict flags
        const recentConflicts = await AutomaticConflictFlag.find({ createdAt: { $gte: timeFilter } })
            .populate('policyId', 'propertyDetails')
            .sort({ createdAt: -1 })
            .limit(15);

        recentConflicts.forEach(conflict => {
            activities.push({
                type: 'conflict_detected',
                timestamp: conflict.createdAt,
                policyId: conflict.policyId._id,
                propertyAddress: conflict.policyId.propertyDetails?.address || 'N/A',
                severity: conflict.conflictSeverity,
                conflictType: conflict.conflictType,
                details: `${conflict.conflictSeverity} conflict detected: ${conflict.conflictType}`
            });
        });

        // Recent user inquiries
        const recentInquiries = await UserConflictInquiry.find({ createdAt: { $gte: timeFilter } })
            .populate('policyId', 'propertyDetails')
            .sort({ createdAt: -1 })
            .limit(15);

        recentInquiries.forEach(inquiry => {
            activities.push({
                type: 'user_inquiry',
                timestamp: inquiry.createdAt,
                policyId: inquiry.policyId._id,
                propertyAddress: inquiry.policyId.propertyDetails?.address || 'N/A',
                inquiryType: inquiry.conflictType,
                status: inquiry.inquiryStatus,
                details: `User inquiry: ${inquiry.conflictType} (${inquiry.inquiryStatus})`
            });
        });

        // Sort all activities by timestamp and limit
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const limitedActivities = activities.slice(0, parseInt(limit));

        res.json({
            success: true,
            data: {
                activities: limitedActivities,
                totalCount: activities.length,
                timeframe: '24h',
                lastUpdated: new Date()
            }
        });

    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch recent activity',
            error: error.message
        });
    }
});

// Helper function to get time filter based on timeframe
function getTimeFilter(timeframe) {
    const now = new Date();
    switch (timeframe) {
        case '1h':
            return new Date(now.getTime() - 60 * 60 * 1000);
        case '24h':
            return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case '7d':
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30d':
            return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        default:
            return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
}

module.exports = router;
const express = require('express');
const router = express.Router();
const DualAssignment = require('../models/DualAssignment');
const MergedReport = require('../models/MergedReport');
const AutomaticConflictFlag = require('../models/AutomaticConflictFlag');
const UserConflictInquiry = require('../models/UserConflictInquiry');
const SurveySubmission = require('../models/SurveySubmission');
const Assignment = require('../models/Assignment');
const PolicyRequest = require('../models/PolicyRequest');
const { protect, restrictTo } = require('../middlewares/authentication');

// @route   GET /api/v1/admin/dashboard-enhanced/overview
// @desc    Get comprehensive dashboard overview for admin
// @access  Private (Admin)
router.get('/overview', protect, restrictTo('Admin', 'Super-admin'), async (req, res) => {
    try {
        const { organization = 'all', timeframe = '30d' } = req.query;
        const timeFilter = getTimeFilter(timeframe);

        // Build organization filter for dual assignments
        let orgFilter = {};
        if (organization === 'AMMC') {
            orgFilter = { ammcAssignmentId: { $ne: null } };
        } else if (organization === 'NIA') {
            orgFilter = { niaAssignmentId: { $ne: null } };
        }

        // Get comprehensive dashboard data
        const dashboardData = await Promise.all([
            // Total policies in system
            PolicyRequest.countDocuments({ createdAt: { $gte: timeFilter } }),

            // Dual assignments overview
            DualAssignment.countDocuments({ ...orgFilter, createdAt: { $gte: timeFilter } }),

            // Assignment status breakdown
            DualAssignment.aggregate([
                { $match: { ...orgFilter, createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$assignmentStatus', count: { $sum: 1 } } }
            ]),

            // Completion status breakdown
            DualAssignment.aggregate([
                { $match: { ...orgFilter, createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$completionStatus', count: { $sum: 1 } } }
            ]),

            // Merged reports
            MergedReport.countDocuments({ createdAt: { $gte: timeFilter } }),

            // Report status breakdown
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

            // Open inquiries by organization
            UserConflictInquiry.aggregate([
                {
                    $match: {
                        createdAt: { $gte: timeFilter },
                        inquiryStatus: { $in: ['open', 'in_progress'] }
                    }
                },
                { $group: { _id: '$assignedOrganization', count: { $sum: 1 } } }
            ]),

            // Recent activity (last 24 hours)
            getRecentActivity(organization),

            // Performance metrics
            getPerformanceMetrics(timeFilter, organization)
        ]);

        // Format the response
        const assignmentStatusMap = { unassigned: 0, partially_assigned: 0, fully_assigned: 0 };
        dashboardData[2].forEach(item => assignmentStatusMap[item._id] = item.count);

        const completionStatusMap = { 0: 0, 50: 0, 100: 0 };
        dashboardData[3].forEach(item => completionStatusMap[item._id] = item.count);

        const reportStatusMap = { pending: 0, withheld: 0, released: 0 };
        dashboardData[5].forEach(item => reportStatusMap[item._id] = item.count);

        const conflictSeverityMap = { low: 0, medium: 0, high: 0, critical: 0 };
        dashboardData[7].forEach(item => conflictSeverityMap[item._id] = item.count);

        const openInquiriesMap = { AMMC: 0, NIA: 0, BOTH: 0 };
        dashboardData[9].forEach(item => openInquiriesMap[item._id] = item.count);

        res.json({
            success: true,
            data: {
                timeframe: timeframe,
                organization: organization,
                overview: {
                    totalPolicies: dashboardData[0],
                    totalDualAssignments: dashboardData[1],
                    totalMergedReports: dashboardData[4],
                    totalConflictFlags: dashboardData[6],
                    totalUserInquiries: dashboardData[8]
                },
                assignmentStatus: assignmentStatusMap,
                completionStatus: completionStatusMap,
                reportStatus: reportStatusMap,
                activeConflictsBySeverity: conflictSeverityMap,
                openInquiriesByOrg: openInquiriesMap,
                recentActivity: dashboardData[10],
                performanceMetrics: dashboardData[11],
                generatedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Error fetching enhanced dashboard overview:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard overview',
            error: error.message
        });
    }
});

// @route   GET /api/v1/admin/dashboard-enhanced/workload
// @desc    Get current workload for admin
// @access  Private (Admin)
router.get('/workload', protect, restrictTo('Admin', 'Super-admin'), async (req, res) => {
    try {
        const { organization = 'all' } = req.query;

        // Get current workload data
        const workloadData = await Promise.all([
            // Pending assignments
            DualAssignment.find({
                assignmentStatus: { $in: ['unassigned', 'partially_assigned'] }
            })
                .populate('policyId', 'propertyDetails contactDetails status createdAt')
                .sort({ createdAt: -1 })
                .limit(20),

            // Active conflicts requiring attention
            AutomaticConflictFlag.find({
                flagStatus: 'active',
                priority: { $in: ['high', 'urgent'] }
            })
                .populate('policyId', 'propertyDetails contactDetails')
                .populate('mergedReportId', 'finalRecommendation')
                .sort({ createdAt: -1 })
                .limit(15),

            // Open user inquiries
            UserConflictInquiry.find({
                inquiryStatus: { $in: ['open', 'in_progress'] },
                ...(organization !== 'all' ? { assignedOrganization: organization } : {})
            })
                .populate('policyId', 'propertyDetails contactDetails')
                .populate('userId', 'fullName email')
                .sort({ createdAt: -1 })
                .limit(15),

            // Reports pending release
            MergedReport.find({
                releaseStatus: 'pending'
            })
                .populate('policyId', 'propertyDetails contactDetails')
                .populate('dualAssignmentId', 'assignmentStatus completionStatus')
                .sort({ createdAt: -1 })
                .limit(10),

            // Overdue assignments (more than 7 days old)
            DualAssignment.find({
                assignmentStatus: { $ne: 'fully_assigned' },
                createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            })
                .populate('policyId', 'propertyDetails contactDetails')
                .sort({ createdAt: 1 })
                .limit(10)
        ]);

        res.json({
            success: true,
            data: {
                organization: organization,
                pendingAssignments: workloadData[0],
                activeHighPriorityConflicts: workloadData[1],
                openInquiries: workloadData[2],
                pendingReports: workloadData[3],
                overdueAssignments: workloadData[4],
                summary: {
                    pendingAssignmentsCount: workloadData[0].length,
                    activeConflictsCount: workloadData[1].length,
                    openInquiriesCount: workloadData[2].length,
                    pendingReportsCount: workloadData[3].length,
                    overdueAssignmentsCount: workloadData[4].length
                },
                lastUpdated: new Date()
            }
        });

    } catch (error) {
        console.error('Error fetching workload data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch workload data',
            error: error.message
        });
    }
});

// @route   GET /api/v1/admin/dashboard-enhanced/alerts
// @desc    Get system alerts and notifications
// @access  Private (Admin)
router.get('/alerts', protect, restrictTo('Admin', 'Super-admin'), async (req, res) => {
    try {
        const { organization = 'all' } = req.query;
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Generate system alerts
        const alerts = [];

        // Check for stuck processing
        const stuckReports = await MergedReport.countDocuments({
            releaseStatus: 'pending',
            createdAt: { $lt: oneHourAgo }
        });

        if (stuckReports > 0) {
            alerts.push({
                type: 'warning',
                category: 'processing',
                title: 'Reports Stuck in Processing',
                message: `${stuckReports} reports have been pending for over 1 hour`,
                count: stuckReports,
                priority: 'medium',
                createdAt: now
            });
        }

        // Check for unresolved high-priority conflicts
        const urgentConflicts = await AutomaticConflictFlag.countDocuments({
            priority: 'urgent',
            flagStatus: 'active',
            createdAt: { $lt: oneDayAgo }
        });

        if (urgentConflicts > 0) {
            alerts.push({
                type: 'error',
                category: 'conflicts',
                title: 'Urgent Conflicts Unresolved',
                message: `${urgentConflicts} urgent conflicts have been active for over 24 hours`,
                count: urgentConflicts,
                priority: 'high',
                createdAt: now
            });
        }

        // Check for unanswered user inquiries
        const unansweredInquiries = await UserConflictInquiry.countDocuments({
            inquiryStatus: 'open',
            createdAt: { $lt: oneDayAgo },
            ...(organization !== 'all' ? { assignedOrganization: organization } : {})
        });

        if (unansweredInquiries > 5) {
            alerts.push({
                type: 'warning',
                category: 'inquiries',
                title: 'Unanswered User Inquiries',
                message: `${unansweredInquiries} user inquiries have been open for over 24 hours`,
                count: unansweredInquiries,
                priority: 'medium',
                createdAt: now
            });
        }

        // Check for overdue assignments
        const overdueAssignments = await DualAssignment.countDocuments({
            assignmentStatus: { $ne: 'fully_assigned' },
            createdAt: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
        });

        if (overdueAssignments > 3) {
            alerts.push({
                type: 'info',
                category: 'assignments',
                title: 'Overdue Assignments',
                message: `${overdueAssignments} assignments are overdue (more than 7 days old)`,
                count: overdueAssignments,
                priority: 'low',
                createdAt: now
            });
        }

        // Check for recent system activity
        const recentActivity = await MergedReport.countDocuments({
            createdAt: { $gte: oneHourAgo }
        });

        if (recentActivity === 0 && now.getHours() >= 9 && now.getHours() <= 17) {
            alerts.push({
                type: 'info',
                category: 'system',
                title: 'Low System Activity',
                message: 'No report processing activity in the last hour during business hours',
                count: 0,
                priority: 'low',
                createdAt: now
            });
        }

        // Sort alerts by priority
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        alerts.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

        res.json({
            success: true,
            data: {
                alerts: alerts,
                alertCount: alerts.length,
                highPriorityCount: alerts.filter(a => a.priority === 'high').length,
                mediumPriorityCount: alerts.filter(a => a.priority === 'medium').length,
                lowPriorityCount: alerts.filter(a => a.priority === 'low').length,
                organization: organization,
                generatedAt: now
            }
        });

    } catch (error) {
        console.error('Error fetching system alerts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch system alerts',
            error: error.message
        });
    }
});

// Helper function to get recent activity
async function getRecentActivity(organization) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activities = [];

    // Recent merged reports
    const recentReports = await MergedReport.find({ createdAt: { $gte: oneDayAgo } })
        .populate('policyId', 'propertyDetails')
        .sort({ createdAt: -1 })
        .limit(10);

    recentReports.forEach(report => {
        activities.push({
            type: 'report_merged',
            timestamp: report.createdAt,
            description: `Report merged for ${report.policyId.propertyDetails?.address || 'property'}`,
            status: report.releaseStatus,
            conflictDetected: report.conflictDetected
        });
    });

    // Recent conflicts
    const recentConflicts = await AutomaticConflictFlag.find({ createdAt: { $gte: oneDayAgo } })
        .populate('policyId', 'propertyDetails')
        .sort({ createdAt: -1 })
        .limit(8);

    recentConflicts.forEach(conflict => {
        activities.push({
            type: 'conflict_detected',
            timestamp: conflict.createdAt,
            description: `${conflict.conflictSeverity} conflict detected for ${conflict.policyId.propertyDetails?.address || 'property'}`,
            severity: conflict.conflictSeverity,
            conflictType: conflict.conflictType
        });
    });

    // Sort by timestamp and return top 15
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return activities.slice(0, 15);
}

// Helper function to get performance metrics
async function getPerformanceMetrics(timeFilter, organization) {
    const metrics = await Promise.all([
        // Average processing time
        MergedReport.aggregate([
            { $match: { createdAt: { $gte: timeFilter } } },
            {
                $group: {
                    _id: null,
                    avgProcessingTime: { $avg: '$mergingMetadata.processingTime' },
                    totalReports: { $sum: 1 }
                }
            }
        ]),

        // Success rate
        MergedReport.aggregate([
            { $match: { createdAt: { $gte: timeFilter } } },
            {
                $group: {
                    _id: '$releaseStatus',
                    count: { $sum: 1 }
                }
            }
        ]),

        // Conflict resolution rate
        AutomaticConflictFlag.aggregate([
            { $match: { createdAt: { $gte: timeFilter } } },
            {
                $group: {
                    _id: '$flagStatus',
                    count: { $sum: 1 }
                }
            }
        ])
    ]);

    const processingMetrics = metrics[0][0] || { avgProcessingTime: 0, totalReports: 0 };

    const successRates = { pending: 0, withheld: 0, released: 0 };
    metrics[1].forEach(item => successRates[item._id] = item.count);

    const conflictResolution = { active: 0, reviewed: 0, resolved: 0, dismissed: 0 };
    metrics[2].forEach(item => conflictResolution[item._id] = item.count);

    return {
        averageProcessingTime: processingMetrics.avgProcessingTime,
        totalReportsProcessed: processingMetrics.totalReports,
        successRate: successRates.released / (successRates.released + successRates.withheld + successRates.pending) * 100 || 0,
        conflictResolutionRate: conflictResolution.resolved / (conflictResolution.resolved + conflictResolution.active) * 100 || 0,
        successRateBreakdown: successRates,
        conflictStatusBreakdown: conflictResolution
    };
}

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
            return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
}

module.exports = router;
const { StatusCodes } = require('http-status-codes');
const Policy = require('../models/Policy');
const DualAssignment = require('../models/DualAssignment');
const MergedReport = require('../models/MergedReport');
const Assignment = require('../models/Assignment');
const SurveySubmission = require('../models/SurveySubmission');

// @desc    Get enhanced policy status with history, notifications, and timeline
// @route   GET /api/v1/policy-status/:policyId/enhanced
// @access  Private
const getEnhancedPolicyStatus = async (req, res) => {
    try {
        const { policyId } = req.params;

        // Get policy details
        const policy = await Policy.findById(policyId);
        if (!policy) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Policy not found'
            });
        }

        // Get dual assignment if exists
        const dualAssignment = await DualAssignment.findOne({ policyId })
            .populate('ammcSurveyorId')
            .populate('niaSurveyorId');

        // Get regular assignments
        const assignments = await Assignment.find({ policyId })
            .populate('surveyorId')
            .sort({ createdAt: -1 });

        // Get survey submissions
        const submissions = await SurveySubmission.find({ policyId })
            .populate('surveyorId')
            .sort({ submittedAt: -1 });

        // Get merged report if exists
        const mergedReport = await MergedReport.findOne({ policyId });

        // Build status history
        const statusHistory = buildStatusHistory(policy, dualAssignment, assignments, submissions, mergedReport);

        // Build notifications
        const notifications = buildNotifications(policy, dualAssignment, assignments, submissions, mergedReport);

        // Build estimated timeline
        const estimatedTimeline = buildEstimatedTimeline(policy, dualAssignment, assignments, submissions, mergedReport);

        // Build assignment progress
        const assignmentProgress = buildAssignmentProgress(dualAssignment, assignments, submissions, mergedReport);

        const enhancedStatus = {
            _id: policyId,
            currentStatus: policy.status,
            lastUpdated: policy.updatedAt,
            assignmentProgress,
            statusHistory,
            notifications,
            estimatedTimeline
        };

        res.status(StatusCodes.OK).json({
            success: true,
            data: enhancedStatus
        });

    } catch (error) {
        console.error('Get enhanced policy status error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get enhanced policy status',
            error: error.message
        });
    }
};

// @desc    Get policy status history
// @route   GET /api/v1/policy-status/:policyId/history
// @access  Private
const getPolicyStatusHistory = async (req, res) => {
    try {
        const { policyId } = req.params;

        const policy = await Policy.findById(policyId);
        if (!policy) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Policy not found'
            });
        }

        // Get related data for building history
        const dualAssignment = await DualAssignment.findOne({ policyId })
            .populate('ammcSurveyorId')
            .populate('niaSurveyorId');

        const assignments = await Assignment.find({ policyId })
            .populate('surveyorId')
            .sort({ createdAt: -1 });

        const submissions = await SurveySubmission.find({ policyId })
            .populate('surveyorId')
            .sort({ submittedAt: -1 });

        const mergedReport = await MergedReport.findOne({ policyId });

        const statusHistory = buildStatusHistory(policy, dualAssignment, assignments, submissions, mergedReport);

        res.status(StatusCodes.OK).json({
            success: true,
            data: statusHistory
        });

    } catch (error) {
        console.error('Get policy status history error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get policy status history',
            error: error.message
        });
    }
};

// @desc    Get policy notifications
// @route   GET /api/v1/policy-status/notifications
// @access  Private
const getPolicyNotifications = async (req, res) => {
    try {
        const { userId, unreadOnly } = req.query;

        // For now, return mock notifications
        // In a real implementation, you would query a notifications table
        const notifications = [
            {
                _id: '1',
                type: 'assignment',
                title: 'AMMC Surveyor Assigned',
                message: 'John Adebayo has been assigned as your AMMC surveyor. He will contact you within 24 hours.',
                timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                read: false,
                priority: 'medium',
                actionUrl: '/dashboard/policies'
            },
            {
                _id: '2',
                type: 'status_change',
                title: 'Policy Status Updated',
                message: 'Your policy request has been moved to "Survey In Progress" status.',
                timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                read: true,
                priority: 'low'
            }
        ];

        const filteredNotifications = unreadOnly === 'true'
            ? notifications.filter(n => !n.read)
            : notifications;

        res.status(StatusCodes.OK).json({
            success: true,
            data: filteredNotifications
        });

    } catch (error) {
        console.error('Get policy notifications error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get policy notifications',
            error: error.message
        });
    }
};

// @desc    Mark notification as read
// @route   PATCH /api/v1/policy-status/notifications/:notificationId/read
// @access  Private
const markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        // In a real implementation, you would update the notification in the database
        // For now, just return success

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Notification marked as read'
        });

    } catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error.message
        });
    }
};

// @desc    Get estimated timeline for policy
// @route   GET /api/v1/policy-status/:policyId/timeline
// @access  Private
const getEstimatedTimeline = async (req, res) => {
    try {
        const { policyId } = req.params;

        const policy = await Policy.findById(policyId);
        if (!policy) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Policy not found'
            });
        }

        // Get related data for building timeline
        const dualAssignment = await DualAssignment.findOne({ policyId });
        const assignments = await Assignment.find({ policyId });
        const submissions = await SurveySubmission.find({ policyId });
        const mergedReport = await MergedReport.findOne({ policyId });

        const estimatedTimeline = buildEstimatedTimeline(policy, dualAssignment, assignments, submissions, mergedReport);

        res.status(StatusCodes.OK).json({
            success: true,
            data: estimatedTimeline
        });

    } catch (error) {
        console.error('Get estimated timeline error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get estimated timeline',
            error: error.message
        });
    }
};

// Helper functions
function buildStatusHistory(policy, dualAssignment, assignments, submissions, mergedReport) {
    const history = [];

    // Policy submission
    history.push({
        _id: `policy_${policy._id}`,
        status: 'submitted',
        timestamp: policy.createdAt,
        updatedBy: 'System',
        notes: 'Policy request submitted by user'
    });

    // Assignment events
    if (dualAssignment) {
        if (dualAssignment.ammcSurveyorId) {
            history.push({
                _id: `ammc_assigned_${dualAssignment._id}`,
                status: 'assigned',
                timestamp: dualAssignment.createdAt,
                updatedBy: 'AMMC Admin',
                notes: 'AMMC surveyor assigned to property assessment',
                metadata: {
                    assignmentType: 'ammc',
                    surveyorName: dualAssignment.ammcSurveyorId.name || 'AMMC Surveyor'
                }
            });
        }

        if (dualAssignment.niaSurveyorId) {
            history.push({
                _id: `nia_assigned_${dualAssignment._id}`,
                status: 'assigned',
                timestamp: dualAssignment.updatedAt,
                updatedBy: 'NIA Admin',
                notes: 'NIA surveyor assigned to property assessment',
                metadata: {
                    assignmentType: 'nia',
                    surveyorName: dualAssignment.niaSurveyorId.name || 'NIA Surveyor'
                }
            });
        }
    }

    // Regular assignments
    assignments.forEach(assignment => {
        history.push({
            _id: `assignment_${assignment._id}`,
            status: 'assigned',
            timestamp: assignment.createdAt,
            updatedBy: 'Admin',
            notes: 'Surveyor assigned to property assessment',
            metadata: {
                surveyorName: assignment.surveyorId?.name || 'Surveyor'
            }
        });
    });

    // Survey submissions
    submissions.forEach(submission => {
        history.push({
            _id: `submission_${submission._id}`,
            status: 'in_progress',
            timestamp: submission.submittedAt,
            updatedBy: submission.surveyorId?.name || 'Surveyor',
            notes: 'Survey completed and submitted',
            metadata: {
                completionPercentage: 100
            }
        });
    });

    // Report merging
    if (mergedReport) {
        history.push({
            _id: `merged_${mergedReport._id}`,
            status: 'completed',
            timestamp: mergedReport.createdAt,
            updatedBy: 'System',
            notes: 'Reports merged and processed automatically'
        });
    }

    // Sort by timestamp (newest first)
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function buildNotifications(policy, dualAssignment, assignments, submissions, mergedReport) {
    const notifications = [];

    // Assignment notifications
    if (dualAssignment?.ammcSurveyorId) {
        notifications.push({
            _id: `notif_ammc_${dualAssignment._id}`,
            type: 'assignment',
            title: 'AMMC Surveyor Assigned',
            message: `${dualAssignment.ammcSurveyorId.name || 'AMMC Surveyor'} has been assigned to assess your property.`,
            timestamp: dualAssignment.createdAt,
            read: false,
            priority: 'medium',
            actionUrl: '/dashboard/policies'
        });
    }

    if (dualAssignment?.niaSurveyorId) {
        notifications.push({
            _id: `notif_nia_${dualAssignment._id}`,
            type: 'assignment',
            title: 'NIA Surveyor Assigned',
            message: `${dualAssignment.niaSurveyorId.name || 'NIA Surveyor'} has been assigned to assess your property.`,
            timestamp: dualAssignment.updatedAt,
            read: false,
            priority: 'medium',
            actionUrl: '/dashboard/policies'
        });
    }

    // Completion notifications
    if (mergedReport) {
        notifications.push({
            _id: `notif_complete_${mergedReport._id}`,
            type: 'report_ready',
            title: 'Assessment Complete',
            message: 'Your property assessment has been completed and the report is ready for review.',
            timestamp: mergedReport.createdAt,
            read: false,
            priority: 'high',
            actionUrl: '/dashboard/policies'
        });
    }

    return notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function buildEstimatedTimeline(policy, dualAssignment, assignments, submissions, mergedReport) {
    const now = new Date();
    const milestones = [];

    // Policy submitted
    milestones.push({
        stage: 'Policy Submitted',
        estimatedDate: policy.createdAt,
        completed: true,
        actualDate: policy.createdAt
    });

    // Assignment stages
    if (dualAssignment) {
        milestones.push({
            stage: 'AMMC Surveyor Assignment',
            estimatedDate: dualAssignment.ammcSurveyorId ? dualAssignment.createdAt : new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            completed: !!dualAssignment.ammcSurveyorId,
            actualDate: dualAssignment.ammcSurveyorId ? dualAssignment.createdAt : undefined
        });

        milestones.push({
            stage: 'NIA Surveyor Assignment',
            estimatedDate: dualAssignment.niaSurveyorId ? dualAssignment.updatedAt : new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            completed: !!dualAssignment.niaSurveyorId,
            actualDate: dualAssignment.niaSurveyorId ? dualAssignment.updatedAt : undefined
        });
    }

    // Survey completion
    const allSurveysCompleted = dualAssignment ?
        (dualAssignment.completionStatus === 100) :
        (submissions.length > 0);

    milestones.push({
        stage: 'Survey Completion',
        estimatedDate: allSurveysCompleted ?
            (submissions[0]?.submittedAt || now.toISOString()) :
            new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        completed: allSurveysCompleted,
        actualDate: allSurveysCompleted ? (submissions[0]?.submittedAt || now.toISOString()) : undefined
    });

    // Report processing
    milestones.push({
        stage: 'Report Processing',
        estimatedDate: mergedReport ?
            mergedReport.createdAt :
            new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        completed: !!mergedReport,
        actualDate: mergedReport?.createdAt
    });

    // Final report release
    milestones.push({
        stage: 'Final Report Release',
        estimatedDate: mergedReport?.releaseStatus === 'approved' ?
            mergedReport.createdAt :
            new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        completed: mergedReport?.releaseStatus === 'approved',
        actualDate: mergedReport?.releaseStatus === 'approved' ? mergedReport.createdAt : undefined
    });

    // Determine current stage
    const currentMilestone = milestones.find(m => !m.completed);
    const currentStage = currentMilestone?.stage || 'Completed';
    const nextStage = milestones[milestones.findIndex(m => m.stage === currentStage) + 1]?.stage;

    // Calculate confidence
    const completedCount = milestones.filter(m => m.completed).length;
    const confidence = completedCount >= 3 ? 'high' : completedCount >= 1 ? 'medium' : 'low';

    // Build factors
    const factors = [];
    if (dualAssignment?.ammcSurveyorId) factors.push('AMMC surveyor assigned');
    if (dualAssignment?.niaSurveyorId) factors.push('NIA surveyor assigned');
    if (!dualAssignment?.niaSurveyorId) factors.push('Awaiting NIA surveyor assignment');
    factors.push('Property location accessible');
    factors.push('Standard assessment complexity');

    return {
        currentStage,
        nextStage,
        estimatedCompletion: milestones[milestones.length - 1].estimatedDate,
        confidence,
        factors,
        milestones
    };
}

function buildAssignmentProgress(dualAssignment, assignments, submissions, mergedReport) {
    return {
        ammcAssigned: !!(dualAssignment?.ammcSurveyorId || assignments.some(a => a.organization === 'AMMC')),
        niaAssigned: !!(dualAssignment?.niaSurveyorId || assignments.some(a => a.organization === 'NIA')),
        ammcCompleted: submissions.some(s => s.surveyorId?.organization === 'AMMC' && s.status === 'completed'),
        niaCompleted: submissions.some(s => s.surveyorId?.organization === 'NIA' && s.status === 'completed'),
        reportMerged: !!mergedReport,
        reportReleased: mergedReport?.releaseStatus === 'approved'
    };
}

module.exports = {
    getEnhancedPolicyStatus,
    getPolicyStatusHistory,
    getPolicyNotifications,
    markNotificationAsRead,
    getEstimatedTimeline
};
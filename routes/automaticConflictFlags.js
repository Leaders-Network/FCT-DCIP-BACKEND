const express = require('express');
const router = express.Router();
const AutomaticConflictFlag = require('../models/AutomaticConflictFlag');
const MergedReport = require('../models/MergedReport');
const DualAssignment = require('../models/DualAssignment');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { sendEmail, sendAutomaticConflictAlert, sendConflictResolutionNotification } = require('../utils/emailService');

// @route   GET /api/v1/admin/automatic-conflict-flags
// @desc    Get all automatic conflict flags for admin
// @access  Private (Admin)
router.get('/admin', authenticateToken, requireRole(['admin', 'nia_admin']), async (req, res) => {
    try {
        const {
            status,
            severity,
            conflictType,
            priority,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter query
        let filter = {};

        if (status && status !== 'all') {
            filter.flagStatus = status;
        }

        if (severity && severity !== 'all') {
            filter.conflictSeverity = severity;
        }

        if (conflictType && conflictType !== 'all') {
            filter.conflictType = conflictType;
        }

        if (priority && priority !== 'all') {
            filter.priority = priority;
        }

        // Build sort object
        const sortObj = {};
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get flags with pagination
        const flags = await AutomaticConflictFlag.find(filter)
            .populate('mergedReportId', 'finalRecommendation paymentEnabled conflictDetected')
            .populate('policyId', 'propertyDetails contactDetails status')
            .populate('dualAssignmentId', 'assignmentStatus completionStatus')
            .populate('reviewDetails.reviewedBy', 'firstname lastname email')
            .populate('resolutionDetails.resolvedBy', 'firstname lastname email')
            .populate('escalatedTo', 'firstname lastname email')
            .sort(sortObj)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await AutomaticConflictFlag.countDocuments(filter);

        // Get statistics
        const stats = await AutomaticConflictFlag.aggregate([
            {
                $group: {
                    _id: {
                        status: '$flagStatus',
                        severity: '$conflictSeverity'
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const statusStats = {
            active: 0,
            reviewed: 0,
            resolved: 0,
            dismissed: 0
        };

        const severityStats = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0
        };

        stats.forEach(stat => {
            statusStats[stat._id.status] = (statusStats[stat._id.status] || 0) + stat.count;
            severityStats[stat._id.severity] = (severityStats[stat._id.severity] || 0) + stat.count;
        });

        res.json({
            success: true,
            data: {
                flags,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                },
                stats: {
                    status: statusStats,
                    severity: severityStats
                }
            }
        });

    } catch (error) {
        console.error('Error fetching automatic conflict flags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conflict flags',
            error: error.message
        });
    }
});

// @route   GET /api/v1/admin/automatic-conflict-flags/:id
// @desc    Get specific conflict flag details
// @access  Private (Admin)
router.get('/admin/:id', authenticateToken, requireRole(['admin', 'nia_admin']), async (req, res) => {
    try {
        const { id } = req.params;

        const flag = await AutomaticConflictFlag.findById(id)
            .populate('mergedReportId')
            .populate('policyId', 'propertyDetails contactDetails status')
            .populate('dualAssignmentId')
            .populate('reviewDetails.reviewedBy', 'firstname lastname email')
            .populate('resolutionDetails.resolvedBy', 'firstname lastname email')
            .populate('escalatedTo', 'firstname lastname email')
            .populate('notificationHistory.sentTo');

        if (!flag) {
            return res.status(404).json({
                success: false,
                message: 'Conflict flag not found'
            });
        }

        res.json({
            success: true,
            data: flag
        });

    } catch (error) {
        console.error('Error fetching conflict flag details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conflict flag details',
            error: error.message
        });
    }
});

// @route   PUT /api/v1/admin/automatic-conflict-flags/:id/review
// @desc    Review and update conflict flag
// @access  Private (Admin)
router.put('/admin/:id/review', authenticateToken, requireRole(['admin', 'nia_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { reviewNotes, reviewDecision } = req.body;

        if (!reviewNotes || !reviewDecision) {
            return res.status(400).json({
                success: false,
                message: 'Review notes and decision are required'
            });
        }

        const flag = await AutomaticConflictFlag.findById(id);
        if (!flag) {
            return res.status(404).json({
                success: false,
                message: 'Conflict flag not found'
            });
        }

        flag.markAsReviewed(req.user.userId, reviewNotes, reviewDecision);
        await flag.save();

        // Send notification if escalated
        if (reviewDecision === 'escalate') {
            await notifyEscalation(flag);
        }

        res.json({
            success: true,
            message: 'Conflict flag reviewed successfully',
            data: flag
        });

    } catch (error) {
        console.error('Error reviewing conflict flag:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to review conflict flag',
            error: error.message
        });
    }
});

// @route   PUT /api/v1/admin/automatic-conflict-flags/:id/resolve
// @desc    Resolve conflict flag
// @access  Private (Admin)
router.put('/admin/:id/resolve', authenticateToken, requireRole(['admin', 'nia_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { resolutionMethod, resolutionNotes } = req.body;

        if (!resolutionMethod || !resolutionNotes) {
            return res.status(400).json({
                success: false,
                message: 'Resolution method and notes are required'
            });
        }

        const flag = await AutomaticConflictFlag.findById(id)
            .populate('policyId', 'contactDetails')
            .populate('mergedReportId');

        if (!flag) {
            return res.status(404).json({
                success: false,
                message: 'Conflict flag not found'
            });
        }

        flag.resolve(req.user.userId, resolutionMethod, resolutionNotes);
        await flag.save();

        // Send resolution notification to user
        await sendResolutionNotification(flag);

        res.json({
            success: true,
            message: 'Conflict flag resolved successfully',
            data: flag
        });

    } catch (error) {
        console.error('Error resolving conflict flag:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resolve conflict flag',
            error: error.message
        });
    }
});

// @route   PUT /api/v1/admin/automatic-conflict-flags/:id/escalate
// @desc    Escalate conflict flag
// @access  Private (Admin)
router.put('/admin/:id/escalate', authenticateToken, requireRole(['admin', 'nia_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { escalatedTo, reason } = req.body;

        if (!escalatedTo || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Escalation target and reason are required'
            });
        }

        const flag = await AutomaticConflictFlag.findById(id);
        if (!flag) {
            return res.status(404).json({
                success: false,
                message: 'Conflict flag not found'
            });
        }

        flag.escalate(req.user.userId, escalatedTo, reason);
        await flag.save();

        // Send escalation notification
        await notifyEscalation(flag);

        res.json({
            success: true,
            message: 'Conflict flag escalated successfully',
            data: flag
        });

    } catch (error) {
        console.error('Error escalating conflict flag:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to escalate conflict flag',
            error: error.message
        });
    }
});

// @route   POST /api/v1/automatic-conflict-flags/detect
// @desc    Create automatic conflict flag (system use)
// @access  Private (System/Admin)
router.post('/detect', authenticateToken, async (req, res) => {
    try {
        const {
            mergedReportId,
            policyId,
            dualAssignmentId,
            conflictType,
            conflictSeverity,
            ammcRecommendation,
            niaRecommendation,
            ammcValue,
            niaValue,
            discrepancyPercentage,
            flaggedSections,
            detectionMetadata
        } = req.body;

        // Validate required fields
        if (!mergedReportId || !policyId || !dualAssignmentId || !conflictType || !ammcRecommendation || !niaRecommendation) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields for conflict detection'
            });
        }

        // Check if flag already exists for this merged report
        const existingFlag = await AutomaticConflictFlag.findOne({ mergedReportId });
        if (existingFlag) {
            return res.status(409).json({
                success: false,
                message: 'Conflict flag already exists for this merged report'
            });
        }

        // Create conflict flag
        const flag = new AutomaticConflictFlag({
            mergedReportId,
            policyId,
            dualAssignmentId,
            conflictType,
            conflictSeverity: conflictSeverity || 'medium',
            ammcRecommendation,
            niaRecommendation,
            ammcValue,
            niaValue,
            discrepancyPercentage,
            flaggedSections: flaggedSections || [],
            detectionMetadata: {
                ...detectionMetadata,
                detectedAt: new Date()
            },
            priority: conflictSeverity === 'critical' ? 'urgent' :
                conflictSeverity === 'high' ? 'high' : 'normal'
        });

        await flag.save();

        // Notify administrators
        await notifyAdministrators(flag);

        res.status(201).json({
            success: true,
            message: 'Automatic conflict flag created successfully',
            data: {
                flagId: flag._id,
                conflictType: flag.conflictType,
                severity: flag.conflictSeverity,
                priority: flag.priority
            }
        });

    } catch (error) {
        console.error('Error creating automatic conflict flag:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create conflict flag',
            error: error.message
        });
    }
});

// @route   GET /api/v1/automatic-conflict-flags/policy/:policyId
// @desc    Get conflict flags for specific policy
// @access  Private (User/Admin)
router.get('/policy/:policyId', authenticateToken, async (req, res) => {
    try {
        const { policyId } = req.params;

        const flags = await AutomaticConflictFlag.find({ policyId })
            .populate('mergedReportId', 'finalRecommendation paymentEnabled')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: flags
        });

    } catch (error) {
        console.error('Error fetching policy conflict flags:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch policy conflict flags',
            error: error.message
        });
    }
});

// Helper function to notify administrators about new conflict flags
async function notifyAdministrators(flag) {
    try {
        // Get admin emails (in real implementation, fetch from database)
        const adminEmails = [
            'admin@ammc.gov.ng',
            'admin@nia.org.ng'
        ];

        // Send notifications to all admins
        for (const email of adminEmails) {
            await sendAutomaticConflictAlert(email, flag);
        }

        // Mark as notified
        flag.adminNotified = true;
        flag.sendNotification('admin_alert', null, 'Employee', 'email');
        await flag.save();

        console.log(`Automatic conflict flag notifications sent for ${flag._id}`);
    } catch (error) {
        console.error('Error sending admin notifications:', error);
    }
}

// Helper function to notify escalation
async function notifyEscalation(flag) {
    try {
        if (!flag.escalatedTo) return;

        const emailSubject = `Conflict Flag Escalated - ${flag.conflictType.toUpperCase()}`;
        const emailBody = `
            A conflict flag has been escalated to your attention:
            
            Conflict ID: ${flag._id}
            Policy ID: ${flag.policyId}
            Conflict Type: ${flag.conflictType}
            Severity: ${flag.conflictSeverity}
            Escalation Level: ${flag.escalationLevel}
            
            Please review this high-priority conflict and provide resolution guidance.
        `;

        // In real implementation, get escalatedTo user's email from database
        const escalatedToEmail = 'supervisor@ammc.gov.ng'; // Placeholder

        await sendEmail(escalatedToEmail, emailSubject, emailBody);

        console.log(`Escalation notification sent for conflict flag ${flag._id}`);
    } catch (error) {
        console.error('Error sending escalation notification:', error);
    }
}

// Helper function to send resolution notification to user
async function sendResolutionNotification(flag) {
    try {
        // In real implementation, get user email from policy/user data
        const userEmail = 'user@example.com'; // Placeholder

        await sendConflictResolutionNotification(userEmail, flag);

        // Mark user as notified
        flag.userNotified = true;
        flag.sendNotification('resolution_notice', null, 'User', 'email');
        await flag.save();

        console.log(`Resolution notification sent to user for conflict flag ${flag._id}`);
    } catch (error) {
        console.error('Error sending resolution notification:', error);
    }
}

module.exports = router;
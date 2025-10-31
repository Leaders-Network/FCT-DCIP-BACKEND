const express = require('express');
const router = express.Router();
const UserConflictInquiry = require('../models/UserConflictInquiry');
const MergedReport = require('../models/MergedReport');
const { authenticateToken } = require('../middleware/auth');
const { sendConflictInquiryNotification, sendConflictInquiryResponse } = require('../utils/emailService');

// @route   POST /api/v1/user-conflict-inquiries
// @desc    Submit a new conflict inquiry
// @access  Private (User)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            policyId,
            mergedReportId,
            conflictType,
            description,
            urgency,
            contactPreference,
            userContact
        } = req.body;

        // Validate required fields
        if (!policyId || !conflictType || !description || !userContact?.email) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Verify merged report exists
        const mergedReport = await MergedReport.findById(mergedReportId);
        if (!mergedReport) {
            return res.status(404).json({
                success: false,
                message: 'Merged report not found'
            });
        }

        // Create conflict inquiry
        const inquiry = new UserConflictInquiry({
            policyId,
            mergedReportId,
            userId: req.user.userId,
            conflictType,
            description,
            urgency: urgency || 'medium',
            contactPreference: contactPreference || 'email',
            userContact: {
                email: userContact.email,
                phone: userContact.phone || '',
                preferredTime: userContact.preferredTime || ''
            }
        });

        await inquiry.save();

        // Notify administrators
        await notifyAdministrators(inquiry);

        res.status(201).json({
            success: true,
            message: 'Conflict inquiry submitted successfully',
            data: {
                referenceId: inquiry.referenceId,
                inquiryId: inquiry._id,
                expectedResponseTime: '24-48 hours'
            }
        });

    } catch (error) {
        console.error('Error submitting conflict inquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit conflict inquiry',
            error: error.message
        });
    }
});

// @route   GET /api/v1/admin/user-conflict-inquiries
// @desc    Get all conflict inquiries for admin
// @access  Private (Admin)
router.get('/admin', authenticateToken, async (req, res) => {
    try {
        const { status, urgency, conflictType, organization, page = 1, limit = 20 } = req.query;

        // Build filter query
        let filter = {};

        if (status && status !== 'all') {
            filter.inquiryStatus = status;
        }

        if (urgency && urgency !== 'all') {
            filter.urgency = urgency;
        }

        if (conflictType && conflictType !== 'all') {
            filter.conflictType = conflictType;
        }

        if (organization && organization !== 'all') {
            filter.assignedOrganization = organization;
        }

        // Get inquiries with pagination
        const inquiries = await UserConflictInquiry.find(filter)
            .populate('userId', 'fullName email phoneNumber')
            .populate('policyId', 'propertyDetails contactDetails status')
            .populate('assignedAdminId', 'firstname lastname email')
            .populate('resolutionDetails.resolvedBy', 'firstname lastname')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await UserConflictInquiry.countDocuments(filter);

        // Get statistics
        const stats = await UserConflictInquiry.aggregate([
            {
                $group: {
                    _id: '$inquiryStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statusStats = {
            open: 0,
            in_progress: 0,
            resolved: 0,
            closed: 0
        };

        stats.forEach(stat => {
            statusStats[stat._id] = stat.count;
        });

        res.json({
            success: true,
            data: {
                inquiries,
                pagination: {
                    current: page,
                    pages: Math.ceil(total / limit),
                    total
                },
                stats: statusStats
            }
        });

    } catch (error) {
        console.error('Error fetching conflict inquiries:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch conflict inquiries',
            error: error.message
        });
    }
});

// @route   PUT /api/v1/admin/user-conflict-inquiries/:id/assign
// @desc    Assign inquiry to admin
// @access  Private (Admin)
router.put('/admin/:id/assign', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { organization } = req.body;

        const inquiry = await UserConflictInquiry.findById(id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        inquiry.assignToAdmin(req.user.userId, organization);
        await inquiry.save();

        res.json({
            success: true,
            message: 'Inquiry assigned successfully',
            data: inquiry
        });

    } catch (error) {
        console.error('Error assigning inquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign inquiry',
            error: error.message
        });
    }
});

// @route   PUT /api/v1/admin/user-conflict-inquiries/:id/respond
// @desc    Respond to conflict inquiry
// @access  Private (Admin)
router.put('/admin/:id/respond', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { response, method } = req.body;

        if (!response || !response.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Response text is required'
            });
        }

        const inquiry = await UserConflictInquiry.findById(id)
            .populate('userId', 'fullName email phoneNumber');

        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        inquiry.addResponse(req.user.userId, response, method || 'email');
        await inquiry.save();

        // Send response to user
        await sendResponseToUser(inquiry, response);

        res.json({
            success: true,
            message: 'Response sent successfully',
            data: inquiry
        });

    } catch (error) {
        console.error('Error responding to inquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send response',
            error: error.message
        });
    }
});

// @route   PUT /api/v1/admin/user-conflict-inquiries/:id/add-note
// @desc    Add internal note to inquiry
// @access  Private (Admin)
router.put('/admin/:id/add-note', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { note, noteType } = req.body;

        if (!note || !note.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Note text is required'
            });
        }

        const inquiry = await UserConflictInquiry.findById(id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        inquiry.addInternalNote(req.user.userId, note, noteType || 'general');
        await inquiry.save();

        res.json({
            success: true,
            message: 'Note added successfully',
            data: inquiry
        });

    } catch (error) {
        console.error('Error adding note to inquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add note',
            error: error.message
        });
    }
});

// @route   PUT /api/v1/admin/user-conflict-inquiries/:id/escalate
// @desc    Escalate inquiry to higher level
// @access  Private (Admin)
router.put('/admin/:id/escalate', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { escalatedTo, reason } = req.body;

        if (!escalatedTo || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Escalation target and reason are required'
            });
        }

        const inquiry = await UserConflictInquiry.findById(id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        inquiry.escalate(req.user.userId, escalatedTo, reason);
        await inquiry.save();

        res.json({
            success: true,
            message: 'Inquiry escalated successfully',
            data: inquiry
        });

    } catch (error) {
        console.error('Error escalating inquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to escalate inquiry',
            error: error.message
        });
    }
});

// @route   PUT /api/v1/admin/user-conflict-inquiries/:id/close
// @desc    Close inquiry
// @access  Private (Admin)
router.put('/admin/:id/close', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { closureReason } = req.body;

        const inquiry = await UserConflictInquiry.findById(id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        inquiry.inquiryStatus = 'closed';
        if (closureReason) {
            inquiry.addInternalNote(req.user.userId, `Inquiry closed: ${closureReason}`, 'resolution');
        }
        await inquiry.save();

        res.json({
            success: true,
            message: 'Inquiry closed successfully',
            data: inquiry
        });

    } catch (error) {
        console.error('Error closing inquiry:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to close inquiry',
            error: error.message
        });
    }
});

// @route   GET /api/v1/admin/user-conflict-inquiries/stats
// @desc    Get inquiry statistics for admin dashboard
// @access  Private (Admin)
router.get('/admin/stats', authenticateToken, async (req, res) => {
    try {
        const { organization, timeframe = '30d' } = req.query;

        // Calculate time filter
        const timeFilter = getTimeFilter(timeframe);

        // Build organization filter
        let orgFilter = {};
        if (organization && organization !== 'all') {
            orgFilter.assignedOrganization = organization;
        }

        // Get comprehensive statistics
        const stats = await Promise.all([
            // Total inquiries
            UserConflictInquiry.countDocuments({ ...orgFilter, createdAt: { $gte: timeFilter } }),

            // Inquiries by status
            UserConflictInquiry.aggregate([
                { $match: { ...orgFilter, createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$inquiryStatus', count: { $sum: 1 } } }
            ]),

            // Inquiries by type
            UserConflictInquiry.aggregate([
                { $match: { ...orgFilter, createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$conflictType', count: { $sum: 1 } } }
            ]),

            // Inquiries by urgency
            UserConflictInquiry.aggregate([
                { $match: { ...orgFilter, createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$urgency', count: { $sum: 1 } } }
            ]),

            // Average response time
            UserConflictInquiry.aggregate([
                {
                    $match: {
                        ...orgFilter,
                        createdAt: { $gte: timeFilter },
                        'resolutionDetails.resolvedAt': { $exists: true }
                    }
                },
                {
                    $addFields: {
                        responseTime: {
                            $subtract: ['$resolutionDetails.resolvedAt', '$createdAt']
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgResponseTime: { $avg: '$responseTime' },
                        minResponseTime: { $min: '$responseTime' },
                        maxResponseTime: { $max: '$responseTime' }
                    }
                }
            ]),

            // Daily inquiry volume
            UserConflictInquiry.aggregate([
                { $match: { ...orgFilter, createdAt: { $gte: timeFilter } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        // Format the results
        const statusStats = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
        stats[1].forEach(item => statusStats[item._id] = item.count);

        const typeStats = {};
        stats[2].forEach(item => typeStats[item._id] = item.count);

        const urgencyStats = { low: 0, medium: 0, high: 0 };
        stats[3].forEach(item => urgencyStats[item._id] = item.count);

        res.json({
            success: true,
            data: {
                timeframe: timeframe,
                organization: organization || 'all',
                totalInquiries: stats[0],
                statusBreakdown: statusStats,
                typeBreakdown: typeStats,
                urgencyBreakdown: urgencyStats,
                responseTimeMetrics: stats[4][0] || {
                    avgResponseTime: 0,
                    minResponseTime: 0,
                    maxResponseTime: 0
                },
                dailyVolume: stats[5],
                generatedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Error fetching inquiry statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inquiry statistics',
            error: error.message
        });
    }
});

// @route   GET /api/v1/admin/user-conflict-inquiries/:id
// @desc    Get specific inquiry details
// @access  Private (Admin)
router.get('/admin/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const inquiry = await UserConflictInquiry.findById(id)
            .populate('userId', 'fullName email phoneNumber')
            .populate('policyId', 'propertyDetails contactDetails status')
            .populate('mergedReportId')
            .populate('assignedAdminId', 'firstname lastname email')
            .populate('resolutionDetails.resolvedBy', 'firstname lastname')
            .populate('internalNotes.addedBy', 'firstname lastname')
            .populate('communicationHistory.handledBy', 'firstname lastname');

        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        res.json({
            success: true,
            data: inquiry
        });

    } catch (error) {
        console.error('Error fetching inquiry details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inquiry details',
            error: error.message
        });
    }
});

// Helper function to notify administrators
async function notifyAdministrators(inquiry) {
    try {
        // Get admin emails (in real implementation, fetch from database)
        const adminEmails = [
            'admin@ammc.gov.ng',
            'admin@nia.org.ng'
        ];

        // Send notifications to all admins
        for (const email of adminEmails) {
            await sendConflictInquiryNotification(email, inquiry);
        }

        console.log(`Conflict inquiry notifications sent for ${inquiry.referenceId}`);
    } catch (error) {
        console.error('Error sending admin notifications:', error);
    }
}

// Helper function to send response to user
async function sendResponseToUser(inquiry, response) {
    try {
        await sendConflictInquiryResponse(inquiry.userContact.email, inquiry, response);
        console.log(`Response sent to user for inquiry ${inquiry.referenceId}`);
    } catch (error) {
        console.error('Error sending response to user:', error);
    }
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
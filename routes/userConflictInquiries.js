const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const UserConflictInquiry = require('../models/UserConflictInquiry');
const MergedReport = require('../models/MergedReport');
const { protect } = require('../middlewares/authentication');
const { sendConflictInquiryNotification, sendConflictInquiryResponse } = require('../utils/emailService');

// ============================================
// USER ROUTES (must come before parameterized routes)
// ============================================

// @route   GET /api/v1/user-conflict-inquiries/my-inquiries
// @desc    Get user's own conflict inquiries
// @access  Private (User)
router.get('/my-inquiries', protect, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const userId = new mongoose.Types.ObjectId(req.user.userId);

        let filter = { userId: userId };

        if (status && status !== 'all') {
            filter.inquiryStatus = status;
        }

        const inquiries = await UserConflictInquiry.find(filter)
            .populate('policyId', 'propertyDetails contactDetails status')
            .populate('mergedReportId', 'finalRecommendation overallRiskLevel')
            .populate('assignedAdminId', 'firstname lastname')
            .populate('resolutionDetails.resolvedBy', 'firstname lastname')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await UserConflictInquiry.countDocuments(filter);

        // Get status counts for user
        const statusCounts = await UserConflictInquiry.aggregate([
            { $match: { userId: userId } },
            { $group: { _id: '$inquiryStatus', count: { $sum: 1 } } }
        ]);

        const stats = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
        statusCounts.forEach(s => {
            if (s._id) stats[s._id] = s.count;
        });

        res.json({
            success: true,
            data: {
                inquiries,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / parseInt(limit)),
                    total
                },
                stats
            }
        });

    } catch (error) {
        console.error('Error fetching user inquiries:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch your inquiries',
            error: error.message
        });
    }
});

// ============================================
// ADMIN ROUTES (must come before /:id route)
// ============================================

// @route   GET /api/v1/user-conflict-inquiries/admin
// @desc    Get all conflict inquiries for admin
// @access  Private (Admin)
router.get('/admin', protect, async (req, res) => {
    try {
        const { status, urgency, conflictType, organization, page = 1, limit = 20 } = req.query;

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

        const inquiries = await UserConflictInquiry.find(filter)
            .populate('userId', 'fullName email phoneNumber')
            .populate('policyId', 'propertyDetails contactDetails status')
            .populate('assignedAdminId', 'firstname lastname email')
            .populate('resolutionDetails.resolvedBy', 'firstname lastname')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await UserConflictInquiry.countDocuments(filter);

        const stats = await UserConflictInquiry.aggregate([
            { $group: { _id: '$inquiryStatus', count: { $sum: 1 } } }
        ]);

        const statusStats = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
        stats.forEach(stat => {
            if (stat._id) statusStats[stat._id] = stat.count;
        });

        res.json({
            success: true,
            data: {
                inquiries,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / parseInt(limit)),
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

// @route   GET /api/v1/user-conflict-inquiries/admin/stats
// @desc    Get inquiry statistics for admin dashboard
// @access  Private (Admin)
router.get('/admin/stats', protect, async (req, res) => {
    try {
        const { organization, timeframe = '30d' } = req.query;
        const timeFilter = getTimeFilter(timeframe);

        let orgFilter = {};
        if (organization && organization !== 'all') {
            orgFilter.assignedOrganization = organization;
        }

        const stats = await Promise.all([
            UserConflictInquiry.countDocuments({ ...orgFilter, createdAt: { $gte: timeFilter } }),
            UserConflictInquiry.aggregate([
                { $match: { ...orgFilter, createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$inquiryStatus', count: { $sum: 1 } } }
            ]),
            UserConflictInquiry.aggregate([
                { $match: { ...orgFilter, createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$conflictType', count: { $sum: 1 } } }
            ]),
            UserConflictInquiry.aggregate([
                { $match: { ...orgFilter, createdAt: { $gte: timeFilter } } },
                { $group: { _id: '$urgency', count: { $sum: 1 } } }
            ])
        ]);

        const statusStats = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
        stats[1].forEach(item => { if (item._id) statusStats[item._id] = item.count; });

        const typeStats = {};
        stats[2].forEach(item => { if (item._id) typeStats[item._id] = item.count; });

        const urgencyStats = { low: 0, medium: 0, high: 0 };
        stats[3].forEach(item => { if (item._id) urgencyStats[item._id] = item.count; });

        res.json({
            success: true,
            data: {
                timeframe,
                organization: organization || 'all',
                totalInquiries: stats[0],
                statusBreakdown: statusStats,
                typeBreakdown: typeStats,
                urgencyBreakdown: urgencyStats,
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


// @route   GET /api/v1/user-conflict-inquiries/admin/:id
// @desc    Get specific inquiry details for admin
// @access  Private (Admin)
router.get('/admin/:id', protect, async (req, res) => {
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

        res.json({ success: true, data: inquiry });

    } catch (error) {
        console.error('Error fetching inquiry details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inquiry details',
            error: error.message
        });
    }
});

// @route   PUT /api/v1/user-conflict-inquiries/admin/:id/assign
// @desc    Assign inquiry to admin
// @access  Private (Admin)
router.put('/admin/:id/assign', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const { organization } = req.body;

        const inquiry = await UserConflictInquiry.findById(id);
        if (!inquiry) {
            return res.status(404).json({ success: false, message: 'Inquiry not found' });
        }

        inquiry.assignToAdmin(req.user.userId, organization);
        await inquiry.save();

        res.json({ success: true, message: 'Inquiry assigned successfully', data: inquiry });

    } catch (error) {
        console.error('Error assigning inquiry:', error);
        res.status(500).json({ success: false, message: 'Failed to assign inquiry', error: error.message });
    }
});

// @route   PUT /api/v1/user-conflict-inquiries/admin/:id/respond
// @desc    Respond to conflict inquiry
// @access  Private (Admin)
router.put('/admin/:id/respond', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const { response, method } = req.body;

        if (!response || !response.trim()) {
            return res.status(400).json({ success: false, message: 'Response text is required' });
        }

        const inquiry = await UserConflictInquiry.findById(id)
            .populate('userId', 'fullName email phoneNumber');

        if (!inquiry) {
            return res.status(404).json({ success: false, message: 'Inquiry not found' });
        }

        inquiry.addResponse(req.user.userId, response, method || 'email');
        await inquiry.save();

        await sendResponseToUser(inquiry, response);

        res.json({ success: true, message: 'Response sent successfully', data: inquiry });

    } catch (error) {
        console.error('Error responding to inquiry:', error);
        res.status(500).json({ success: false, message: 'Failed to send response', error: error.message });
    }
});

// @route   PUT /api/v1/user-conflict-inquiries/admin/:id/add-note
// @desc    Add internal note to inquiry
// @access  Private (Admin)
router.put('/admin/:id/add-note', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const { note, noteType } = req.body;

        if (!note || !note.trim()) {
            return res.status(400).json({ success: false, message: 'Note text is required' });
        }

        const inquiry = await UserConflictInquiry.findById(id);
        if (!inquiry) {
            return res.status(404).json({ success: false, message: 'Inquiry not found' });
        }

        inquiry.addInternalNote(req.user.userId, note, noteType || 'general');
        await inquiry.save();

        res.json({ success: true, message: 'Note added successfully', data: inquiry });

    } catch (error) {
        console.error('Error adding note to inquiry:', error);
        res.status(500).json({ success: false, message: 'Failed to add note', error: error.message });
    }
});

// @route   PUT /api/v1/user-conflict-inquiries/admin/:id/escalate
// @desc    Escalate inquiry to higher level
// @access  Private (Admin)
router.put('/admin/:id/escalate', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const { escalatedTo, reason } = req.body;

        if (!escalatedTo || !reason) {
            return res.status(400).json({ success: false, message: 'Escalation target and reason are required' });
        }

        const inquiry = await UserConflictInquiry.findById(id);
        if (!inquiry) {
            return res.status(404).json({ success: false, message: 'Inquiry not found' });
        }

        inquiry.escalate(req.user.userId, escalatedTo, reason);
        await inquiry.save();

        res.json({ success: true, message: 'Inquiry escalated successfully', data: inquiry });

    } catch (error) {
        console.error('Error escalating inquiry:', error);
        res.status(500).json({ success: false, message: 'Failed to escalate inquiry', error: error.message });
    }
});

// @route   PUT /api/v1/user-conflict-inquiries/admin/:id/close
// @desc    Close inquiry
// @access  Private (Admin)
router.put('/admin/:id/close', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const { closureReason } = req.body;

        const inquiry = await UserConflictInquiry.findById(id);
        if (!inquiry) {
            return res.status(404).json({ success: false, message: 'Inquiry not found' });
        }

        inquiry.inquiryStatus = 'closed';
        if (closureReason) {
            inquiry.addInternalNote(req.user.userId, `Inquiry closed: ${closureReason}`, 'resolution');
        }
        await inquiry.save();

        res.json({ success: true, message: 'Inquiry closed successfully', data: inquiry });

    } catch (error) {
        console.error('Error closing inquiry:', error);
        res.status(500).json({ success: false, message: 'Failed to close inquiry', error: error.message });
    }
});

// ============================================
// POST ROUTE
// ============================================

// @route   POST /api/v1/user-conflict-inquiries
// @desc    Submit a new conflict inquiry
// @access  Private (User)
router.post('/', protect, async (req, res) => {
    try {
        const { policyId, mergedReportId, conflictType, description, urgency, contactPreference, userContact } = req.body;

        if (!policyId || !conflictType || !description || !userContact?.email) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        let mergedReport = null;
        if (mergedReportId) {
            mergedReport = await MergedReport.findById(mergedReportId);
        }
        if (!mergedReport) {
            mergedReport = await MergedReport.findOne({ policyId: policyId });
        }

        const inquiryData = {
            policyId,
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
        };

        if (mergedReport) {
            inquiryData.mergedReportId = mergedReport._id;
        }

        const inquiry = new UserConflictInquiry(inquiryData);
        await inquiry.save();

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
        res.status(500).json({ success: false, message: 'Failed to submit conflict inquiry', error: error.message });
    }
});

// ============================================
// PARAMETERIZED USER ROUTE (must come last)
// ============================================

// @route   GET /api/v1/user-conflict-inquiries/:id
// @desc    Get specific inquiry details for user
// @access  Private (User)
router.get('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;

        // Skip if it looks like a route name
        if (id === 'admin' || id === 'my-inquiries') {
            return res.status(404).json({ success: false, message: 'Route not found' });
        }

        const inquiry = await UserConflictInquiry.findOne({
            _id: id,
            userId: req.user.userId
        })
            .populate('policyId', 'propertyDetails contactDetails status')
            .populate('mergedReportId')
            .populate('assignedAdminId', 'firstname lastname email')
            .populate('resolutionDetails.resolvedBy', 'firstname lastname');

        if (!inquiry) {
            return res.status(404).json({ success: false, message: 'Inquiry not found or access denied' });
        }

        res.json({ success: true, data: inquiry });

    } catch (error) {
        console.error('Error fetching inquiry details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch inquiry details', error: error.message });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function notifyAdministrators(inquiry) {
    try {
        const adminEmails = ['admin@ammc.gov.ng', 'admin@nia.org.ng'];
        for (const email of adminEmails) {
            await sendConflictInquiryNotification(email, inquiry);
        }
        console.log(`Conflict inquiry notifications sent for ${inquiry.referenceId}`);
    } catch (error) {
        console.error('Error sending admin notifications:', error);
    }
}

async function sendResponseToUser(inquiry, response) {
    try {
        await sendConflictInquiryResponse(inquiry.userContact.email, inquiry, response);
        console.log(`Response sent to user for inquiry ${inquiry.referenceId}`);
    } catch (error) {
        console.error('Error sending response to user:', error);
    }
}

function getTimeFilter(timeframe) {
    const now = new Date();
    switch (timeframe) {
        case '1h': return new Date(now.getTime() - 60 * 60 * 1000);
        case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
}

module.exports = router;

const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const EnhancedNotificationService = require('../services/EnhancedNotificationService');
const { protect } = require('../middlewares/authentication');

// Get user notifications
router.get('/', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const userId = req.user.userId;

        const result = await EnhancedNotificationService.getNotifications(userId, {
            page: parseInt(page),
            limit: parseInt(limit),
            unreadOnly: unreadOnly === 'true'
        });

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: error.message
        });
    }
});

// Get unread count
router.get('/unread-count', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const count = await Notification.getUnreadCount(userId);

        res.json({
            success: true,
            count
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get unread count',
            error: error.message
        });
    }
});

// Mark notification as read
router.patch('/:id/read', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await EnhancedNotificationService.markAsRead(id);

        res.json({
            success: true,
            notification
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error.message
        });
    }
});

// Mark all as read
router.patch('/mark-all-read', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        await EnhancedNotificationService.markAllAsRead(userId);

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all notifications as read',
            error: error.message
        });
    }
});

// Delete notification
router.delete('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        await EnhancedNotificationService.delete(id);

        res.json({
            success: true,
            message: 'Notification deleted'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification',
            error: error.message
        });
    }
});

// Test endpoint to create a sample notification (for debugging)
router.post('/test', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userType = req.user.model === 'User' ? 'user' :
            req.user.model === 'Employee' ? 'admin' : 'surveyor';

        console.log('🔔 Creating test notification for user:', userId, 'type:', userType);

        const testNotification = await EnhancedNotificationService.create({
            recipientId: userId,
            recipientType: userType,
            type: 'system_alert',
            title: 'Test Notification',
            message: 'This is a test notification to verify the system is working correctly.',
            priority: 'medium',
            actionUrl: '/dashboard',
            actionLabel: 'Go to Dashboard',
            metadata: {
                icon: 'Bell',
                color: 'blue'
            }
        });

        console.log('🔔 Test notification created:', testNotification._id);

        res.json({
            success: true,
            message: 'Test notification created successfully',
            notification: testNotification
        });
    } catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test notification',
            error: error.message
        });
    }
});

// Debug endpoint to check notification system status
router.get('/debug', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userType = req.user.model === 'User' ? 'user' :
            req.user.model === 'Employee' ? 'admin' : 'surveyor';

        // Get all notifications for this user
        const allNotifications = await Notification.find({ recipientId: userId }).sort({ createdAt: -1 });

        // Get recent activities that should have triggered notifications
        const PolicyRequest = require('../models/PolicyRequest');
        const Assignment = require('../models/Assignment');
        const SurveySubmission = require('../models/SurveySubmission');

        const recentPolicies = await PolicyRequest.find().sort({ createdAt: -1 }).limit(5);
        const recentAssignments = await Assignment.find().sort({ createdAt: -1 }).limit(5);
        const recentSubmissions = await SurveySubmission.find().sort({ createdAt: -1 }).limit(5);

        res.json({
            success: true,
            debug: {
                currentUser: {
                    id: userId,
                    type: userType,
                    model: req.user.model,
                    fullUser: req.user
                },
                notifications: {
                    total: allNotifications.length,
                    unread: allNotifications.filter(n => !n.read).length,
                    recent: allNotifications.slice(0, 5)
                },
                recentActivities: {
                    policies: recentPolicies.length,
                    assignments: recentAssignments.length,
                    submissions: recentSubmissions.length
                },
                systemStatus: {
                    notificationServiceLoaded: !!EnhancedNotificationService,
                    databaseConnected: true
                }
            }
        });
    } catch (error) {
        console.error('Debug endpoint error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get debug info',
            error: error.message
        });
    }
});

module.exports = router;

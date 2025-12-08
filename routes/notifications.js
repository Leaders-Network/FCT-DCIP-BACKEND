const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const EnhancedNotificationService = require('../services/EnhancedNotificationService');
const { protect } = require('../middlewares/authentication');

// Get user notifications
router.get('/', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const userId = req.user.id;

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
        const userId = req.user.id;
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
        const userId = req.user.id;
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

module.exports = router;

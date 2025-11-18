const { StatusCodes } = require('http-status-codes');
const { BadRequestError, UnauthenticatedError } = require('../errors');
const {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount
} = require('../services/claimNotificationService');

// Get user notifications
const getNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        const { unreadOnly, limit, skip } = req.query;

        // Verify user can only access their own notifications (unless admin)
        if (req.user.model === 'User' && req.user.userId.toString() !== userId) {
            throw new UnauthenticatedError('You can only access your own notifications');
        }

        const options = {
            unreadOnly: unreadOnly === 'true',
            limit: limit ? parseInt(limit) : 50,
            skip: skip ? parseInt(skip) : 0
        };

        const notifications = await getUserNotifications(userId, options);
        const unreadCount = await getUnreadCount(userId);

        res.status(StatusCodes.OK).json({
            success: true,
            count: notifications.length,
            unreadCount,
            notifications
        });
    } catch (error) {
        console.error('Get notifications error:', error);

        if (error instanceof UnauthenticatedError) {
            throw error;
        }

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to retrieve notifications',
            error: error.message
        });
    }
};

// Mark notification as read
const markNotificationAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;

        const success = await markAsRead(notificationId);

        if (!success) {
            throw new BadRequestError('Failed to mark notification as read');
        }

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Mark notification as read error:', error);

        if (error instanceof BadRequestError) {
            throw error;
        }

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error.message
        });
    }
};

// Mark all notifications as read
const markAllNotificationsAsRead = async (req, res) => {
    try {
        const { userId } = req.params;

        // Verify user can only mark their own notifications (unless admin)
        if (req.user.model === 'User' && req.user.userId.toString() !== userId) {
            throw new UnauthenticatedError('You can only mark your own notifications as read');
        }

        const count = await markAllAsRead(userId);

        res.status(StatusCodes.OK).json({
            success: true,
            message: `${count} notifications marked as read`,
            count
        });
    } catch (error) {
        console.error('Mark all notifications as read error:', error);

        if (error instanceof UnauthenticatedError) {
            throw error;
        }

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to mark notifications as read',
            error: error.message
        });
    }
};

// Get unread count
const getUnreadNotificationCount = async (req, res) => {
    try {
        const { userId } = req.params;

        // Verify user can only access their own count (unless admin)
        if (req.user.model === 'User' && req.user.userId.toString() !== userId) {
            throw new UnauthenticatedError('You can only access your own notification count');
        }

        const count = await getUnreadCount(userId);

        res.status(StatusCodes.OK).json({
            success: true,
            unreadCount: count
        });
    } catch (error) {
        console.error('Get unread count error:', error);

        if (error instanceof UnauthenticatedError) {
            throw error;
        }

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get unread count',
            error: error.message
        });
    }
};

module.exports = {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadNotificationCount
};

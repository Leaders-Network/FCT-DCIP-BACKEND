const Notification = require('../models/Notification');

/**
 * Create notification for user
 * @param {string} userId - User ID to notify
 * @param {string} claimId - Claim ID related to notification
 * @param {string} type - Notification type
 * @param {string} message - Notification message
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<void>}
 */
const createNotification = async (userId, claimId, type, message, metadata = {}) => {
    try {
        const notification = new Notification({
            userId,
            claimId,
            type,
            message,
            metadata,
            isRead: false
        });

        await notification.save();
        console.log(`Notification created for user ${userId}: ${type}`);
    } catch (error) {
        console.error('Create notification error:', error);
        // Don't throw error - notifications are non-critical
    }
};

/**
 * Get user notifications
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of notifications
 */
const getUserNotifications = async (userId, options = {}) => {
    try {
        const { unreadOnly = false, limit = 50, skip = 0 } = options;

        const query = { userId };
        if (unreadOnly) {
            query.isRead = false;
        }

        const notifications = await Notification.find(query)
            .populate('claimId', 'referenceNumber status')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        return notifications;
    } catch (error) {
        console.error('Get user notifications error:', error);
        return [];
    }
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @returns {Promise<boolean>} Success status
 */
const markAsRead = async (notificationId) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { isRead: true },
            { new: true }
        );

        return !!notification;
    } catch (error) {
        console.error('Mark as read error:', error);
        return false;
    }
};

/**
 * Mark all user notifications as read
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of notifications marked as read
 */
const markAllAsRead = async (userId) => {
    try {
        const result = await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true }
        );

        return result.modifiedCount;
    } catch (error) {
        console.error('Mark all as read error:', error);
        return 0;
    }
};

/**
 * Get unread notification count
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of unread notifications
 */
const getUnreadCount = async (userId) => {
    try {
        const count = await Notification.countDocuments({
            userId,
            isRead: false
        });

        return count;
    } catch (error) {
        console.error('Get unread count error:', error);
        return 0;
    }
};

/**
 * Create notification for claim status change
 * @param {string} userId - User ID
 * @param {string} claimId - Claim ID
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {string} reason - Reason for status change
 * @returns {Promise<void>}
 */
const notifyStatusChange = async (userId, claimId, oldStatus, newStatus, reason = '') => {
    const statusMessages = {
        'submitted': 'Your claim has been submitted successfully',
        'under_review': 'Your claim is now under review',
        'approved': 'Your claim has been approved',
        'rejected': `Your claim has been rejected${reason ? ': ' + reason : ''}`,
        'completed': 'Your claim has been completed',
        'requires_more_info': 'Your claim requires additional information'
    };

    const message = statusMessages[newStatus] || `Your claim status has changed to ${newStatus}`;
    const type = newStatus === 'rejected' ? 'rejection' :
        newStatus === 'completed' ? 'completion' :
            newStatus === 'under_review' ? 'under_review' : 'status_change';

    await createNotification(userId, claimId, type, message, {
        oldStatus,
        newStatus,
        rejectionReason: newStatus === 'rejected' ? reason : undefined
    });
};

module.exports = {
    createNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    notifyStatusChange
};

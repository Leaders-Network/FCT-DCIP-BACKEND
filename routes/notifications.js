const express = require('express');
const router = express.Router();
const {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    getUnreadNotificationCount
} = require('../controllers/notificationsController');
const { protect, allowUserOrAdmin } = require('../middlewares/authentication');

// All routes require authentication
router.use(protect);

// Get user notifications
router.get('/user/:userId', allowUserOrAdmin, getNotifications);

// Get unread count
router.get('/user/:userId/unread-count', allowUserOrAdmin, getUnreadNotificationCount);

// Mark notification as read
router.put('/:notificationId/read', allowUserOrAdmin, markNotificationAsRead);

// Mark all notifications as read
router.put('/user/:userId/read-all', allowUserOrAdmin, markAllNotificationsAsRead);

module.exports = router;

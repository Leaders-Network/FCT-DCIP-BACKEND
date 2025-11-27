const express = require('express');
const router = express.Router();
const {
    getEnhancedPolicyStatus,
    getPolicyStatusHistory,
    getPolicyNotifications,
    markNotificationAsRead,
    getEstimatedTimeline
} = require('../controllers/policyStatus');
const { protect } = require('../middlewares/authentication');

// @route   GET /api/v1/policy-status/:policyId/enhanced
// @desc    Get enhanced policy status with history, notifications, and timeline
// @access  Private
router.get('/:policyId/enhanced', protect, getEnhancedPolicyStatus);

// @route   GET /api/v1/policy-status/:policyId/history
// @desc    Get policy status history
// @access  Private
router.get('/:policyId/history', protect, getPolicyStatusHistory);

// @route   GET /api/v1/policy-status/notifications
// @desc    Get policy notifications
// @access  Private
router.get('/notifications', protect, getPolicyNotifications);

// @route   PATCH /api/v1/policy-status/notifications/:notificationId/read
// @desc    Mark notification as read
// @access  Private
router.patch('/notifications/:notificationId/read', protect, markNotificationAsRead);

// @route   GET /api/v1/policy-status/:policyId/timeline
// @desc    Get estimated timeline for policy
// @access  Private
router.get('/:policyId/timeline', protect, getEstimatedTimeline);

module.exports = router;
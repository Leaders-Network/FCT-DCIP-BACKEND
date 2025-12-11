const express = require('express');
const router = express.Router();
const EnhancedNotificationService = require('../services/EnhancedNotificationService');
const { protect } = require('../middlewares/authentication');

// Test notification creation for different scenarios
router.post('/test-policy-created', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userType = req.user.model === 'User' ? 'user' :
            req.user.model === 'Employee' ? 'admin' : 'surveyor';

        console.log(`🔔 Testing policy created notification for user: ${userId} (${userType})`);
        console.log(`🔔 User object:`, req.user);

        // Create a test policy created notification
        const notification = await EnhancedNotificationService.notifyPolicyCreated(
            'test-policy-id-123',
            userId.toString(),
            req.user.email || 'test@example.com'
        );

        res.json({
            success: true,
            message: 'Test policy created notification sent',
            notification
        });
    } catch (error) {
        console.error('Test policy notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test policy notification',
            error: error.message
        });
    }
});

// Test assignment notification
router.post('/test-assignment', protect, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log(`🔔 Testing assignment notification for user: ${userId}`);
        console.log(`🔔 User object:`, req.user);

        const notification = await EnhancedNotificationService.notifyPolicyAssigned(
            'test-policy-id-123',
            userId.toString(),
            req.user.email || 'test@example.com',
            'test-assignment-id-123'
        );

        res.json({
            success: true,
            message: 'Test assignment notification sent',
            notification
        });
    } catch (error) {
        console.error('Test assignment notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test assignment notification',
            error: error.message
        });
    }
});

// Test survey submitted notification
router.post('/test-survey-submitted', protect, async (req, res) => {
    try {
        const userId = req.user.userId;

        console.log(`🔔 Testing survey submitted notification for user: ${userId}`);
        console.log(`🔔 User object:`, req.user);

        const notification = await EnhancedNotificationService.notifySurveySubmitted(
            'test-policy-id-123',
            [userId.toString()],
            'test-submission-id-123'
        );

        res.json({
            success: true,
            message: 'Test survey submitted notification sent',
            notification
        });
    } catch (error) {
        console.error('Test survey submitted notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test survey submitted notification',
            error: error.message
        });
    }
});

// Test all notification types
router.post('/test-all', protect, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userType = req.user.model === 'User' ? 'user' :
            req.user.model === 'Employee' ? 'admin' : 'surveyor';

        console.log(`🔔 Testing all notification types for user: ${userId} (${userType})`);
        console.log(`🔔 User object:`, req.user);

        const notifications = [];

        // Test basic notification
        notifications.push(await EnhancedNotificationService.create({
            recipientId: userId.toString(),
            recipientType: userType,
            type: 'system_alert',
            title: 'System Test Notification',
            message: 'This is a test notification to verify the system is working.',
            priority: 'medium',
            actionUrl: '/dashboard',
            actionLabel: 'Go to Dashboard',
            metadata: {
                icon: 'Bell',
                color: 'blue'
            }
        }));

        // Test policy created (if user)
        if (userType === 'user') {
            notifications.push(await EnhancedNotificationService.notifyPolicyCreated(
                'test-policy-123',
                userId.toString(),
                req.user.email || 'test@example.com'
            ));
        }

        // Test assignment (if surveyor or admin)
        if (userType === 'surveyor' || userType === 'admin') {
            notifications.push(await EnhancedNotificationService.notifyPolicyAssigned(
                'test-policy-123',
                userId.toString(),
                req.user.email || 'test@example.com',
                'test-assignment-123'
            ));
        }

        res.json({
            success: true,
            message: `Created ${notifications.length} test notifications`,
            notifications
        });
    } catch (error) {
        console.error('Test all notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test notifications',
            error: error.message
        });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const { StatusCodes } = require('http-status-codes');
const PolicyRequest = require('../models/PolicyRequest');
const EnhancedNotificationService = require('../services/EnhancedNotificationService');

// @route   POST /api/v1/admin/enforcement/webhook
// @desc    Handle payment verification webhook from external payment service
// @access  Public (webhook endpoint)
router.post('/webhook', async (req, res) => {
    try {
        console.log('🔔 Payment webhook received:', req.body);

        const { policyId, status, transactionId, amount, timestamp } = req.body;

        // Validate required fields
        if (!policyId || !status) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Missing required fields: policyId and status are required'
            });
        }

        // Validate status values
        const validStatuses = ['payment_approved', 'payment_rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Find the policy request
        const policyRequest = await PolicyRequest.findById(policyId);
        if (!policyRequest) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Policy request not found'
            });
        }

        // Verify policy is in correct state for payment processing
        if (policyRequest.status !== 'approved') {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Policy must be in approved status to process payment'
            });
        }

        // Update policy status based on payment result
        const oldStatus = policyRequest.status;
        let newStatus;
        let statusReason;

        if (status === 'payment_approved') {
            newStatus = 'completed';
            statusReason = 'Payment approved via webhook';

            // Add payment information
            policyRequest.paymentInfo = {
                status: 'paid',
                transactionId: transactionId,
                amount: amount,
                paidAt: new Date(timestamp || Date.now()),
                method: 'external_payment_service'
            };
        } else {
            newStatus = 'payment_pending';
            statusReason = 'Payment rejected via webhook';

            // Add payment information
            policyRequest.paymentInfo = {
                status: 'rejected',
                transactionId: transactionId,
                rejectedAt: new Date(timestamp || Date.now()),
                reason: 'Payment rejected by payment service'
            };
        }

        // Update policy status
        policyRequest.status = newStatus;

        // Add status history entry
        policyRequest.statusHistory.push({
            status: newStatus,
            changedBy: 'system', // System-generated change
            changedAt: new Date(),
            reason: statusReason,
            metadata: {
                webhook: true,
                transactionId: transactionId,
                paymentStatus: status
            }
        });

        await policyRequest.save();

        // Send notifications
        try {
            const { User } = require('../models/User');
            const user = await User.findById(policyRequest.userId);

            if (user) {
                if (status === 'payment_approved') {
                    // Notify user about successful payment and policy completion
                    await EnhancedNotificationService.create({
                        recipientId: policyRequest.userId.toString(),
                        recipientType: 'user',
                        type: 'policy_completed',
                        title: 'Policy Completed - Payment Confirmed',
                        message: 'Great news! Your payment has been confirmed and your policy is now completed. You can now access your full policy documents.',
                        priority: 'high',
                        actionUrl: `/dashboard/policies/${policyRequest._id}`,
                        actionLabel: 'View Completed Policy',
                        metadata: {
                            policyId: policyRequest._id.toString(),
                            transactionId: transactionId,
                            icon: 'CheckCircle',
                            color: 'green'
                        },
                        sendEmail: true,
                        recipientEmail: user.email
                    });
                } else {
                    // Notify user about payment rejection
                    await EnhancedNotificationService.create({
                        recipientId: policyRequest.userId.toString(),
                        recipientType: 'user',
                        type: 'payment_rejected',
                        title: 'Payment Issue - Action Required',
                        message: 'There was an issue processing your payment. Please review your payment method and try again to complete your policy.',
                        priority: 'high',
                        actionUrl: `/dashboard/policies/${policyRequest._id}`,
                        actionLabel: 'Retry Payment',
                        metadata: {
                            policyId: policyRequest._id.toString(),
                            transactionId: transactionId,
                            icon: 'XCircle',
                            color: 'red'
                        },
                        sendEmail: true,
                        recipientEmail: user.email
                    });
                }
            }
        } catch (notificationError) {
            console.error('Failed to send payment notification:', notificationError);
            // Don't fail the webhook if notification fails
        }

        console.log(`✅ Policy ${policyId} status updated: ${oldStatus} → ${newStatus}`);

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Payment webhook processed successfully',
            data: {
                policyId: policyRequest._id,
                oldStatus: oldStatus,
                newStatus: newStatus,
                paymentStatus: status,
                transactionId: transactionId
            }
        });

    } catch (error) {
        console.error('❌ Payment webhook error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to process payment webhook',
            error: error.message
        });
    }
});

// @route   GET /api/v1/admin/enforcement/webhook/test
// @desc    Test endpoint to simulate payment webhook
// @access  Private (Admin only - for testing)
router.get('/webhook/test/:policyId', async (req, res) => {
    try {
        const { policyId } = req.params;
        const { status = 'payment_approved' } = req.query;

        // Simulate webhook payload
        const webhookPayload = {
            policyId: policyId,
            status: status,
            transactionId: `TEST_${Date.now()}`,
            amount: 50000,
            timestamp: new Date().toISOString()
        };

        console.log('🧪 Simulating payment webhook:', webhookPayload);

        // Call the webhook handler internally
        req.body = webhookPayload;

        // Find the policy request
        const policyRequest = await PolicyRequest.findById(policyId);
        if (!policyRequest) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Policy request not found'
            });
        }

        // Process the webhook
        const oldStatus = policyRequest.status;
        let newStatus = status === 'payment_approved' ? 'completed' : 'payment_pending';

        policyRequest.status = newStatus;
        policyRequest.paymentInfo = {
            status: status === 'payment_approved' ? 'paid' : 'rejected',
            transactionId: webhookPayload.transactionId,
            amount: webhookPayload.amount,
            paidAt: new Date(),
            method: 'test_webhook'
        };

        policyRequest.statusHistory.push({
            status: newStatus,
            changedBy: 'test_system',
            changedAt: new Date(),
            reason: `Test webhook: ${status}`,
            metadata: {
                webhook: true,
                test: true,
                transactionId: webhookPayload.transactionId
            }
        });

        await policyRequest.save();

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Test webhook processed successfully',
            data: {
                policyId: policyRequest._id,
                oldStatus: oldStatus,
                newStatus: newStatus,
                paymentStatus: status,
                transactionId: webhookPayload.transactionId,
                test: true
            }
        });

    } catch (error) {
        console.error('❌ Test webhook error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to process test webhook',
            error: error.message
        });
    }
});

module.exports = router;
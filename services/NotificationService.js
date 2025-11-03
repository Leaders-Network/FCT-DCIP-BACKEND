const { sendReportAvailableNotification, sendReportProcessingUpdate } = require('../utils/emailService');
const MergedReport = require('../models/MergedReport');
const PolicyRequest = require('../models/PolicyRequest');

class NotificationService {
    constructor() {
        this.notificationQueue = [];
        this.isProcessing = false;
    }

    /**
     * Send real-time notification when report becomes available
     * @param {string} mergedReportId - The merged report ID
     * @returns {Promise<Object>} - Notification result
     */
    async notifyReportAvailable(mergedReportId) {
        try {
            console.log(`📧 Sending report available notification for: ${mergedReportId}`);

            const mergedReport = await MergedReport.findById(mergedReportId)
                .populate('policyId');

            if (!mergedReport) {
                throw new Error('Merged report not found');
            }

            const policy = mergedReport.policyId;
            const userEmail = policy.contactDetails.email;

            // Prepare notification data
            const notificationData = {
                policyId: policy._id,
                reportId: mergedReport._id,
                propertyAddress: policy.propertyDetails?.address || 'N/A',
                finalRecommendation: mergedReport.finalRecommendation,
                paymentEnabled: mergedReport.paymentEnabled,
                conflictDetected: mergedReport.conflictDetected,
                conflictResolved: mergedReport.conflictResolved,
                reportUrl: `${process.env.FRONTEND_URL}/user/dashboard/reports/${mergedReport._id}`,
                dashboardUrl: `${process.env.FRONTEND_URL}/user/dashboard`,
                releasedAt: mergedReport.releasedAt,
                processingTime: mergedReport.mergingMetadata?.processingTime
            };

            // Send email notification
            await sendReportAvailableNotification(userEmail, notificationData);

            // Update notification status
            mergedReport.notifications.releaseNotificationSent = true;
            mergedReport.notifications.userNotified = true;
            await mergedReport.save();

            console.log(`✅ Report available notification sent for: ${mergedReportId}`);

            return {
                success: true,
                notificationSent: true,
                userEmail: userEmail,
                sentAt: new Date()
            };

        } catch (error) {
            console.error(`❌ Failed to send report available notification for ${mergedReportId}:`, error);
            throw error;
        }
    }

    /**
     * Send processing status update to user
     * @param {string} policyId - The policy ID
     * @param {Object} statusUpdate - Status update information
     * @returns {Promise<Object>} - Notification result
     */
    async notifyProcessingUpdate(policyId, statusUpdate) {
        try {
            console.log(`📊 Sending processing update for policy: ${policyId}`);

            const policy = await PolicyRequest.findById(policyId);
            if (!policy) {
                throw new Error('Policy not found');
            }

            const userEmail = policy.contactDetails.email;

            // Prepare update data
            const updateData = {
                policyId: policy._id,
                propertyAddress: policy.propertyDetails?.address || 'N/A',
                status: statusUpdate.status,
                message: statusUpdate.message,
                progress: statusUpdate.progress || null,
                estimatedCompletion: statusUpdate.estimatedCompletion || null,
                dashboardUrl: `${process.env.FRONTEND_URL}/user/dashboard`,
                updatedAt: new Date()
            };

            // Send processing update email (only for significant updates)
            if (statusUpdate.sendEmail) {
                await sendReportProcessingUpdate(userEmail, updateData);
            }

            console.log(`✅ Processing update sent for policy: ${policyId}`);

            return {
                success: true,
                updateSent: true,
                userEmail: userEmail,
                status: statusUpdate.status
            };

        } catch (error) {
            console.error(`❌ Failed to send processing update for policy ${policyId}:`, error);
            throw error;
        }
    }

    /**
     * Send batch notifications for multiple reports
     * @param {Array} reportIds - Array of merged report IDs
     * @returns {Promise<Object>} - Batch notification result
     */
    async sendBatchNotifications(reportIds) {
        try {
            console.log(`📧 Sending batch notifications for ${reportIds.length} reports`);

            const results = [];
            const errors = [];

            for (const reportId of reportIds) {
                try {
                    const result = await this.notifyReportAvailable(reportId);
                    results.push({ reportId, ...result });
                } catch (error) {
                    errors.push({ reportId, error: error.message });
                }
            }

            console.log(`✅ Batch notifications completed: ${results.length} success, ${errors.length} errors`);

            return {
                success: true,
                totalProcessed: reportIds.length,
                successful: results.length,
                failed: errors.length,
                results: results,
                errors: errors
            };

        } catch (error) {
            console.error('❌ Batch notification processing failed:', error);
            throw error;
        }
    }

    /**
     * Get notification history for a user
     * @param {string} userId - The user ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Notification history
     */
    async getNotificationHistory(userId, options = {}) {
        try {
            const { page = 1, limit = 20, type = 'all' } = options;

            // Find all merged reports for user's policies
            const reports = await MergedReport.find({})
                .populate({
                    path: 'policyId',
                    match: { userId: userId },
                    select: 'propertyDetails contactDetails'
                })
                .sort({ createdAt: -1 })
                .limit(limit * 1)
                .skip((page - 1) * limit);

            // Filter out reports where policyId is null (no match)
            const userReports = reports.filter(report => report.policyId !== null);

            const notifications = userReports.map(report => ({
                reportId: report._id,
                policyId: report.policyId._id,
                propertyAddress: report.policyId.propertyDetails?.address || 'N/A',
                type: 'report_available',
                status: report.releaseStatus,
                notificationSent: report.notifications.releaseNotificationSent,
                userNotified: report.notifications.userNotified,
                sentAt: report.releasedAt,
                createdAt: report.createdAt
            }));

            return {
                success: true,
                data: {
                    notifications: notifications,
                    pagination: {
                        current: parseInt(page),
                        total: notifications.length,
                        hasMore: notifications.length === limit
                    }
                }
            };

        } catch (error) {
            console.error(`Error getting notification history for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     * @param {string} userId - The user ID
     * @param {string} reportId - The report ID
     * @returns {Promise<Object>} - Mark read result
     */
    async markNotificationRead(userId, reportId) {
        try {
            const mergedReport = await MergedReport.findById(reportId)
                .populate('policyId');

            if (!mergedReport) {
                throw new Error('Report not found');
            }

            // Verify user owns this report
            if (mergedReport.policyId.userId.toString() !== userId) {
                throw new Error('Access denied');
            }

            // Add read timestamp to access history
            mergedReport.logAccess(userId, 'notification_read', null, null);
            await mergedReport.save();

            return {
                success: true,
                reportId: reportId,
                markedReadAt: new Date()
            };

        } catch (error) {
            console.error(`Error marking notification as read:`, error);
            throw error;
        }
    }

    /**
     * Schedule delayed notification (for processing updates)
     * @param {string} policyId - The policy ID
     * @param {Object} statusUpdate - Status update information
     * @param {number} delayMinutes - Delay in minutes
     * @returns {Promise<void>}
     */
    scheduleDelayedNotification(policyId, statusUpdate, delayMinutes = 5) {
        setTimeout(async () => {
            try {
                await this.notifyProcessingUpdate(policyId, statusUpdate);
            } catch (error) {
                console.error(`Failed to send delayed notification for policy ${policyId}:`, error);
            }
        }, delayMinutes * 60 * 1000);
    }
}

module.exports = NotificationService;
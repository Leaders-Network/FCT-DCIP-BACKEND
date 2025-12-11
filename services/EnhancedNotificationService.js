const Notification = require('../models/Notification');
const emailService = require('./emailService');

class EnhancedNotificationService {
    /**
     * Create a notification
     */
    static async create({
        recipientId,
        recipientType,
        type,
        title,
        message,
        data = {},
        priority = 'medium',
        actionUrl,
        actionLabel,
        expiresAt,
        metadata = {},
        sendEmail = false,
        recipientEmail
    }) {
        try {
            console.log(`🔔 Creating notification: ${type} for ${recipientType} ${recipientId}`);
            console.log(`🔔 Title: ${title}`);
            console.log(`🔔 Message: ${message}`);

            const notification = await Notification.create({
                recipientId,
                recipientType,
                type,
                title,
                message,
                data,
                priority,
                actionUrl,
                actionLabel,
                expiresAt,
                metadata
            });

            console.log(`🔔 Notification created successfully with ID: ${notification._id}`);

            // Send email if requested
            if (sendEmail && recipientEmail) {
                console.log(`🔔 Sending email notification to: ${recipientEmail}`);
                try {
                    await this.sendEmailNotification(recipientEmail, {
                        title,
                        message,
                        actionUrl,
                        actionLabel
                    });
                    console.log(`🔔 Email notification sent successfully`);
                } catch (emailError) {
                    console.error('🔔 Failed to send email notification:', emailError);
                    // Don't fail notification creation if email fails
                }
            }

            return notification;
        } catch (error) {
            console.error('🔔 Failed to create notification:', error);
            throw error;
        }
    }

    /**
     * Create bulk notifications
     */
    static async createBulk(notifications) {
        try {
            return await Notification.insertMany(notifications);
        } catch (error) {
            console.error('Failed to create bulk notifications:', error);
            throw error;
        }
    }

    /**
     * Get notifications for a user
     */
    static async getNotifications(recipientId, { page = 1, limit = 20, unreadOnly = false } = {}) {
        try {
            const query = { recipientId };
            if (unreadOnly) {
                query.read = false;
            }

            const notifications = await Notification.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip((page - 1) * limit);

            const total = await Notification.countDocuments(query);
            const unreadCount = await Notification.getUnreadCount(recipientId);

            return {
                notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                },
                unreadCount
            };
        } catch (error) {
            console.error('Failed to get notifications:', error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(notificationId) {
        try {
            const notification = await Notification.findById(notificationId);
            if (!notification) {
                throw new Error('Notification not found');
            }
            return await notification.markAsRead();
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
            throw error;
        }
    }

    /**
     * Mark all notifications as read
     */
    static async markAllAsRead(recipientId) {
        try {
            return await Notification.markAllAsRead(recipientId);
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
            throw error;
        }
    }

    /**
     * Delete notification
     */
    static async delete(notificationId) {
        try {
            return await Notification.findByIdAndDelete(notificationId);
        } catch (error) {
            console.error('Failed to delete notification:', error);
            throw error;
        }
    }

    /**
     * Send email notification
     */
    static async sendEmailNotification(email, { title, message, actionUrl, actionLabel }) {
        try {
            // Use existing email service
            await emailService.sendEmail({
                to: email,
                subject: title,
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #028835;">${title}</h2>
            <p>${message}</p>
            ${actionUrl ? `
              <a href="${actionUrl}" style="display: inline-block; padding: 12px 24px; background-color: #028835; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px;">
                ${actionLabel || 'View Details'}
              </a>
            ` : ''}
          </div>
        `
            });
        } catch (error) {
            console.error('Failed to send email notification:', error);
            // Don't throw - email failure shouldn't break notification creation
        }
    }

    // ===== Specific Notification Types =====

    /**
     * Policy created notification
     */
    static async notifyPolicyCreated(policyId, userId, userEmail) {
        console.log(`🔔 notifyPolicyCreated called: policyId=${policyId}, userId=${userId}, email=${userEmail}`);
        return await this.create({
            recipientId: userId,
            recipientType: 'user',
            type: 'policy_created',
            title: 'Policy Request Submitted',
            message: 'Your policy request has been submitted successfully and is being reviewed.',
            priority: 'medium',
            actionUrl: `/dashboard/policies/${policyId}`,
            actionLabel: 'View Policy',
            metadata: {
                policyId,
                icon: 'CheckCircle',
                color: 'green'
            },
            sendEmail: true,
            recipientEmail: userEmail
        });
    }

    /**
     * Policy assigned notification
     */
    static async notifyPolicyAssigned(policyId, surveyorId, surveyorEmail, assignmentId) {
        return await this.create({
            recipientId: surveyorId,
            recipientType: 'surveyor',
            type: 'assignment_created',
            title: 'New Survey Assignment',
            message: 'You have been assigned a new property survey. Please review the details.',
            priority: 'high',
            actionUrl: `/surveyor/assignments/${assignmentId}`,
            actionLabel: 'View Assignment',
            metadata: {
                policyId,
                assignmentId,
                icon: 'Clipboard',
                color: 'blue'
            },
            sendEmail: true,
            recipientEmail: surveyorEmail
        });
    }

    /**
     * Survey submitted notification
     */
    static async notifySurveySubmitted(policyId, adminIds, submissionId) {
        const notifications = adminIds.map(adminId => ({
            recipientId: adminId,
            recipientType: 'admin',
            type: 'survey_submitted',
            title: 'Survey Submitted for Review',
            message: 'A surveyor has submitted a survey report that requires your review.',
            priority: 'high',
            actionUrl: `/admin/dashboard/policies/${policyId}`,
            actionLabel: 'Review Survey',
            metadata: {
                policyId,
                icon: 'FileText',
                color: 'purple'
            }
        }));

        return await this.createBulk(notifications);
    }

    /**
     * Report ready notification
     */
    static async notifyReportReady(policyId, userId, userEmail, reportId) {
        return await this.create({
            recipientId: userId,
            recipientType: 'user',
            type: 'report_ready',
            title: 'Survey Report Ready',
            message: 'Your property survey report is ready for download.',
            priority: 'high',
            actionUrl: `/dashboard/reports/${reportId}`,
            actionLabel: 'Download Report',
            metadata: {
                policyId,
                reportId,
                icon: 'Download',
                color: 'green'
            },
            sendEmail: true,
            recipientEmail: userEmail
        });
    }

    /**
     * Assignment deadline approaching
     */
    static async notifyDeadlineApproaching(assignmentId, surveyorId, surveyorEmail, hoursRemaining) {
        return await this.create({
            recipientId: surveyorId,
            recipientType: 'surveyor',
            type: 'assignment_deadline_approaching',
            title: 'Assignment Deadline Approaching',
            message: `Your survey assignment is due in ${hoursRemaining} hours. Please complete it soon.`,
            priority: 'urgent',
            actionUrl: `/surveyor/assignments/${assignmentId}`,
            actionLabel: 'View Assignment',
            metadata: {
                assignmentId,
                icon: 'Clock',
                color: 'orange'
            },
            sendEmail: true,
            recipientEmail: surveyorEmail
        });
    }

    /**
     * Payment required notification
     */
    static async notifyPaymentRequired(policyId, userId, userEmail, amount) {
        return await this.create({
            recipientId: userId,
            recipientType: 'user',
            type: 'payment_required',
            title: 'Payment Required',
            message: `Payment of ₦${amount.toLocaleString()} is required to complete your policy.`,
            priority: 'high',
            actionUrl: `/dashboard/payments/${policyId}`,
            actionLabel: 'Make Payment',
            metadata: {
                policyId,
                icon: 'CreditCard',
                color: 'blue'
            },
            sendEmail: true,
            recipientEmail: userEmail
        });
    }
}

module.exports = EnhancedNotificationService;

const { sendEmail } = require('../utils/emailService');
const User = require('../models/User');
const MergedReport = require('../models/MergedReport');

class UserNotificationService {
    /**
     * Notify user when their merged report is ready
     */
    static async notifyReportReady(mergedReportId) {
        try {
            console.log(`📧 Sending report ready notification for: ${mergedReportId}`);

            const report = await MergedReport.findById(mergedReportId)
                .populate({
                    path: 'policyId',
                    populate: {
                        path: 'userId',
                        select: 'firstName lastName email'
                    }
                });

            if (!report || !report.policyId || !report.policyId.userId) {
                throw new Error('Report or user not found');
            }

            const user = report.policyId.userId;
            const propertyAddress = report.policyId.propertyDetails?.address || 'Your property';

            // Prepare email content
            const emailData = {
                to: user.email,
                subject: 'Your Property Assessment Report is Ready',
                template: 'report-ready',
                context: {
                    userName: `${user.firstName} ${user.lastName}`,
                    propertyAddress,
                    reportId: report._id,
                    finalRecommendation: report.finalRecommendation,
                    paymentEnabled: report.paymentEnabled,
                    conflictDetected: report.conflictDetected,
                    dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/reports`,
                    reportUrl: `${process.env.FRONTEND_URL}/dashboard/reports?reportId=${report._id}`
                }
            };

            await sendEmail(emailData);

            // Mark as notified
            report.notifications.userNotified = true;
            report.notifications.releaseNotificationSent = true;
            await report.save();

            console.log(`✅ Report ready notification sent to: ${user.email}`);
            return { success: true, email: user.email };

        } catch (error) {
            console.error('❌ Failed to send report ready notification:', error);
            throw error;
        }
    }

    /**
     * Notify user about payment decision
     */
    static async notifyPaymentDecision(mergedReportId, paymentDecision) {
        try {
            const report = await MergedReport.findById(mergedReportId)
                .populate({
                    path: 'policyId',
                    populate: {
                        path: 'userId',
                        select: 'firstName lastName email'
                    }
                });

            if (!report || !report.policyId || !report.policyId.userId) {
                throw new Error('Report or user not found');
            }

            const user = report.policyId.userId;
            const propertyAddress = report.policyId.propertyDetails?.address || 'Your property';

            const emailData = {
                to: user.email,
                subject: `Payment Decision: ${paymentDecision.decision}`,
                template: 'payment-decision',
                context: {
                    userName: `${user.firstName} ${user.lastName}`,
                    propertyAddress,
                    decision: paymentDecision.decision,
                    amount: paymentDecision.amount,
                    reason: paymentDecision.reason,
                    dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
                }
            };

            await sendEmail(emailData);
            console.log(`✅ Payment decision notification sent to: ${user.email}`);

        } catch (error) {
            console.error('❌ Failed to send payment decision notification:', error);
            throw error;
        }
    }
}

module.exports = UserNotificationService;
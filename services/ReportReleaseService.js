const MergedReport = require('../models/MergedReport');
const PolicyRequest = require('../models/PolicyRequest');
const { sendReportAvailableNotification } = require('../utils/emailService');

class ReportReleaseService {
    constructor() {
        this.processingQueue = new Map();
    }

    /**
     * Automatically release a merged report after successful merging
     * @param {string} mergedReportId - The merged report ID
     * @returns {Promise<Object>} - Release result
     */
    async autoReleaseReport(mergedReportId) {
        try {
            console.log(`🚀 Starting automatic release for report: ${mergedReportId}`);

            // Get merged report with policy details
            const mergedReport = await MergedReport.findById(mergedReportId)
                .populate('policyId')
                .populate('dualAssignmentId');

            if (!mergedReport) {
                throw new Error('Merged report not found');
            }

            // Check if report is eligible for automatic release
            const eligibilityCheck = this.checkReleaseEligibility(mergedReport);

            if (!eligibilityCheck.eligible) {
                console.log(`⏸️ Report ${mergedReportId} not eligible for auto-release: ${eligibilityCheck.reason}`);
                return {
                    success: false,
                    reason: eligibilityCheck.reason,
                    requiresManualReview: true
                };
            }

            // Perform final validation
            const validationResult = await this.validateReportForRelease(mergedReport);

            if (!validationResult.valid) {
                console.log(`❌ Report ${mergedReportId} failed validation: ${validationResult.reason}`);
                return {
                    success: false,
                    reason: validationResult.reason,
                    requiresManualReview: true
                };
            }

            // Release the report
            const releaseResult = await this.performReportRelease(mergedReport);

            // Send notifications
            await this.sendReleaseNotifications(mergedReport);

            console.log(`✅ Report ${mergedReportId} automatically released successfully`);

            return {
                success: true,
                releasedAt: releaseResult.releasedAt,
                notificationsSent: releaseResult.notificationsSent,
                reportUrl: releaseResult.reportUrl
            };

        } catch (error) {
            console.error(`❌ Auto-release failed for report ${mergedReportId}:`, error);
            throw error;
        }
    }

    /**
     * Check if report is eligible for automatic release
     * @param {Object} mergedReport - The merged report object
     * @returns {Object} - Eligibility result
     */
    checkReleaseEligibility(mergedReport) {
        // Check if report is already released
        if (mergedReport.releaseStatus === 'released') {
            return {
                eligible: false,
                reason: 'Report already released'
            };
        }

        // Check if report is withheld due to conflicts
        if (mergedReport.releaseStatus === 'withheld') {
            return {
                eligible: false,
                reason: 'Report withheld due to conflicts - requires manual review'
            };
        }

        // Check if report has unresolved conflicts
        if (mergedReport.conflictDetected && !mergedReport.conflictResolved) {
            return {
                eligible: false,
                reason: 'Unresolved conflicts detected - requires manual review'
            };
        }

        // Check if report has critical conflicts
        if (mergedReport.conflictDetected &&
            mergedReport.conflictDetails?.conflictSeverity === 'critical') {
            return {
                eligible: false,
                reason: 'Critical conflicts detected - requires manual review'
            };
        }

        // Check if final recommendation is determined
        if (!mergedReport.finalRecommendation) {
            return {
                eligible: false,
                reason: 'Final recommendation not determined'
            };
        }

        // Check processing completeness
        if (!mergedReport.mergingMetadata?.mergedAt) {
            return {
                eligible: false,
                reason: 'Report merging not completed'
            };
        }

        return {
            eligible: true,
            reason: 'Report eligible for automatic release'
        };
    }

    /**
     * Validate report for release
     * @param {Object} mergedReport - The merged report object
     * @returns {Promise<Object>} - Validation result
     */
    async validateReportForRelease(mergedReport) {
        try {
            // Validate report sections exist
            if (!mergedReport.reportSections?.ammc || !mergedReport.reportSections?.nia) {
                return {
                    valid: false,
                    reason: 'Missing report sections from AMMC or NIA'
                };
            }

            // Validate essential fields in AMMC section
            const ammcSection = mergedReport.reportSections.ammc;
            if (!ammcSection.recommendations || !ammcSection.surveyorName) {
                return {
                    valid: false,
                    reason: 'Missing essential AMMC report data'
                };
            }

            // Validate essential fields in NIA section
            const niaSection = mergedReport.reportSections.nia;
            if (!niaSection.recommendations || !niaSection.surveyorName) {
                return {
                    valid: false,
                    reason: 'Missing essential NIA report data'
                };
            }

            // Validate policy exists and is active
            if (!mergedReport.policyId || mergedReport.policyId.status === 'cancelled') {
                return {
                    valid: false,
                    reason: 'Associated policy not found or cancelled'
                };
            }

            // Validate contact information exists for notifications
            if (!mergedReport.policyId.contactDetails?.email) {
                return {
                    valid: false,
                    reason: 'Policy holder email not found for notifications'
                };
            }

            return {
                valid: true,
                reason: 'Report validation passed'
            };

        } catch (error) {
            return {
                valid: false,
                reason: `Validation error: ${error.message}`
            };
        }
    }

    /**
     * Perform the actual report release
     * @param {Object} mergedReport - The merged report object
     * @returns {Promise<Object>} - Release result
     */
    async performReportRelease(mergedReport) {
        try {
            // Update report status
            mergedReport.releaseStatus = 'released';
            mergedReport.releasedAt = new Date();
            mergedReport.releasedBy = null; // System release

            // Mark notifications as pending
            mergedReport.notifications.releaseNotificationSent = false;
            mergedReport.notifications.userNotified = false;

            // Add release history entry
            if (!mergedReport.accessHistory) {
                mergedReport.accessHistory = [];
            }

            // Save the updated report
            await mergedReport.save();

            // Generate report URL for user access
            const reportUrl = `${process.env.FRONTEND_URL}/user/dashboard/reports/${mergedReport._id}`;

            return {
                releasedAt: mergedReport.releasedAt,
                reportUrl: reportUrl,
                notificationsSent: false // Will be updated after notifications
            };

        } catch (error) {
            throw new Error(`Failed to perform report release: ${error.message}`);
        }
    }

    /**
     * Send release notifications to user and admins
     * @param {Object} mergedReport - The merged report object
     * @returns {Promise<void>}
     */
    async sendReleaseNotifications(mergedReport) {
        try {
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
                releasedAt: mergedReport.releasedAt
            };

            // Send user notification
            await sendReportAvailableNotification(userEmail, notificationData);

            // Update notification status
            mergedReport.notifications.releaseNotificationSent = true;
            mergedReport.notifications.userNotified = true;
            await mergedReport.save();

            console.log(`📧 Release notifications sent for report: ${mergedReport._id}`);

        } catch (error) {
            console.error(`❌ Failed to send release notifications for report ${mergedReport._id}:`, error);
            // Don't throw error - report is still released even if notifications fail
        }
    }

    /**
     * Get report processing status for user dashboard
     * @param {string} policyId - The policy ID
     * @returns {Promise<Object>} - Processing status
     */
    async getReportProcessingStatus(policyId) {
        try {
            const mergedReport = await MergedReport.findOne({ policyId })
                .populate('dualAssignmentId');

            if (!mergedReport) {
                return {
                    status: 'not_started',
                    message: 'Report processing not yet started',
                    estimatedCompletion: null
                };
            }

            const dualAssignment = mergedReport.dualAssignmentId;

            // Check completion status
            if (dualAssignment.completionStatus < 100) {
                return {
                    status: 'awaiting_surveys',
                    message: 'Waiting for survey submissions to complete',
                    progress: dualAssignment.completionStatus,
                    estimatedCompletion: this.calculateEstimatedCompletion(dualAssignment)
                };
            }

            // Check processing status
            if (mergedReport.releaseStatus === 'pending') {
                const processingTime = Date.now() - mergedReport.createdAt.getTime();
                const maxProcessingTime = 5 * 60 * 1000; // 5 minutes

                if (processingTime < maxProcessingTime) {
                    return {
                        status: 'processing',
                        message: 'Report is being processed and merged',
                        estimatedCompletion: new Date(mergedReport.createdAt.getTime() + maxProcessingTime),
                        processingProgress: Math.min((processingTime / maxProcessingTime) * 100, 95)
                    };
                } else {
                    return {
                        status: 'processing_delayed',
                        message: 'Report processing is taking longer than expected',
                        estimatedCompletion: null
                    };
                }
            }

            // Check if withheld
            if (mergedReport.releaseStatus === 'withheld') {
                return {
                    status: 'under_review',
                    message: 'Report is under manual review due to detected conflicts',
                    conflictDetails: mergedReport.conflictDetails,
                    estimatedCompletion: null
                };
            }

            // Report is released
            if (mergedReport.releaseStatus === 'released') {
                return {
                    status: 'completed',
                    message: 'Report is available for download',
                    completedAt: mergedReport.releasedAt,
                    reportId: mergedReport._id
                };
            }

            return {
                status: 'unknown',
                message: 'Report status could not be determined',
                estimatedCompletion: null
            };

        } catch (error) {
            console.error(`Error getting processing status for policy ${policyId}:`, error);
            throw error;
        }
    }

    /**
     * Calculate estimated completion time based on assignment progress
     * @param {Object} dualAssignment - The dual assignment object
     * @returns {Date|null} - Estimated completion date
     */
    calculateEstimatedCompletion(dualAssignment) {
        try {
            const now = new Date();

            // If both assignments are complete, processing should finish within 5 minutes
            if (dualAssignment.completionStatus === 100) {
                return new Date(now.getTime() + 5 * 60 * 1000);
            }

            // Estimate based on assignment deadlines
            const ammcDeadline = dualAssignment.ammcAssignmentId?.deadline;
            const niaDeadline = dualAssignment.niaAssignmentId?.deadline;

            if (ammcDeadline && niaDeadline) {
                // Use the later deadline plus processing time
                const laterDeadline = new Date(Math.max(
                    new Date(ammcDeadline).getTime(),
                    new Date(niaDeadline).getTime()
                ));
                return new Date(laterDeadline.getTime() + 5 * 60 * 1000);
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Manually release a withheld report (admin action)
     * @param {string} mergedReportId - The merged report ID
     * @param {string} adminId - The admin performing the release
     * @param {string} reason - Reason for manual release
     * @returns {Promise<Object>} - Release result
     */
    async manualReleaseReport(mergedReportId, adminId, reason) {
        try {
            console.log(`👤 Manual release initiated for report: ${mergedReportId} by admin: ${adminId}`);

            const mergedReport = await MergedReport.findById(mergedReportId)
                .populate('policyId');

            if (!mergedReport) {
                throw new Error('Merged report not found');
            }

            if (mergedReport.releaseStatus === 'released') {
                throw new Error('Report is already released');
            }

            // Perform manual release
            mergedReport.releaseStatus = 'released';
            mergedReport.releasedAt = new Date();
            mergedReport.releasedBy = adminId;
            mergedReport.manualReleaseReason = reason;

            // Mark conflicts as resolved if they exist
            if (mergedReport.conflictDetected) {
                mergedReport.conflictResolved = true;
                mergedReport.conflictDetails.resolvedBy = adminId;
                mergedReport.conflictDetails.resolvedAt = new Date();
                mergedReport.conflictDetails.resolutionReason = reason;
            }

            await mergedReport.save();

            // Send notifications
            await this.sendReleaseNotifications(mergedReport);

            console.log(`✅ Report ${mergedReportId} manually released by admin ${adminId}`);

            return {
                success: true,
                releasedAt: mergedReport.releasedAt,
                releasedBy: adminId,
                reason: reason
            };

        } catch (error) {
            console.error(`❌ Manual release failed for report ${mergedReportId}:`, error);
            throw error;
        }
    }
}

module.exports = ReportReleaseService;
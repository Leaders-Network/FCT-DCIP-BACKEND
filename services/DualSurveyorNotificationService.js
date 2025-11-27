const nodemailer = require('nodemailer');
const { Employee } = require('../models/Employee');
const DualAssignment = require('../models/DualAssignment');

class DualSurveyorNotificationService {
    constructor() {
        this.transporter = null;
    }

    /**
     * Get or create email transporter (lazy initialization)
     */
    getTransporter() {
        if (!this.transporter) {
            try {
                this.transporter = nodemailer.createTransporter({
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: process.env.SMTP_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS
                    }
                });
            } catch (error) {
                console.error('Failed to create email transporter:', error);
                // Return a mock transporter that logs instead of sending
                return {
                    sendMail: async (options) => {
                        console.log('Email would be sent:', options);
                        return { messageId: 'mock-id' };
                    }
                };
            }
        }
        return this.transporter;
    }

    /**
     * Notify other surveyor when a report is submitted
     */
    async notifyOtherSurveyor(dualAssignmentId, submittingOrganization, submissionDetails) {
        try {
            const dualAssignment = await DualAssignment.findById(dualAssignmentId)
                .populate('policyId', 'propertyDetails contactDetails');

            if (!dualAssignment) {
                throw new Error('Dual assignment not found');
            }

            const otherOrganization = submittingOrganization === 'AMMC' ? 'NIA' : 'AMMC';
            const otherSurveyorContact = submittingOrganization === 'AMMC'
                ? dualAssignment.niaSurveyorContact
                : dualAssignment.ammcSurveyorContact;

            if (!otherSurveyorContact || !otherSurveyorContact.surveyorId) {
                console.log('No other surveyor to notify');
                return;
            }

            // Get other surveyor's details
            const otherSurveyor = await Employee.findById(otherSurveyorContact.surveyorId);
            if (!otherSurveyor || !otherSurveyor.email) {
                console.log('Other surveyor email not found');
                return;
            }

            const policy = dualAssignment.policyId;
            const propertyAddress = policy?.propertyDetails?.address || 'Property address not available';
            const propertyType = policy?.propertyDetails?.propertyType || 'Property';

            // Prepare notification content
            const subject = `${submittingOrganization} Survey Report Submitted - Dual Assignment Update`;
            const emailContent = this.generateProgressNotificationEmail({
                recipientName: `${otherSurveyor.firstname} ${otherSurveyor.lastname}`,
                recipientOrganization: otherOrganization,
                submittingOrganization,
                propertyAddress,
                propertyType,
                completionStatus: dualAssignment.completionStatus,
                policyId: policy._id,
                submissionDetails
            });

            // Send email notification
            await this.sendEmail({
                to: otherSurveyor.email,
                subject,
                html: emailContent
            });

            // Log notification
            console.log(`Notification sent to ${otherOrganization} surveyor: ${otherSurveyor.email}`);

            // Update dual assignment notification status
            if (submittingOrganization === 'AMMC') {
                dualAssignment.notifications.niaNotified = true;
            } else {
                dualAssignment.notifications.ammcNotified = true;
            }
            dualAssignment.notifications.lastNotificationSent = new Date();
            await dualAssignment.save();

            return {
                success: true,
                notifiedSurveyor: {
                    name: `${otherSurveyor.firstname} ${otherSurveyor.lastname}`,
                    email: otherSurveyor.email,
                    organization: otherOrganization
                }
            };

        } catch (error) {
            console.error('Failed to notify other surveyor:', error);
            throw error;
        }
    }

    /**
     * Notify both surveyors when reports are merged
     */
    async notifyReportMerged(dualAssignmentId, mergedReportDetails) {
        try {
            const dualAssignment = await DualAssignment.findById(dualAssignmentId)
                .populate('policyId', 'propertyDetails contactDetails userId');

            if (!dualAssignment) {
                throw new Error('Dual assignment not found');
            }

            const notifications = [];

            // Notify AMMC surveyor
            if (dualAssignment.ammcSurveyorContact?.surveyorId) {
                const ammcSurveyor = await Employee.findById(dualAssignment.ammcSurveyorContact.surveyorId);
                if (ammcSurveyor?.email) {
                    const emailContent = this.generateMergedReportNotificationEmail({
                        recipientName: `${ammcSurveyor.firstname} ${ammcSurveyor.lastname}`,
                        recipientOrganization: 'AMMC',
                        mergedReportDetails,
                        policyId: dualAssignment.policyId._id
                    });

                    await this.sendEmail({
                        to: ammcSurveyor.email,
                        subject: 'Dual Survey Reports Merged - Ready for Review',
                        html: emailContent
                    });

                    notifications.push({
                        organization: 'AMMC',
                        surveyor: `${ammcSurveyor.firstname} ${ammcSurveyor.lastname}`,
                        email: ammcSurveyor.email
                    });
                }
            }

            // Notify NIA surveyor
            if (dualAssignment.niaSurveyorContact?.surveyorId) {
                const niaSurveyor = await Employee.findById(dualAssignment.niaSurveyorContact.surveyorId);
                if (niaSurveyor?.email) {
                    const emailContent = this.generateMergedReportNotificationEmail({
                        recipientName: `${niaSurveyor.firstname} ${niaSurveyor.lastname}`,
                        recipientOrganization: 'NIA',
                        mergedReportDetails,
                        policyId: dualAssignment.policyId._id
                    });

                    await this.sendEmail({
                        to: niaSurveyor.email,
                        subject: 'Dual Survey Reports Merged - Ready for Review',
                        html: emailContent
                    });

                    notifications.push({
                        organization: 'NIA',
                        surveyor: `${niaSurveyor.firstname} ${niaSurveyor.lastname}`,
                        email: niaSurveyor.email
                    });
                }
            }

            // Notify policy owner
            if (dualAssignment.policyId.userId) {
                const policyOwner = await Employee.findById(dualAssignment.policyId.userId);
                if (policyOwner?.email) {
                    const emailContent = this.generateUserReportReadyNotificationEmail({
                        recipientName: `${policyOwner.firstname} ${policyOwner.lastname}`,
                        mergedReportDetails,
                        policyId: dualAssignment.policyId._id
                    });

                    await this.sendEmail({
                        to: policyOwner.email,
                        subject: 'Your Property Survey Report is Ready',
                        html: emailContent
                    });

                    notifications.push({
                        type: 'policy_owner',
                        name: `${policyOwner.firstname} ${policyOwner.lastname}`,
                        email: policyOwner.email
                    });
                }
            }

            return {
                success: true,
                notifications
            };

        } catch (error) {
            console.error('Failed to notify report merged:', error);
            throw error;
        }
    }

    /**
     * Generate progress notification email content
     */
    generateProgressNotificationEmail({
        recipientName,
        recipientOrganization,
        submittingOrganization,
        propertyAddress,
        propertyType,
        completionStatus,
        policyId,
        submissionDetails
    }) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Dual Survey Progress Update</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h1 style="margin: 0; font-size: 24px;">Dual Survey Progress Update</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your collaborative survey assignment has been updated</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #495057; margin-top: 0;">Hello ${recipientName},</h2>
                        <p>The ${submittingOrganization} surveyor has submitted their report for the dual survey assignment.</p>
                        
                        <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h3 style="margin-top: 0; color: #28a745;">Property Details</h3>
                            <p><strong>Type:</strong> ${propertyType}</p>
                            <p><strong>Address:</strong> ${propertyAddress}</p>
                            <p><strong>Policy ID:</strong> ${policyId}</p>
                        </div>
                        
                        <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h3 style="margin-top: 0; color: #007bff;">Progress Status</h3>
                            <p><strong>Overall Completion:</strong> ${completionStatus}%</p>
                            <div style="background: #e9ecef; height: 10px; border-radius: 5px; margin: 10px 0;">
                                <div style="background: #28a745; height: 10px; border-radius: 5px; width: ${completionStatus}%;"></div>
                            </div>
                            <p><strong>${submittingOrganization}:</strong> ✅ Report Submitted</p>
                            <p><strong>${recipientOrganization}:</strong> ${completionStatus === 100 ? '✅ Report Submitted' : '⏳ Pending Submission'}</p>
                        </div>
                        
                        ${completionStatus === 100 ? `
                        <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h3 style="margin-top: 0;">🎉 Both Reports Submitted!</h3>
                            <p>Both survey reports have been submitted. The system will automatically merge the reports within 5 minutes and notify all parties when the merged report is ready.</p>
                        </div>
                        ` : `
                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h3 style="margin-top: 0;">⏳ Awaiting Your Submission</h3>
                            <p>Please complete and submit your ${recipientOrganization} survey report to finalize this dual survey assignment.</p>
                        </div>
                        `}
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL}/surveyor/dashboard/assignments" 
                               style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                View Assignment Details
                            </a>
                        </div>
                    </div>
                    
                    <div style="text-align: center; color: #6c757d; font-size: 14px;">
                        <p>This is an automated notification from the Dual Surveyor System.</p>
                        <p>If you have any questions, please contact your administrator.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Generate merged report notification email content
     */
    generateMergedReportNotificationEmail({
        recipientName,
        recipientOrganization,
        mergedReportDetails,
        policyId
    }) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Dual Survey Reports Merged</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h1 style="margin: 0; font-size: 24px;">✅ Reports Successfully Merged</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your dual survey assignment is complete</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #495057; margin-top: 0;">Hello ${recipientName},</h2>
                        <p>The dual survey reports have been successfully merged and are now available for review.</p>
                        
                        <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h3 style="margin-top: 0; color: #28a745;">Merged Report Details</h3>
                            <p><strong>Policy ID:</strong> ${policyId}</p>
                            <p><strong>Merged At:</strong> ${new Date().toLocaleString()}</p>
                            <p><strong>Your Organization:</strong> ${recipientOrganization}</p>
                            ${mergedReportDetails.conflictDetected ? `
                            <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 10px; border-radius: 4px; margin: 10px 0;">
                                <strong>⚠️ Conflicts Detected:</strong> Some discrepancies were found between the reports. Please review the merged report for details.
                            </div>
                            ` : `
                            <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 10px; border-radius: 4px; margin: 10px 0;">
                                <strong>✅ No Conflicts:</strong> Both reports are in agreement.
                            </div>
                            `}
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL}/surveyor/dashboard/reports/${mergedReportDetails.id}" 
                               style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
                                View Merged Report
                            </a>
                            <a href="${process.env.FRONTEND_URL}/surveyor/dashboard/assignments" 
                               style="background: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                Back to Dashboard
                            </a>
                        </div>
                    </div>
                    
                    <div style="text-align: center; color: #6c757d; font-size: 14px;">
                        <p>This is an automated notification from the Dual Surveyor System.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Generate user report ready notification email content
     */
    generateUserReportReadyNotificationEmail({
        recipientName,
        mergedReportDetails,
        policyId
    }) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Your Property Survey Report is Ready</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #007bff 0%, #6610f2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h1 style="margin: 0; font-size: 24px;">📋 Your Survey Report is Ready</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Comprehensive dual-surveyor assessment completed</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #495057; margin-top: 0;">Hello ${recipientName},</h2>
                        <p>Great news! Your property survey has been completed by both AMMC and NIA surveyors, and the comprehensive merged report is now available.</p>
                        
                        <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h3 style="margin-top: 0; color: #007bff;">Report Summary</h3>
                            <p><strong>Policy ID:</strong> ${policyId}</p>
                            <p><strong>Survey Type:</strong> Dual-Surveyor Assessment</p>
                            <p><strong>Completed:</strong> ${new Date().toLocaleString()}</p>
                            <p><strong>Organizations:</strong> AMMC & Nigerian Insurers Association (NIA)</p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL}/user/dashboard/policies/${policyId}" 
                               style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                View Your Report
                            </a>
                        </div>
                        
                        <div style="background: #e7f3ff; border: 1px solid #b8daff; color: #004085; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h4 style="margin-top: 0;">What's Next?</h4>
                            <p>• Review your comprehensive survey report</p>
                            <p>• Check the payment decision status</p>
                            <p>• Contact us if you have any questions about the findings</p>
                        </div>
                    </div>
                    
                    <div style="text-align: center; color: #6c757d; font-size: 14px;">
                        <p>Thank you for choosing our dual-surveyor assessment service.</p>
                        <p>If you have any questions, please contact our support team.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Send email notification
     */
    async sendEmail({ to, subject, html }) {
        try {
            const mailOptions = {
                from: `"Dual Surveyor System" <${process.env.SMTP_USER}>`,
                to,
                subject,
                html
            };

            const result = await this.getTransporter().sendMail(mailOptions);
            console.log('Email sent successfully:', result.messageId);
            return result;
        } catch (error) {
            console.error('Failed to send email:', error);
            throw error;
        }
    }
}

module.exports = new DualSurveyorNotificationService();
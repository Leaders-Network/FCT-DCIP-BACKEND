require('dotenv').config();
const nodemailer = require("nodemailer");

// Create reusable transporter object using the default SMTP transport
const createTransporter = () => {
    if (process.env.NODE_ENV === 'production') {
        // Production email configuration
        return nodemailer.createTransporter({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    } else {
        // Development/test configuration using Ethereal
        return new Promise((resolve, reject) => {
            nodemailer.createTestAccount((err, account) => {
                if (err) {
                    console.error('Failed to create a testing account. ' + err.message);
                    reject(err);
                    return;
                }

                const transporter = nodemailer.createTransporter({
                    host: account.smtp.host,
                    port: account.smtp.port,
                    secure: account.smtp.secure,
                    auth: {
                        user: account.user,
                        pass: account.pass
                    }
                });

                resolve(transporter);
            });
        });
    }
};

// Generic email sending function
const sendEmail = async (to, subject, htmlContent, textContent = null) => {
    try {
        let transporter;

        if (process.env.NODE_ENV === 'production') {
            transporter = createTransporter();
        } else {
            transporter = await createTransporter();
        }

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM || 'DCIP System'}" <${process.env.EMAIL || 'noreply@dcip.gov.ng'}>`,
            to: to,
            subject: subject,
            html: htmlContent,
            text: textContent || htmlContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
        };

        const info = await transporter.sendMail(mailOptions);

        console.log('Email sent successfully:', info.messageId);
        if (process.env.NODE_ENV !== 'production') {
            console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
        }

        return {
            success: true,
            messageId: info.messageId,
            previewUrl: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : null
        };

    } catch (error) {
        console.error('Error sending email:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Specific email templates for conflict management
const sendConflictInquiryNotification = async (adminEmail, inquiry) => {
    const subject = `New User Conflict Inquiry - ${inquiry.referenceId}`;
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">New Conflict Inquiry Submitted</h2>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #e74c3c; margin-top: 0;">Inquiry Details</h3>
                <p><strong>Reference ID:</strong> ${inquiry.referenceId}</p>
                <p><strong>Conflict Type:</strong> ${inquiry.conflictType}</p>
                <p><strong>Urgency:</strong> ${inquiry.urgency}</p>
                <p><strong>Policy ID:</strong> ${inquiry.policyId}</p>
                <p><strong>Submitted:</strong> ${new Date(inquiry.createdAt).toLocaleString()}</p>
            </div>

            <div style="background-color: #e8f4f8; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #2980b9; margin-top: 0;">User Contact Information</h3>
                <p><strong>Email:</strong> ${inquiry.userContact.email}</p>
                <p><strong>Phone:</strong> ${inquiry.userContact.phone || 'Not provided'}</p>
                <p><strong>Preferred Contact:</strong> ${inquiry.contactPreference}</p>
                <p><strong>Preferred Time:</strong> ${inquiry.userContact.preferredTime || 'Not specified'}</p>
            </div>

            <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #856404; margin-top: 0;">Description</h3>
                <p style="white-space: pre-wrap;">${inquiry.description}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <p>Please log into the admin dashboard to respond to this inquiry.</p>
                <a href="${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'}" 
                   style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                   View in Dashboard
                </a>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 12px; text-align: center;">
                This is an automated notification from the DCIP Survey System.
            </p>
        </div>
    `;

    return await sendEmail(adminEmail, subject, htmlContent);
};

const sendConflictInquiryResponse = async (userEmail, inquiry, response) => {
    const subject = `Response to Your Conflict Inquiry - ${inquiry.referenceId}`;
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Response to Your Survey Inquiry</h2>
            
            <p>Dear User,</p>
            <p>Thank you for your inquiry regarding your survey report. We have reviewed your concerns and are providing the following response:</p>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Reference ID:</strong> ${inquiry.referenceId}</p>
                <p><strong>Original Inquiry:</strong> ${inquiry.conflictType}</p>
                <p><strong>Response Date:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                <h3 style="color: #155724; margin-top: 0;">Our Response</h3>
                <p style="white-space: pre-wrap;">${response}</p>
            </div>

            <p>If you have any additional questions or concerns, please don't hesitate to contact us using the same reference ID.</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.USER_DASHBOARD_URL || 'http://localhost:3000/dashboard'}" 
                   style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                   View Your Dashboard
                </a>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 12px; text-align: center;">
                Best regards,<br>
                Survey Administration Team<br>
                DCIP Survey System
            </p>
        </div>
    `;

    return await sendEmail(userEmail, subject, htmlContent);
};

const sendAutomaticConflictAlert = async (adminEmail, conflictFlag) => {
    const subject = `Automatic Conflict Detected - ${conflictFlag.conflictType.toUpperCase()}`;
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">⚠️ Automatic Conflict Detected</h2>
            
            <p>An automatic conflict has been detected in a merged survey report and requires your attention.</p>

            <div style="background-color: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
                <h3 style="color: #721c24; margin-top: 0;">Conflict Details</h3>
                <p><strong>Conflict ID:</strong> ${conflictFlag._id}</p>
                <p><strong>Policy ID:</strong> ${conflictFlag.policyId}</p>
                <p><strong>Conflict Type:</strong> ${conflictFlag.conflictType}</p>
                <p><strong>Severity:</strong> ${conflictFlag.conflictSeverity.toUpperCase()}</p>
                <p><strong>Priority:</strong> ${conflictFlag.priority.toUpperCase()}</p>
                <p><strong>Detected:</strong> ${new Date(conflictFlag.detectionMetadata.detectedAt).toLocaleString()}</p>
            </div>

            <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #856404; margin-top: 0;">Recommendations Comparison</h3>
                <p><strong>AMMC Recommendation:</strong> ${conflictFlag.ammcRecommendation}</p>
                <p><strong>NIA Recommendation:</strong> ${conflictFlag.niaRecommendation}</p>
                ${conflictFlag.discrepancyPercentage ? `<p><strong>Value Discrepancy:</strong> ${conflictFlag.discrepancyPercentage}%</p>` : ''}
            </div>

            ${conflictFlag.flaggedSections && conflictFlag.flaggedSections.length > 0 ? `
            <div style="background-color: #e2e3e5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #383d41; margin-top: 0;">Flagged Sections</h3>
                <p><strong>Number of flagged sections:</strong> ${conflictFlag.flaggedSections.length}</p>
            </div>
            ` : ''}

            <div style="background-color: #d1ecf1; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #0c5460; margin-top: 0;">Detection Metadata</h3>
                <p><strong>Confidence Score:</strong> ${conflictFlag.detectionMetadata.confidenceScore}%</p>
                <p><strong>Algorithm Version:</strong> ${conflictFlag.detectionMetadata.detectionAlgorithm}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <p><strong>Action Required:</strong> Please review this conflict in the admin dashboard and take appropriate action.</p>
                <a href="${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3000/admin'}/conflict-flags/${conflictFlag._id}" 
                   style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                   Review Conflict
                </a>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 12px; text-align: center;">
                This is an automated alert from the DCIP Survey System's conflict detection engine.
            </p>
        </div>
    `;

    return await sendEmail(adminEmail, subject, htmlContent);
};

const sendConflictResolutionNotification = async (userEmail, conflictFlag) => {
    const subject = `Survey Report Conflict Resolved`;
    const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #28a745;">✅ Survey Report Conflict Resolved</h2>
            
            <p>Good news! The conflict detected in your survey report has been resolved.</p>

            <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                <h3 style="color: #155724; margin-top: 0;">Resolution Details</h3>
                <p><strong>Policy ID:</strong> ${conflictFlag.policyId}</p>
                <p><strong>Conflict Type:</strong> ${conflictFlag.conflictType}</p>
                <p><strong>Resolution Method:</strong> ${conflictFlag.resolutionDetails.resolutionMethod}</p>
                <p><strong>Resolved Date:</strong> ${new Date(conflictFlag.resolutionDetails.resolvedAt).toLocaleString()}</p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #495057; margin-top: 0;">Resolution Notes</h3>
                <p style="white-space: pre-wrap;">${conflictFlag.resolutionDetails.resolutionNotes}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <p>Your report is now available for review in your dashboard.</p>
                <a href="${process.env.USER_DASHBOARD_URL || 'http://localhost:3000/dashboard'}" 
                   style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                   View Your Report
                </a>
            </div>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 12px; text-align: center;">
                Thank you for your patience while we resolved this matter.<br>
                DCIP Survey System
            </p>
        </div>
    `;

    return await sendEmail(userEmail, subject, htmlContent);
};

module.exports = {
    sendEmail,
    sendConflictInquiryNotification,
    sendConflictInquiryResponse,
    sendAutomaticConflictAlert,
    sendConflictResolutionNotification
};
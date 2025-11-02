const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
    return nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

/**
 * Send automatic conflict alert to admins
 */
const sendAutomaticConflictAlert = async (adminEmail, conflictFlag) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: adminEmail,
            subject: `🚨 Automatic Conflict Detected - ${conflictFlag.conflictType}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #dc3545; margin: 0;">🚨 Automatic Conflict Detected</h2>
                        <p style="margin: 10px 0 0 0; color: #6c757d;">
                            A conflict has been automatically detected during report merging
                        </p>
                    </div>
                    
                    <div style="background: white; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
                        <h3 style="color: #495057; margin-top: 0;">Conflict Details</h3>
                        
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Policy ID:</td>
                                <td style="padding: 8px 0;">${conflictFlag.policyId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Conflict Type:</td>
                                <td style="padding: 8px 0;">
                                    <span style="background: #ffc107; color: #212529; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                                        ${conflictFlag.conflictType.toUpperCase()}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Severity:</td>
                                <td style="padding: 8px 0;">
                                    <span style="background: ${getSeverityColor(conflictFlag.conflictSeverity)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                                        ${conflictFlag.conflictSeverity.toUpperCase()}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">AMMC Value:</td>
                                <td style="padding: 8px 0;">${formatValue(conflictFlag.ammcRecommendation)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">NIA Value:</td>
                                <td style="padding: 8px 0;">${formatValue(conflictFlag.niaRecommendation)}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Description:</td>
                                <td style="padding: 8px 0;">${conflictFlag.conflictDescription}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Detected At:</td>
                                <td style="padding: 8px 0;">${new Date(conflictFlag.detectionMetadata.detectedAt).toLocaleString()}</td>
                            </tr>
                        </table>
                        
                        <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #495057;">Next Steps</h4>
                            <ul style="margin: 0; padding-left: 20px; color: #6c757d;">
                                <li>Review the conflicting values from both surveyors</li>
                                <li>Contact surveyors for clarification if needed</li>
                                <li>Make a manual decision on the final recommendation</li>
                                <li>Update the merged report with the resolved values</li>
                            </ul>
                        </div>
                        
                        <div style="margin-top: 20px; text-align: center;">
                            <a href="${process.env.FRONTEND_URL}/admin/conflicts/${conflictFlag._id}" 
                               style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
                                Review Conflict
                            </a>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; text-align: center; color: #6c757d; font-size: 12px;">
                        <p>This is an automated notification from the FCT-DCIP System</p>
                        <p>Please do not reply to this email</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Conflict alert sent to ${adminEmail}`);

    } catch (error) {
        console.error(`❌ Failed to send conflict alert to ${adminEmail}:`, error);
        throw error;
    }
};

/**
 * Send report merging completion notification
 */
const sendReportMergingNotification = async (adminEmail, mergedReport) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: adminEmail,
            subject: `📊 Report Merging Completed - ${mergedReport.releaseStatus.toUpperCase()}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #28a745; margin: 0;">📊 Report Merging Completed</h2>
                        <p style="margin: 10px 0 0 0; color: #6c757d;">
                            Dual surveyor reports have been automatically merged
                        </p>
                    </div>
                    
                    <div style="background: white; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
                        <h3 style="color: #495057; margin-top: 0;">Merge Summary</h3>
                        
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Policy ID:</td>
                                <td style="padding: 8px 0;">${mergedReport.policyId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Release Status:</td>
                                <td style="padding: 8px 0;">
                                    <span style="background: ${getReleaseStatusColor(mergedReport.releaseStatus)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                                        ${mergedReport.releaseStatus.toUpperCase()}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Final Recommendation:</td>
                                <td style="padding: 8px 0;">
                                    <span style="background: ${getRecommendationColor(mergedReport.finalRecommendation)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                                        ${mergedReport.finalRecommendation.toUpperCase()}
                                    </span>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Confidence Score:</td>
                                <td style="padding: 8px 0;">${mergedReport.confidenceScore}%</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Conflicts Detected:</td>
                                <td style="padding: 8px 0;">${mergedReport.conflictDetected ? 'Yes' : 'No'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Processing Time:</td>
                                <td style="padding: 8px 0;">${mergedReport.mergingMetadata?.processingTime || 'N/A'}ms</td>
                            </tr>
                        </table>
                        
                        ${mergedReport.conflictDetected ? `
                        <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #856404;">⚠️ Conflicts Detected</h4>
                            <p style="margin: 0; color: #856404;">
                                This report contains conflicts that may require manual review.
                                Please check the conflict flags for detailed information.
                            </p>
                        </div>
                        ` : ''}
                        
                        <div style="margin-top: 20px; text-align: center;">
                            <a href="${process.env.FRONTEND_URL}/admin/merged-reports/${mergedReport._id}" 
                               style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
                                View Merged Report
                            </a>
                        </div>
                    </div>
                    
                    <div style="margin-top: 20px; text-align: center; color: #6c757d; font-size: 12px;">
                        <p>This is an automated notification from the FCT-DCIP System</p>
                        <p>Please do not reply to this email</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Report merging notification sent to ${adminEmail}`);

    } catch (error) {
        console.error(`❌ Failed to send report merging notification to ${adminEmail}:`, error);
        throw error;
    }
};

// Helper functions
const getSeverityColor = (severity) => {
    switch (severity) {
        case 'critical': return '#dc3545';
        case 'high': return '#fd7e14';
        case 'medium': return '#ffc107';
        case 'low': return '#28a745';
        default: return '#6c757d';
    }
};

const getReleaseStatusColor = (status) => {
    switch (status) {
        case 'approved': return '#28a745';
        case 'pending': return '#ffc107';
        case 'withheld': return '#dc3545';
        case 'archived': return '#6c757d';
        default: return '#6c757d';
    }
};

const getRecommendationColor = (recommendation) => {
    switch (recommendation) {
        case 'approve': return '#28a745';
        case 'conditional': return '#ffc107';
        case 'reject': return '#dc3545';
        default: return '#6c757d';
    }
};

const formatValue = (value) => {
    if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
    }
    return String(value);
};

module.exports = {
    sendAutomaticConflictAlert,
    sendReportMergingNotification
};
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

/**
 * Send payment decision notification to user
 */
const sendPaymentDecisionNotification = async (userEmail, decisionData) => {
    try {
        const transporter = createTransporter();

        const getDecisionColor = (decision) => {
            switch (decision) {
                case 'approve': return '#28a745';
                case 'conditional': return '#ffc107';
                case 'reject': return '#dc3545';
                case 'request_more_info': return '#17a2b8';
                default: return '#6c757d';
            }
        };

        const getDecisionTitle = (decision) => {
            switch (decision) {
                case 'approve': return '✅ Payment Approved';
                case 'conditional': return '⚠️ Conditional Approval';
                case 'reject': return '❌ Payment Rejected';
                case 'request_more_info': return '📋 Additional Information Required';
                default: return '📄 Payment Decision';
            }
        };

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: userEmail,
            subject: `${getDecisionTitle(decisionData.decision)} - Policy ${decisionData.policyId}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: ${getDecisionColor(decisionData.decision)}; margin: 0;">
                            ${getDecisionTitle(decisionData.decision)}
                        </h2>
                        <p style="margin: 10px 0 0 0; color: #6c757d;">
                            Your insurance policy payment decision is ready
                        </p>
                    </div>
                    
                    <div style="background: white; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
                        <h3 style="color: #495057; margin-top: 0;">Decision Details</h3>
                        
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Policy ID:</td>
                                <td style="padding: 8px 0;">${decisionData.policyId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Decision:</td>
                                <td style="padding: 8px 0;">
                                    <span style="background: ${getDecisionColor(decisionData.decision)}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                                        ${decisionData.decision.toUpperCase().replace('_', ' ')}
                                    </span>
                                </td>
                            </tr>
                        </table>

                        ${decisionData.reasoning && decisionData.reasoning.length > 0 ? `
                        <div style="margin-top: 20px;">
                            <h4 style="color: #495057; margin-bottom: 10px;">Reasoning</h4>
                            <ul style="margin: 0; padding-left: 20px; color: #6c757d;">
                                ${decisionData.reasoning.map(reason => `<li>${reason}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}

                        ${decisionData.conditions && decisionData.conditions.length > 0 ? `
                        <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #856404;">Conditions</h4>
                            <ul style="margin: 0; padding-left: 20px; color: #856404;">
                                ${decisionData.conditions.map(condition => `<li>${condition}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}

                        ${decisionData.requiredActions && decisionData.requiredActions.length > 0 ? `
                        <div style="margin-top: 20px; padding: 15px; background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #0c5460;">Required Actions</h4>
                            <ul style="margin: 0; padding-left: 20px; color: #0c5460;">
                                ${decisionData.requiredActions.map(action => `<li>${action}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}
                        
                        <div style="margin-top: 20px; text-align: center;">
                            <a href="${process.env.FRONTEND_URL}/dashboard/policies" 
                               style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
                                View Policy Details
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
        console.log(`✅ Payment decision notification sent to ${userEmail}`);

    } catch (error) {
        console.error(`❌ Failed to send payment decision notification to ${userEmail}:`, error);
        throw error;
    }
};

/**
 * Send report available notification to user
 */
const sendReportAvailableNotification = async (userEmail, reportData) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: userEmail,
            subject: `📊 Your Property Assessment Report is Ready - Policy ${reportData.policyId}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #28a745; margin: 0;">📊 Report Ready for Download</h2>
                        <p style="margin: 10px 0 0 0; color: #6c757d;">
                            Your property assessment has been completed
                        </p>
                    </div>
                    
                    <div style="background: white; padding: 20px; border: 1px solid #dee2e6; border-radius: 8px;">
                        <h3 style="color: #495057; margin-top: 0;">Report Summary</h3>
                        
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Policy ID:</td>
                                <td style="padding: 8px 0;">${reportData.policyId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Report ID:</td>
                                <td style="padding: 8px 0;">${reportData.reportId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; color: #495057;">Payment Status:</td>
                                <td style="padding: 8px 0;">
                                    <span style="background: ${reportData.paymentEnabled ? '#28a745' : '#ffc107'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                                        ${reportData.paymentEnabled ? 'ENABLED' : 'PENDING'}
                                    </span>
                                </td>
                            </tr>
                        </table>

                        <div style="margin-top: 20px; padding: 15px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px;">
                            <h4 style="margin: 0 0 10px 0; color: #155724;">✅ Assessment Complete</h4>
                            <p style="margin: 0; color: #155724;">
                                Both AMMC and NIA surveyors have completed their assessments. 
                                The reports have been automatically merged and are ready for your review.
                            </p>
                        </div>
                        
                        <div style="margin-top: 20px; text-align: center;">
                            <a href="${process.env.FRONTEND_URL}/dashboard/policies" 
                               style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
                                Download Report
                            </a>
                        </div>

                        ${!reportData.paymentEnabled ? `
                        <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px;">
                            <p style="margin: 0; color: #856404; text-align: center; font-size: 14px;">
                                <strong>Note:</strong> Payment processing is pending additional review. 
                                You can still download and review your assessment report.
                            </p>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="margin-top: 20px; text-align: center; color: #6c757d; font-size: 12px;">
                        <p>This is an automated notification from the FCT-DCIP System</p>
                        <p>Please do not reply to this email</p>
                    </div>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Report available notification sent to ${userEmail}`);

    } catch (error) {
        console.error(`❌ Failed to send report available notification to ${userEmail}:`, error);
        throw error;
    }
};

module.exports = {
    sendAutomaticConflictAlert,
    sendReportMergingNotification,
    sendPaymentDecisionNotification,
    sendReportAvailableNotification
};
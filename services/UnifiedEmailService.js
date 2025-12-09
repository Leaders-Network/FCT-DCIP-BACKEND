require('dotenv').config();
const nodemailer = require('nodemailer');

/**
 * Unified Email Service
 * Centralized email handling for the entire application
 */
class UnifiedEmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
    }

    /**
     * Initialize and verify SMTP connection
     */
    async initialize() {
        if (this.isConfigured) return;

        try {
            console.log('📧 Initializing Email Service...');
            console.log(`   Host: ${process.env.SMTP_HOST}`);
            console.log(`   Port: ${process.env.SMTP_PORT}`);
            console.log(`   User: ${process.env.EMAIL}`);

            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.EMAIL,
                    pass: process.env.EMAIL_PASSWORD,
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            // Verify connection
            await this.transporter.verify();
            this.isConfigured = true;
            console.log('✅ Email Service initialized successfully\n');
        } catch (error) {
            console.error('❌ Email Service initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Generic send email method
     */
    async sendEmail({ to, subject, html, text }) {
        try {
            await this.initialize();

            const mailOptions = {
                from: `"${process.env.EMAIL_FROM || 'FCT-DCIP'}" <${process.env.EMAIL}>`,
                to,
                subject,
                html,
                text: text || html.replace(/<[^>]*>/g, '') // Strip HTML if no text provided
            };

            console.log('📤 Attempting to send email...');
            console.log(`   From: ${mailOptions.from}`);
            console.log(`   To: ${to}`);
            console.log(`   Subject: ${subject}`);

            const info = await this.transporter.sendMail(mailOptions);

            console.log('✅ Email sent successfully!');
            console.log(`   Message ID: ${info.messageId}`);
            console.log(`   Response: ${info.response}`);
            console.log(`   Accepted: ${info.accepted?.join(', ')}`);
            console.log(`   Rejected: ${info.rejected?.join(', ') || 'None'}`);
            console.log(`   Pending: ${info.pending?.join(', ') || 'None'}`);

            // Check if email was actually accepted
            if (info.rejected && info.rejected.length > 0) {
                console.error('⚠️ WARNING: Email was rejected by server!');
                console.error(`   Rejected addresses: ${info.rejected.join(', ')}`);
            }

            if (!info.accepted || info.accepted.length === 0) {
                console.error('⚠️ WARNING: No addresses were accepted!');
            }

            console.log('');

            return {
                success: true,
                messageId: info.messageId,
                accepted: info.accepted,
                rejected: info.rejected,
                response: info.response
            };
        } catch (error) {
            console.error('❌ Email send failed!');
            console.error(`   Error: ${error.message}`);
            console.error(`   Code: ${error.code}`);
            console.error(`   Command: ${error.command}`);
            if (error.response) {
                console.error(`   SMTP Response: ${error.response}`);
            }
            console.error('');
            throw error;
        }
    }

    /**
     * Send OTP verification email
     */
    async sendOTPEmail(email, otp) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #028835 0%, #026a29 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
                    .otp-box { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 25px 0; border: 2px dashed #028835; }
                    .otp-code { font-size: 32px; font-weight: bold; color: #028835; letter-spacing: 8px; font-family: 'Courier New', monospace; }
                    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0;">🔐 Email Verification</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">FCT-DCIP Platform</p>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>You requested to verify your email address. Please use the following One-Time Password (OTP) to complete your verification:</p>
                        
                        <div class="otp-box">
                            <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your OTP Code</p>
                            <div class="otp-code">${otp}</div>
                            <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">Valid for 10 minutes</p>
                        </div>

                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong>
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Never share this OTP with anyone</li>
                                <li>This code expires in 10 minutes</li>
                                <li>If you didn't request this, please ignore this email</li>
                            </ul>
                        </div>

                        <p>If you have any questions, please contact our support team.</p>
                        <p>Best regards,<br><strong>FCT-DCIP Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message. Please do not reply to this email.</p>
                        <p>&copy; ${new Date().getFullYear()} FCT-DCIP. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: email,
            subject: '🔐 Your OTP Code - FCT-DCIP',
            html
        });
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email, resetLink) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #028835 0%, #026a29 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
                    .button { display: inline-block; padding: 15px 30px; background: #028835; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0;">🔑 Password Reset</h1>
                    </div>
                    <div class="content">
                        <p>Hello,</p>
                        <p>You requested to reset your password. Click the button below to create a new password:</p>
                        <center>
                            <a href="${resetLink}" class="button">Reset Password</a>
                        </center>
                        <p style="color: #666; font-size: 14px;">Or copy this link: <br><a href="${resetLink}">${resetLink}</a></p>
                        <p style="color: #999; font-size: 12px;">This link expires in 1 hour.</p>
                        <p>If you didn't request this, please ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} FCT-DCIP. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: email,
            subject: '🔑 Reset Your Password - FCT-DCIP',
            html
        });
    }

    /**
     * Send surveyor credentials email
     */
    async sendSurveyorCredentials(email, firstname, lastname, password, loginUrl) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #028835 0%, #026a29 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
                    .credentials-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #028835; }
                    .credential-item { margin: 10px 0; }
                    .credential-label { font-weight: bold; color: #555; }
                    .credential-value { font-family: 'Courier New', monospace; background: white; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 5px; }
                    .button { display: inline-block; padding: 15px 30px; background: #028835; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0;">👤 Welcome to FCT-DCIP</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Surveyor Account Created</p>
                    </div>
                    <div class="content">
                        <p>Dear ${firstname} ${lastname},</p>
                        <p>Your surveyor account has been successfully created. You can now access the surveyor portal.</p>
                        
                        <div class="credentials-box">
                            <h3 style="margin: 0 0 15px 0;">📋 Your Login Credentials</h3>
                            <div class="credential-item">
                                <div class="credential-label">Email:</div>
                                <div class="credential-value">${email}</div>
                            </div>
                            <div class="credential-item">
                                <div class="credential-label">Password:</div>
                                <div class="credential-value">${password}</div>
                            </div>
                            <div class="credential-item">
                                <div class="credential-label">Login URL:</div>
                                <div class="credential-value">${loginUrl}</div>
                            </div>
                        </div>

                        <center>
                            <a href="${loginUrl}" class="button">Login to Portal</a>
                        </center>

                        <p style="background: #fff3cd; padding: 15px; border-radius: 5px; font-size: 14px;">
                            <strong>⚠️ Security:</strong> Please change your password after first login.
                        </p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} FCT-DCIP. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: email,
            subject: '👤 Your Surveyor Account Credentials - FCT-DCIP',
            html
        });
    }

    /**
     * Send NIA admin credentials email
     */
    async sendNIAAdminCredentials(email, firstname, lastname, password, loginUrl) {
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
                    .credentials-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea; }
                    .credential-value { font-family: 'Courier New', monospace; background: white; padding: 8px 12px; border-radius: 4px; display: block; margin-top: 5px; }
                    .button { display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0;">🔐 Welcome to NIA Admin</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Nigerian Insurers Association</p>
                    </div>
                    <div class="content">
                        <p>Hello <strong>${firstname} ${lastname}</strong>,</p>
                        <p>Your NIA administrator account has been successfully created.</p>
                        
                        <div class="credentials-box">
                            <h3 style="margin: 0 0 15px 0;">📋 Your Login Credentials</h3>
                            <table style="width: 100%;">
                                <tr>
                                    <td style="padding: 10px 0; font-weight: bold; width: 100px;">Email:</td>
                                    <td><div class="credential-value">${email}</div></td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; font-weight: bold;">Password:</td>
                                    <td><div class="credential-value">${password}</div></td>
                                </tr>
                            </table>
                        </div>

                        <center>
                            <a href="${loginUrl}" class="button">🚀 Login to NIA Admin Dashboard</a>
                        </center>

                        <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 25px 0;">
                            <h4 style="margin: 0 0 10px 0; color: #0c5460;">📚 Your Permissions</h4>
                            <ul style="margin: 0; padding-left: 20px; color: #0c5460;">
                                <li>Manage NIA Surveyors</li>
                                <li>Create and Assign Dual Assignments</li>
                                <li>View and Review Reports</li>
                                <li>Monitor Processing Status</li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Nigerian Insurers Association (NIA)</p>
                        <p>&copy; ${new Date().getFullYear()} FCT-DCIP. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: email,
            subject: '🔐 Your NIA Admin Account Credentials',
            html
        });
    }

    /**
     * Send broker admin credentials email
     */
    async sendBrokerAdminCredentials(brokerAdminData) {
        const { email, firstname, lastname, password, brokerFirmName, brokerFirmLicense } = brokerAdminData;
        const loginUrl = process.env.FRONTEND_URL
            ? `${process.env.FRONTEND_URL}/broker-admin/login`
            : 'http://localhost:3000/broker-admin/login';

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
                    .credentials-box { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563eb; }
                    .credential-value { font-family: 'Courier New', monospace; background: #e5e7eb; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 5px; }
                    .button { display: inline-block; padding: 15px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin: 0;">Welcome to Broker Portal</h1>
                    </div>
                    <div class="content">
                        <p>Dear ${firstname} ${lastname},</p>
                        <p>Your Broker Administrator account has been successfully created for <strong>${brokerFirmName}</strong>.</p>
                        
                        <div class="credentials-box">
                            <h3 style="margin-top: 0;">Your Login Credentials</h3>
                            <div style="margin: 10px 0;">
                                <div style="font-weight: bold;">Email:</div>
                                <div class="credential-value">${email}</div>
                            </div>
                            <div style="margin: 10px 0;">
                                <div style="font-weight: bold;">Password:</div>
                                <div class="credential-value">${password}</div>
                            </div>
                        </div>

                        <div style="background: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <strong>⚠️ Security Notice:</strong>
                            <ul style="margin: 10px 0;">
                                <li>Keep your password secure</li>
                                <li>Change your password after first login</li>
                            </ul>
                        </div>

                        <h3>Broker Firm Details</h3>
                        <p><strong>Firm Name:</strong> ${brokerFirmName}<br>
                        <strong>License Number:</strong> ${brokerFirmLicense}</p>

                        <center>
                            <a href="${loginUrl}" class="button">Login to Your Account</a>
                        </center>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} FCT-DCIP. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail({
            to: email,
            subject: 'Your Broker Admin Account Credentials',
            html
        });
    }
}

// Export singleton instance
module.exports = new UnifiedEmailService();

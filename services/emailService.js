const nodemailer = require('nodemailer');

// Create reusable transporter using Ethereal for testing
const createTransporter = async () => {
    // Generate test SMTP service account from ethereal.email
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: testAccount.user,
            pass: testAccount.pass,
        },
    });

    return { transporter, testAccount };
};

// Send broker admin credentials email
const sendBrokerAdminCredentials = async (brokerAdminData) => {
    try {
        const { transporter, testAccount } = await createTransporter();

        const { email, firstname, lastname, password, brokerFirmName, brokerFirmLicense } = brokerAdminData;

        const mailOptions = {
            from: '"Builders-Liability-AMMC Admin" <noreply@Builders-Liability-AMMC.gov.ng>',
            to: email,
            subject: 'Your Broker Admin Account Credentials - Builders-Liability-AMMC',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                        }
                        .container {
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                            background-color: #f9f9f9;
                        }
                        .header {
                            background-color: #2563eb;
                            color: white;
                            padding: 20px;
                            text-align: center;
                            border-radius: 5px 5px 0 0;
                        }
                        .content {
                            background-color: white;
                            padding: 30px;
                            border-radius: 0 0 5px 5px;
                        }
                        .credentials-box {
                            background-color: #f3f4f6;
                            border-left: 4px solid #2563eb;
                            padding: 15px;
                            margin: 20px 0;
                        }
                        .credential-item {
                            margin: 10px 0;
                        }
                        .credential-label {
                            font-weight: bold;
                            color: #1f2937;
                        }
                        .credential-value {
                            font-family: 'Courier New', monospace;
                            background-color: #e5e7eb;
                            padding: 5px 10px;
                            border-radius: 3px;
                            display: inline-block;
                            margin-top: 5px;
                        }
                        .warning {
                            background-color: #fef3c7;
                            border-left: 4px solid #f59e0b;
                            padding: 15px;
                            margin: 20px 0;
                        }
                        .footer {
                            text-align: center;
                            margin-top: 20px;
                            padding-top: 20px;
                            border-top: 1px solid #e5e7eb;
                            color: #6b7280;
                            font-size: 12px;
                        }
                        .button {
                            display: inline-block;
                            padding: 12px 24px;
                            background-color: #2563eb;
                            color: white;
                            text-decoration: none;
                            border-radius: 5px;
                            margin: 20px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>Welcome to Builders-Liability-AMMC Broker Portal</h1>
                        </div>
                        <div class="content">
                            <p>Dear ${firstname} ${lastname},</p>
                            
                            <p>Your Broker Administrator account has been successfully created for <strong>${brokerFirmName}</strong>.</p>
                            
                            <div class="credentials-box">
                                <h3 style="margin-top: 0;">Your Login Credentials</h3>
                                
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
                                    <div class="credential-value">http://localhost:3000/broker-admin/login</div>
                                </div>
                            </div>
                            
                            <div class="warning">
                                <strong>⚠️ Important Security Notice:</strong>
                                <ul style="margin: 10px 0;">
                                    <li>Please keep your password secure and do not share it with anyone</li>
                                    <li>We recommend changing your password after your first login</li>
                                    <li>This password is unique to your account and cannot be recovered if lost</li>
                                </ul>
                            </div>
                            
                            <h3>Broker Firm Details</h3>
                            <p>
                                <strong>Firm Name:</strong> ${brokerFirmName}<br>
                                <strong>License Number:</strong> ${brokerFirmLicense}
                            </p>
                            
                            <center>
                                <a href="http://localhost:3000/broker-admin/login" class="button">
                                    Login to Your Account
                                </a>
                            </center>
                            
                            <p>If you have any questions or need assistance, please contact the Builders-Liability-AMMC support team.</p>
                            
                            <p>Best regards,<br>
                            <strong>Builders-Liability-AMMC Administration Team</strong></p>
                        </div>
                        <div class="footer">
                            <p>This is an automated message. Please do not reply to this email.</p>
                            <p>&copy; ${new Date().getFullYear()} Builders-Liability-AMMC. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
Welcome to Builders-Liability-AMMC Broker Portal

Dear ${firstname} ${lastname},

Your Broker Administrator account has been successfully created for ${brokerFirmName}.

Your Login Credentials:
-----------------------
Email: ${email}
Password: ${password}
Login URL: http://localhost:3000/broker-admin/login

IMPORTANT SECURITY NOTICE:
- Please keep your password secure and do not share it with anyone
- We recommend changing your password after your first login
- This password is unique to your account and cannot be recovered if lost

Broker Firm Details:
-------------------
Firm Name: ${brokerFirmName}
License Number: ${brokerFirmLicense}

If you have any questions or need assistance, please contact the Builders-Liability-AMMC support team.

Best regards,
Builders-Liability-AMMC Administration Team

---
This is an automated message. Please do not reply to this email.
© ${new Date().getFullYear()} Builders-Liability-AMMC. All rights reserved.
            `
        };

        const info = await transporter.sendMail(mailOptions);

        console.log('✅ Email sent successfully!');
        console.log('📧 Message ID:', info.messageId);
        console.log('🔗 Preview URL:', nodemailer.getTestMessageUrl(info));
        console.log('\n📨 Email Details:');
        console.log(`   To: ${email}`);
        console.log(`   Subject: ${mailOptions.subject}`);
        console.log(`   Ethereal Account: ${testAccount.user}`);
        console.log(`   View email at: ${nodemailer.getTestMessageUrl(info)}\n`);

        return {
            success: true,
            messageId: info.messageId,
            previewUrl: nodemailer.getTestMessageUrl(info),
            etherealUser: testAccount.user
        };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    sendBrokerAdminCredentials
};

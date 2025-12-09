require('dotenv').config();
const nodemailer = require('nodemailer');

/**
 * Email Configuration Diagnostic Tool
 * Run this to test your Gmail SMTP configuration
 */

async function testEmailConfig() {
    console.log('\n🔍 ===== EMAIL CONFIGURATION DIAGNOSTIC =====\n');

    // Step 1: Check environment variables
    console.log('📋 Step 1: Checking Environment Variables');
    console.log(`   SMTP_HOST: ${process.env.SMTP_HOST || '❌ NOT SET'}`);
    console.log(`   SMTP_PORT: ${process.env.SMTP_PORT || '❌ NOT SET'}`);
    console.log(`   EMAIL: ${process.env.EMAIL || '❌ NOT SET'}`);
    console.log(`   EMAIL_PASSWORD: ${process.env.EMAIL_PASSWORD ? '✅ SET (hidden)' : '❌ NOT SET'}`);
    console.log(`   EMAIL_FROM: ${process.env.EMAIL_FROM || '❌ NOT SET'}`);
    console.log('');

    if (!process.env.EMAIL || !process.env.EMAIL_PASSWORD) {
        console.error('❌ ERROR: Email credentials not configured in .env file\n');
        process.exit(1);
    }

    // Step 2: Create transporter
    console.log('📋 Step 2: Creating SMTP Transporter');
    const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD,
        },
        tls: {
            rejectUnauthorized: false
        },
        debug: true, // Enable debug output
        logger: true // Enable logger
    });
    console.log('   ✅ Transporter created\n');

    // Step 3: Verify connection
    console.log('📋 Step 3: Verifying SMTP Connection');
    try {
        await transporter.verify();
        console.log('   ✅ SMTP connection verified successfully!\n');
    } catch (error) {
        console.error('   ❌ SMTP connection failed!');
        console.error(`   Error: ${error.message}`);
        console.error(`   Code: ${error.code}\n`);

        if (error.code === 'EAUTH') {
            console.error('💡 SOLUTION: Authentication failed. This usually means:');
            console.error('   1. The email or password is incorrect');
            console.error('   2. You need to use a Gmail App Password (not your regular password)');
            console.error('   3. Generate one at: https://myaccount.google.com/apppasswords\n');
        }

        process.exit(1);
    }

    // Step 4: Send test email
    console.log('📋 Step 4: Sending Test Email');
    const testEmail = process.env.EMAIL; // Send to yourself

    try {
        const info = await transporter.sendMail({
            from: `""Builders-Liability-AMMC System" <https://fctbuilders.gladfaith.com/>`,
            to: testEmail,
            subject: '✅ Email Configuration Test - SUCCESS',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #028835 0%, #026a29 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0;">✅ Email Test Successful!</h1>
                    </div>
                    <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                        <p>Congratulations! Your email configuration is working correctly.</p>
                        
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin: 0 0 10px 0;">Configuration Details:</h3>
                            <p style="margin: 5px 0;"><strong>SMTP Host:</strong> ${process.env.SMTP_HOST}</p>
                            <p style="margin: 5px 0;"><strong>SMTP Port:</strong> ${process.env.SMTP_PORT}</p>
                            <p style="margin: 5px 0;"><strong>From Email:</strong> ${process.env.EMAIL}</p>
                            <p style="margin: 5px 0;"><strong>Test Time:</strong> ${new Date().toLocaleString()}</p>
                        </div>
                        
                        <p style="color: #028835; font-weight: bold;">✅ Your FCT-DCIP email system is ready to use!</p>
                    </div>
                </div>
            `,
            text: `Email Configuration Test - SUCCESS\n\nYour email configuration is working correctly!\n\nSMTP Host: ${process.env.SMTP_HOST}\nSMTP Port: ${process.env.SMTP_PORT}\nFrom Email: ${process.env.EMAIL}\nTest Time: ${new Date().toLocaleString()}`
        });

        console.log('   ✅ Test email sent successfully!');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Response: ${info.response}`);
        console.log(`   Accepted: ${info.accepted?.join(', ')}`);
        console.log(`   Rejected: ${info.rejected?.join(', ') || 'None'}`);
        console.log('');

        if (info.rejected && info.rejected.length > 0) {
            console.error('⚠️  WARNING: Some addresses were rejected!');
            console.error(`   Rejected: ${info.rejected.join(', ')}\n`);
        }

    } catch (error) {
        console.error('   ❌ Failed to send test email!');
        console.error(`   Error: ${error.message}`);
        console.error(`   Code: ${error.code}`);
        if (error.response) {
            console.error(`   SMTP Response: ${error.response}`);
        }
        console.error('');
        process.exit(1);
    }

    // Success!
    console.log('🎉 ===== ALL TESTS PASSED =====\n');
    console.log('✅ SMTP connection verified');
    console.log('✅ Test email sent successfully');
    console.log(`✅ Check your inbox: ${testEmail}`);
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Check your email inbox (and spam folder)');
    console.log('   2. If you received the test email, your configuration is correct!');
    console.log('   3. If not, check the error messages above');
    console.log('');
    console.log('📚 Common Issues:');
    console.log('   - Using regular password instead of App Password');
    console.log('   - App Password is incorrect or expired');
    console.log('   - Gmail account has 2FA disabled');
    console.log('   - "Less secure app access" is disabled');
    console.log('');
    console.log('🔗 Generate Gmail App Password:');
    console.log('   https://myaccount.google.com/apppasswords');
    console.log('');

    process.exit(0);
}

// Run the test
testEmailConfig().catch(error => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
});

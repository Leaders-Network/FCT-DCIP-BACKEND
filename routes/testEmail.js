const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

// Test email endpoint
router.post('/send-test-email', async (req, res) => {
    try {
        const { to, subject, message } = req.body;

        if (!to) {
            return res.status(400).json({
                success: false,
                message: 'Recipient email is required'
            });
        }

        const result = await emailService.sendEmail({
            to: to,
            subject: subject || 'Test Email from FCT-DCIP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #028835;">Test Email</h2>
                    <p>${message || 'This is a test email from the FCT-DCIP system.'}</p>
                    <p>If you received this email, the email service is working correctly!</p>
                    <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                    <p style="color: #666; font-size: 12px;">
                        Sent at: ${new Date().toLocaleString()}<br>
                        From: FCT-DCIP Email Service
                    </p>
                </div>
            `
        });

        res.json({
            success: true,
            message: 'Test email sent successfully',
            details: result
        });
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test email',
            error: error.message
        });
    }
});

module.exports = router;

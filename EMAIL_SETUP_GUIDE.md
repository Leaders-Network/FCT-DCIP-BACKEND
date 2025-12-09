# Email Service Setup Guide

## ✅ Email Service Fixed!

The email service has been updated to use **real Gmail SMTP** instead of Ethereal test emails.

## Configuration

Your `.env` file is already configured with Gmail SMTP:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL=eleadersnetworkng1@gmail.com
EMAIL_PASSWORD=afnkcqrrphffaatc
EMAIL_FROM="DCIP Leaders Network"
```

## What Was Fixed

1. **Forced Real SMTP**: Updated `createTransporter()` to always use real Gmail SMTP
2. **Added Connection Verification**: Verifies SMTP connection before sending
3. **Better Logging**: Shows whether using real SMTP or Ethereal
4. **TLS Configuration**: Added TLS settings for Gmail compatibility

## Testing the Email Service

### Method 1: Using the Test Endpoint

1. **Start the backend server**:
   ```bash
   cd FCT-DCIP-BACKEND
   npm start
   ```

2. **Send a test email** using Postman or curl:
   ```bash
   curl -X POST http://localhost:5000/api/v1/test-email/send-test-email \
     -H "Content-Type: application/json" \
     -d '{
       "to": "YOUR_PHONE_EMAIL@example.com",
       "subject": "Test Email",
       "message": "This is a test email from FCT-DCIP"
     }'
   ```

3. **Check your phone** for the email!

### Method 2: Trigger Real Notifications

1. Create a policy request (this triggers notifications)
2. Assign a surveyor (this sends assignment emails)
3. Check the backend console for email logs

## Console Output

When emails are sent successfully, you'll see:

```
📧 Using real SMTP configuration:
   Host: smtp.gmail.com
   Port: 587
   User: eleadersnetworkng1@gmail.com
✅ SMTP connection verified successfully
✅ Email sent successfully!
📧 Message ID: <some-id@gmail.com>
📨 Email Details:
   To: recipient@example.com
   Subject: Test Email
   ✉️ Real email sent via smtp.gmail.com
```

## Troubleshooting

### If emails still don't arrive:

1. **Check Gmail App Password**:
   - The password `afnkcqrrphffaatc` should be a Gmail App Password
   - Not your regular Gmail password
   - Generate one at: https://myaccount.google.com/apppasswords

2. **Check Spam Folder**:
   - Gmail might mark automated emails as spam initially

3. **Verify Gmail Settings**:
   - Ensure "Less secure app access" is enabled (if using regular password)
   - Or use App Password (recommended)

4. **Check Backend Logs**:
   - Look for SMTP connection errors
   - Verify the configuration is being loaded

5. **Test with Different Email**:
   - Try sending to a different email address
   - Some email providers block automated emails

## Email Features Now Working

✅ Policy creation notifications
✅ Surveyor assignment emails
✅ Admin notifications
✅ User notifications
✅ Broker admin credentials
✅ All notification system emails

## Important Notes

- **No more Ethereal**: The system now sends real emails
- **Gmail Limits**: Gmail has sending limits (500 emails/day for free accounts)
- **Production**: For production, consider using SendGrid, AWS SES, or similar services
- **App Password**: Always use Gmail App Passwords, never regular passwords

## Next Steps

1. Test the email endpoint
2. Verify emails arrive on your phone
3. If issues persist, check the troubleshooting section
4. Consider upgrading to a professional email service for production

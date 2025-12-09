# Email Not Arriving? Troubleshooting Guide 📧

## Quick Diagnosis

Run this command to test your email configuration:

```bash
cd FCT-DCIP-BACKEND
node test-email-config.js
```

This will:
1. ✅ Check your `.env` configuration
2. ✅ Verify SMTP connection
3. ✅ Send a test email to yourself
4. ✅ Show detailed error messages if something fails

## Common Issues & Solutions

### Issue 1: Using Regular Password Instead of App Password

**Symptom:** `EAUTH` error or "Invalid credentials"

**Solution:**
1. Go to https://myaccount.google.com/apppasswords
2. Sign in to your Gmail account (`ibrahimomobolaji1999@gmail.com`)
3. Click "Generate" under "App passwords"
4. Select "Mail" and "Other (Custom name)"
5. Name it "FCT-DCIP Backend"
6. Copy the 16-character password (e.g., `xhntzxacxhpaiedk`)
7. Update `.env`:
   ```env
   EMAIL_PASSWORD=your-new-app-password-here
   ```
8. Restart your backend server

### Issue 2: 2-Factor Authentication Not Enabled

**Symptom:** Can't access App Passwords page

**Solution:**
1. Go to https://myaccount.google.com/security
2. Enable "2-Step Verification"
3. Complete the setup
4. Then generate App Password (see Issue 1)

### Issue 3: Gmail Blocking Emails

**Symptom:** Email "sent successfully" but never arrives

**Possible Causes:**
- Gmail thinks it's spam
- Recipient's email provider blocking it
- Email quota exceeded (500/day for free Gmail)

**Solutions:**
1. **Check Spam Folder** - Gmail might mark it as spam initially
2. **Send to Different Email** - Try Yahoo, Outlook, or another Gmail
3. **Check Gmail Activity** - Go to https://myaccount.google.com/notifications
4. **Verify Sending Limits** - Free Gmail: 500 emails/day

### Issue 4: Wrong Email in .env

**Symptom:** Console shows different email than expected

**Current Configuration:**
```env
EMAIL=ibrahimomobolaji1999@gmail.com
EMAIL_PASSWORD=xhntzxacxhpaiedk
```

**Solution:**
1. Verify this is the correct Gmail account
2. Verify the App Password belongs to this account
3. If using different account, update both EMAIL and EMAIL_PASSWORD

### Issue 5: Port or Host Issues

**Symptom:** Connection timeout or refused

**Solution:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

Try alternative:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
# Also change secure to true in code
```

## Step-by-Step Email Setup

### 1. Enable 2FA on Gmail
```
https://myaccount.google.com/security
→ 2-Step Verification
→ Turn On
```

### 2. Generate App Password
```
https://myaccount.google.com/apppasswords
→ Select "Mail"
→ Select "Other (Custom name)"
→ Name: "FCT-DCIP Backend"
→ Generate
→ Copy the 16-character password
```

### 3. Update .env
```env
EMAIL=ibrahimomobolaji1999@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # Your app password (remove spaces)
```

### 4. Test Configuration
```bash
node test-email-config.js
```

### 5. Check Email
- Check inbox of `ibrahimomobolaji1999@gmail.com`
- Check spam folder
- Should see "Email Configuration Test - SUCCESS"

## Verification Checklist

- [ ] 2FA enabled on Gmail account
- [ ] App Password generated (not regular password)
- [ ] App Password copied correctly (no spaces)
- [ ] `.env` file updated with correct credentials
- [ ] Backend server restarted after `.env` changes
- [ ] Test script runs successfully
- [ ] Test email received in inbox (or spam)

## Still Not Working?

### Check Gmail Account Status
1. Go to https://mail.google.com
2. Sign in with `ibrahimomobolaji1999@gmail.com`
3. Check for any security alerts
4. Check "Sent" folder for test emails

### Try Different Recipient
```bash
# In test-email-config.js, change:
const testEmail = 'your-other-email@example.com';
```

### Enable Debug Mode
The test script already has debug mode enabled. Check the console output for detailed SMTP conversation.

### Check Firewall/Network
- Ensure port 587 is not blocked
- Try from different network
- Disable VPN if using one

## Alternative: Use Different Email Service

If Gmail continues to have issues, consider:

### SendGrid (Recommended for Production)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
EMAIL=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

### AWS SES
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
EMAIL=your-ses-smtp-username
EMAIL_PASSWORD=your-ses-smtp-password
```

### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
EMAIL=postmaster@your-domain.mailgun.org
EMAIL_PASSWORD=your-mailgun-password
```

## Contact Support

If all else fails:
1. Run `node test-email-config.js`
2. Copy the entire console output
3. Share with your team or support
4. Include any error messages

## Quick Test Commands

```bash
# Test email configuration
node test-email-config.js

# Test OTP email via API
curl -X POST http://localhost:5000/api/v1/auth/request-otp \
  -H "Content-Type: application/json" \
  -H "apikey: your-api-key" \
  -d '{"email": "test@example.com"}'

# Check backend logs
# Look for "✅ Email sent successfully" or error messages
```

## Success Indicators

When everything works, you'll see:
```
✅ Email sent successfully!
   Message ID: <some-id@gmail.com>
   Response: 250 2.0.0 OK
   Accepted: recipient@example.com
   Rejected: None
```

And the recipient will receive a professional HTML email! 🎉

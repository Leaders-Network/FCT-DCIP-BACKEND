# Gmail OAuth2 Setup (More Reliable)

## Why OAuth2?

Gmail App Passwords sometimes get blocked. OAuth2 is more reliable for automated emails.

## Setup Steps

### 1. Enable Gmail API

1. Go to: https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable "Gmail API"
4. Go to "Credentials"
5. Create "OAuth 2.0 Client ID"
6. Application type: "Desktop app"
7. Download the credentials JSON

### 2. Get Refresh Token

Run this script to get your refresh token:

```javascript
// get-gmail-token.js
const { google } = require('googleapis');
const readline = require('readline');

const CLIENT_ID = 'your-client-id';
const CLIENT_SECRET = 'your-client-secret';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://mail.google.com/']
});

console.log('Authorize this app by visiting:', authUrl);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('Enter the code: ', async (code) => {
    const { tokens } = await oAuth2Client.getToken(code);
    console.log('Refresh Token:', tokens.refresh_token);
    rl.close();
});
```

### 3. Update .env

```env
# OAuth2 Configuration
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
EMAIL=ibrahimomobolaji1999@gmail.com
```

### 4. Update Email Service

Use OAuth2 transporter instead of App Password.

## Easier Alternative: Use SendGrid

SendGrid is designed for transactional emails and doesn't have these issues.

### SendGrid Setup (5 minutes)

1. Sign up: https://sendgrid.com (Free: 100 emails/day)
2. Create API Key
3. Update .env:
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
EMAIL=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
EMAIL_FROM="FCT-DCIP <noreply@yourdomain.com>"
```

That's it! SendGrid works immediately, no blocking issues.

# Reset Password System Documentation

## Overview

The new reset password system provides a unified, secure way for both regular users and employees to reset their passwords. It replaces the old fragmented system with a modern, consistent approach.

## Features

✅ **Unified System** - Works for both Users and Employees
✅ **Secure OTP** - 6-digit codes with 10-minute expiry
✅ **Token-based Reset** - Secure reset tokens with 15-minute expiry
✅ **Database Storage** - No in-memory storage, survives server restarts
✅ **Email Integration** - Sends OTP via email
✅ **Modern Frontend** - Step-by-step UI with progress indicators
✅ **Error Handling** - Comprehensive error messages
✅ **Auto-cleanup** - Expired OTPs automatically removed

## API Endpoints

### 1. Send Reset Password OTP
```
POST /api/v1/reset-password/send-otp
```

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset OTP sent to your email successfully",
  "userType": "user" // or "employee"
}
```

### 2. Verify Reset Password OTP
```
POST /api/v1/reset-password/verify-otp
```

**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "resetToken": "abc123...",
  "userType": "user"
}
```

### 3. Reset Password
```
POST /api/v1/reset-password/reset
```

**Request:**
```json
{
  "email": "user@example.com",
  "resetToken": "abc123...",
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "userType": "user"
}
```

### 4. Resend OTP
```
POST /api/v1/reset-password/resend-otp
```

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "New OTP sent to your email successfully",
  "userType": "user"
}
```

## Frontend Flow

### 1. Email Step
- User enters email address
- System checks if email exists in User or Employee collection
- Sends 6-digit OTP to email
- Stores OTP in database with 10-minute expiry

### 2. OTP Verification Step
- User enters 6-digit OTP
- System verifies OTP against database
- Generates secure reset token (15-minute expiry)
- Returns reset token to frontend

### 3. Password Reset Step
- User enters new password and confirmation
- System validates passwords match and meet requirements
- Updates password in appropriate collection (User or Employee)
- Cleans up OTP and reset token records

### 4. Success Step
- Shows success message
- Redirects to login page

## Security Features

### OTP Security
- 6-digit random OTP
- 10-minute expiry time
- Stored in database (not memory)
- Automatically cleaned up on expiry
- One OTP per email (new OTP invalidates old one)

### Reset Token Security
- 32-byte random token
- 15-minute expiry time
- Required for password reset
- Single-use (deleted after use)
- Tied to specific email address

### Password Security
- Minimum 6 characters
- Bcrypt hashing with salt
- Password confirmation required
- Cannot be same as current password (future enhancement)

## Database Schema

### Updated OTP Model
```javascript
{
  email: String,           // User's email
  otp: String,            // 6-digit OTP
  resetToken: String,     // Reset token (after OTP verification)
  resetTokenExpiry: Date, // Reset token expiry
  verified: Boolean,      // OTP verification status
  expiresAt: Date,       // Document expiry (auto-cleanup)
  createdAt: Date        // Creation timestamp
}
```

## Error Handling

### Common Errors
- `Email is required` - Missing email in request
- `No account found with that email address` - Email not in system
- `Invalid or expired OTP` - Wrong OTP or expired
- `OTP has expired. Please request a new one` - OTP timeout
- `Passwords do not match` - Password confirmation mismatch
- `Password must be at least 6 characters long` - Password too short
- `Invalid or expired reset token` - Token issues
- `Reset token has expired. Please start the process again` - Token timeout

## Files Created/Modified

### Backend Files
- ✅ `controllers/resetPassword.js` - New unified controller
- ✅ `routes/resetPassword.js` - New routes
- ✅ `models/Otp.js` - Updated with new fields
- ✅ `app.js` - Added reset password routes

### Frontend Files
- ✅ `app/reset-password/page.tsx` - New unified reset password page
- ✅ `app/login/page.tsx` - New login page with reset link
- ✅ `services/api.ts` - Added new API functions

## Migration from Old System

### Old Endpoints (Deprecated)
- `/auth/send-reset-password-otp` → `/reset-password/send-otp`
- `/auth/verify-otp-employee` → `/reset-password/verify-otp`
- `/auth/employee-reset-password` → `/reset-password/reset`
- `/auth/reset-password-otp` → `/reset-password/send-otp`

### Breaking Changes
- OTP now 6 digits instead of 5
- Reset requires token instead of direct password change
- Unified endpoint for both users and employees
- Different response format

## Testing

### Manual Testing Steps
1. **Send OTP**: Go to `/reset-password`, enter email, click "Send Reset Code"
2. **Check Email**: Verify OTP email is received
3. **Verify OTP**: Enter 6-digit code, click "Verify Code"
4. **Reset Password**: Enter new password twice, click "Reset Password"
5. **Login**: Try logging in with new password

### API Testing
```bash
# 1. Send OTP
curl -X POST http://localhost:5000/api/v1/reset-password/send-otp \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_API_KEY" \
  -d '{"email":"test@example.com"}'

# 2. Verify OTP
curl -X POST http://localhost:5000/api/v1/reset-password/verify-otp \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_API_KEY" \
  -d '{"email":"test@example.com","otp":"123456"}'

# 3. Reset Password
curl -X POST http://localhost:5000/api/v1/reset-password/reset \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_API_KEY" \
  -d '{"email":"test@example.com","resetToken":"TOKEN","newPassword":"newpass123","confirmPassword":"newpass123"}'
```

## Deployment Notes

1. **Restart Backend Server** - New routes need server restart
2. **Database Migration** - OTP collection will be updated automatically
3. **Email Service** - Ensure email service is configured
4. **Environment Variables** - Check all required env vars are set

## Future Enhancements

- [ ] Rate limiting for OTP requests
- [ ] SMS OTP option
- [ ] Password strength meter
- [ ] Account lockout after failed attempts
- [ ] Password history (prevent reuse)
- [ ] Two-factor authentication
- [ ] Email templates customization
- [ ] Admin panel for reset management

## Support

If you encounter issues:
1. Check backend console for error logs
2. Verify email service is working
3. Check database connection
4. Ensure API key is valid
5. Check frontend console for errors

The new system is more secure, user-friendly, and maintainable than the previous implementation.
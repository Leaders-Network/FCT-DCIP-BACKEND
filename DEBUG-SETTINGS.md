# Settings API Debugging Guide

## Backend Setup Complete ✅

The settings functionality has been implemented with the following endpoints:

### Endpoints
1. `GET /api/v1/settings/profile` - Get user profile
2. `PATCH /api/v1/settings/profile` - Update profile
3. `POST /api/v1/settings/change-password` - Change password

### Changes Made
- Fixed authentication middleware compatibility (changed `userType` to `model`)
- Improved error handling with proper HTTP status codes
- Added console logging for debugging

## Testing Steps

### 1. Restart Backend Server
```bash
cd FCT-DCIP-BACKEND
npm start
# or if using nodemon
npm run dev
```

### 2. Check Backend Logs
Look for these log messages:
- `🔐 Verifying token...`
- `✅ Token verified`
- `Password change request: { userId, model }`
- `Password changed successfully for user:`

### 3. Test from Browser Console
Open browser console on http://localhost:3000/dashboard/settings and run:

```javascript
// Test get profile
fetch('http://localhost:5000/api/v1/settings/profile', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'apikey': '4a8612b0162373aff93c2088780b42e77d06b22b9906a58f5940054b192695134262a4c481b9713426922f29b7bd44ea64dcc6e13a3d22d0f7d05044e9ca626c',
    'Content-Type': 'application/json'
  }
}).then(r => r.json()).then(console.log)

// Test change password
fetch('http://localhost:5000/api/v1/settings/change-password', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'apikey': '4a8612b0162373aff93c2088780b42e77d06b22b9906a58f5940054b192695134262a4c481b9713426922f29b7bd44ea64dcc6e13a3d22d0f7d05044e9ca626c',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    currentPassword: 'your_current_password',
    newPassword: 'new_password_123',
    confirmPassword: 'new_password_123'
  })
}).then(r => r.json()).then(console.log)
```

### 4. Common Issues

#### Issue: "Failed to change password"
**Possible Causes:**
- Backend server not restarted after code changes
- Wrong current password
- Token expired or invalid
- CORS issues

**Solutions:**
1. Restart backend server
2. Check backend console for error messages
3. Verify token in localStorage is valid
4. Check browser network tab for actual error response

#### Issue: "Authentication invalid"
**Possible Causes:**
- Token not being sent
- Token expired
- Wrong token type

**Solutions:**
1. Check localStorage has 'token' key
2. Login again to get fresh token
3. Check browser console for auth errors

#### Issue: "Current password is incorrect"
**Possible Causes:**
- Wrong password entered
- Password field has extra spaces

**Solutions:**
1. Double-check password
2. Try resetting password if forgotten

### 5. Frontend API Call
The frontend makes this call:
```javascript
const response = await api.post('/settings/change-password', {
  currentPassword,
  newPassword,
  confirmPassword
});
```

The `api` instance automatically adds:
- Authorization header with Bearer token
- API key header
- Content-Type: application/json

## Files Modified
- `FCT-DCIP-BACKEND/controllers/settings.js` - Main controller logic
- `FCT-DCIP-BACKEND/routes/settings.js` - Route definitions
- `FCT-DCIP-BACKEND/app.js` - Route registration (already done)

## Next Steps
1. **Restart the backend server** - This is the most important step!
2. Try changing password again
3. Check backend console for logs
4. Check browser console for errors
5. If still not working, share the error message from browser console

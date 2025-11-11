# Authentication Fix Guide

## Problem Summary
The user dashboard was returning 401 Unauthorized errors even though authentication tokens were being sent. The root cause was that the frontend was using **fake development tokens** (like `'dev-user-token-12345'`) which are not valid JWT tokens and cannot be verified by the backend.

## What Was Fixed

### 1. Frontend Token Setup (DISABLED)
**File:** `FCT-DCIP-FRONTEND/src/utils/tokenSetup.ts`
- Disabled automatic setup of fake development tokens
- Users must now log in with real credentials to get valid JWT tokens

### 2. Authentication Middleware (ENHANCED)
**File:** `FCT-DCIP-BACKEND/middlewares/authentication.js`
- Added detailed logging to track authentication flow
- Better error messages for debugging JWT issues
- Logs show:
  - Token verification status
  - User lookup results
  - Access control decisions

### 3. Auth Provider (FIXED)
**File:** `FCT-DCIP-FRONTEND/src/context/AuthProvider.tsx`
- Fixed token storage to use correct token type
- User tokens now stored as `userToken` (not `adminToken`)
- Employee tokens stored as `adminToken`

### 4. Token Generation Script (NEW)
**File:** `FCT-DCIP-BACKEND/scripts/generateDevTokens.js`
- Generates valid JWT tokens for all user types
- Creates test accounts if they don't exist
- Provides ready-to-use localStorage commands

## How to Use

### Option 1: Login with Test Credentials (RECOMMENDED)

1. Start the backend server:
   ```bash
   cd FCT-DCIP-BACKEND
   npm start
   ```

2. Generate test accounts and tokens:
   ```bash
   node scripts/generateDevTokens.js
   ```

3. Use the credentials shown to login:
   - **Regular User:** testuser@example.com / password123
   - **Super Admin:** superadmin@example.com / admin123
   - **AMMC Admin:** ammcadmin@example.com / admin123
   - **NIA Admin:** niaadmin@example.com / admin123
   - **Surveyor:** surveyor@example.com / surveyor123

### Option 2: Use Generated Tokens Directly

1. Run the token generation script:
   ```bash
   cd FCT-DCIP-BACKEND
   node scripts/generateDevTokens.js
   ```

2. Copy the localStorage commands from the output

3. Open browser console on http://localhost:3001

4. Paste the commands, for example:
   ```javascript
   localStorage.setItem("userToken", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...");
   ```

5. Refresh the page

## Testing the Fix

### Test User Dashboard Access

1. Login as a regular user (testuser@example.com / password123)

2. Navigate to the user dashboard

3. Check that the report summary loads without 401 errors

4. Open browser console and verify:
   ```
   ✅ Token verified
   ✅ User found
   ✅ Access granted to user/admin
   ```

### Test Different User Types

Test each user type to ensure proper authentication:

- **Regular User** → Can access user dashboard and reports
- **Super Admin** → Can access all dashboards
- **AMMC Admin** → Can access admin dashboard
- **NIA Admin** → Can access NIA admin dashboard
- **Surveyor** → Can access surveyor dashboard

## Backend Logs to Monitor

When authentication is working correctly, you should see:

```
🔐 Verifying token...
✅ Token verified. Payload: { userId: '...', model: 'User', role: 'user' }
👤 Looking up User: ...
✅ User found: { id: '...', model: 'User' }
✅ User context set: { userId: '...', model: 'User', tokenType: 'user' }
🔒 allowUserOrAdmin check: { model: 'User', role: 'user', userId: '...' }
✅ Access granted to user/admin
```

## Common Issues

### Issue: Still getting 401 errors
**Solution:** 
- Clear all localStorage tokens
- Run `generateDevTokens.js` again
- Use fresh tokens or login with credentials

### Issue: Token expired
**Solution:**
- Tokens expire after 30 days by default
- Generate new tokens using the script
- Or login again to get a fresh token

### Issue: User not found in database
**Solution:**
- Run `generateDevTokens.js` to create test users
- Or register a new user through the registration flow

## Environment Variables Required

Ensure these are set in `FCT-DCIP-BACKEND/.env`:

```env
JWT_SECRET=fct-dcip-super-secret-jwt-key-2024-make-this-very-long-and-random-for-security
JWT_LIFETIME=30d
MONGO_URI=mongodb+srv://...
```

## API Endpoints Affected

These endpoints now work correctly with proper authentication:

- `GET /api/v1/report-release/user/reports/summary` - Get user report summary
- `GET /api/v1/report-release/user/reports` - Get user reports list
- `GET /api/v1/report-release/status/:policyId` - Get report status
- `GET /api/v1/report-release/report/:reportId` - Get report details
- `POST /api/v1/report-release/download/:reportId` - Download report

## Next Steps

1. Test all user types thoroughly
2. Remove debug logging from production (optional)
3. Consider implementing token refresh mechanism
4. Add automated tests for authentication flow

## Support

If you encounter issues:
1. Check backend console for authentication logs
2. Check browser console for token-related errors
3. Verify JWT_SECRET is set correctly
4. Ensure MongoDB connection is working
5. Run `generateDevTokens.js` to reset test accounts

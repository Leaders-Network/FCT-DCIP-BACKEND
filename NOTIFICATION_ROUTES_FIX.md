# Notification Routes Fix

## Issue
Server was crashing with error:
```
Error: Cannot find module '../middleware/auth'
```

## Root Cause
The notification routes file was trying to import from the wrong path:
- ❌ `require('../middleware/auth')` - Wrong (doesn't exist)
- ❌ `authenticateToken` - Wrong function name

## Fix Applied
Updated `FCT-DCIP-BACKEND/routes/notifications.js`:

### 1. Fixed Import Path
```javascript
// Before
const { authenticateToken } = require('../middleware/auth');

// After
const { protect } = require('../middlewares/authentication');
```

### 2. Updated All Route Middleware
Replaced all instances of `authenticateToken` with `protect`:
- `router.get('/', protect, ...)`
- `router.get('/unread-count', protect, ...)`
- `router.patch('/:id/read', protect, ...)`
- `router.patch('/mark-all-read', protect, ...)`
- `router.delete('/:id', protect, ...)`

## Verification
✅ Routes are already registered in `app.js` line 128:
```javascript
app.use('/api/v1/notifications', notificationsRouter);
```

## Server Should Now Start
The server should now start without errors. The notification system is ready to use!

## Test Endpoints
Once server is running, test with:
```bash
# Get notifications (requires auth token)
GET http://localhost:5000/api/v1/notifications

# Get unread count
GET http://localhost:5000/api/v1/notifications/unread-count

# Mark as read
PATCH http://localhost:5000/api/v1/notifications/:id/read

# Mark all as read
PATCH http://localhost:5000/api/v1/notifications/mark-all-read

# Delete notification
DELETE http://localhost:5000/api/v1/notifications/:id
```

All endpoints require Bearer token in Authorization header.

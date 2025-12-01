# Authentication System Documentation

## Overview

The Builders-Liability-AMMC authentication system has been redesigned to provide clear, role-based access control with proper token management. The system supports five distinct token types with specific dashboard access permissions.

## Token Types and Access Levels

### 1. User Token (`user`)
- **Purpose**: Regular users (property owners, policy holders)
- **Dashboard Access**: User/Builder dashboard only
- **API Access**: User-specific endpoints, policy management
- **Storage Key**: `userToken`

### 2. Admin Token (`admin`)
- **Purpose**: AMMC administrators
- **Dashboard Access**: AMMC admin dashboard
- **API Access**: Admin endpoints, policy management, surveyor management
- **Storage Key**: `adminToken`

### 3. Super Admin Token (`super-admin`)
- **Purpose**: System super administrators
- **Dashboard Access**: ALL dashboards (universal access)
- **API Access**: ALL endpoints (universal access)
- **Storage Key**: `superAdminToken`

### 4. NIA Admin Token (`nia-admin`)
- **Purpose**: NIA (National Insurance Authority) administrators
- **Dashboard Access**: NIA admin dashboard
- **API Access**: NIA-specific endpoints, dual assignments, conflict management
- **Storage Key**: `niaAdminToken`

### 5. Surveyor Token (`surveyor`)
- **Purpose**: Property surveyors (both AMMC and NIA)
- **Dashboard Access**: Surveyor dashboard
- **API Access**: Survey submissions, assignment management
- **Storage Key**: `surveyorToken`

## Dashboard Access Matrix

| Token Type | User Dashboard | Admin Dashboard | NIA Dashboard | Surveyor Dashboard |
|------------|----------------|-----------------|---------------|-------------------|
| user       | ✅             | ❌              | ❌            | ❌                |
| admin      | ❌             | ✅              | ❌            | ❌                |
| super-admin| ✅             | ✅              | ✅            | ✅                |
| nia-admin  | ❌             | ❌              | ✅            | ❌                |
| surveyor   | ❌             | ❌              | ❌            | ✅                |

## Backend Middleware

### Core Authentication Middleware

#### `protect`
- Validates JWT tokens
- Determines user model (User vs Employee)
- Sets token type based on role and special assignments
- Populates `req.user` with user information

#### Dashboard Access Middleware
- `requireUserDashboardAccess`: User + Super Admin
- `requireAdminDashboardAccess`: Admin + Super Admin
- `requireNIADashboardAccess`: NIA Admin + Super Admin
- `requireSurveyorDashboardAccess`: Surveyor + Super Admin

#### Role-Based Access Control
- `restrictTo(...roles)`: Restrict by employee role
- `requireTokenType(...tokenTypes)`: Restrict by token type
- `requireOrganization(org)`: Restrict by organization (AMMC/NIA)

### Usage Examples

```javascript
// Protect route with basic authentication
router.use(protect);

// Require admin dashboard access
router.use(requireAdminDashboardAccess);

// Require specific roles
router.use(restrictTo('Admin', 'Super-admin'));

// Require specific token types
router.use(requireTokenType('admin', 'super-admin'));

// Cross-organization admin access (for dual assignments)
router.use(requireCrossOrgAdminAccess);
```

## Frontend Token Management

### Token Storage
Tokens are stored in localStorage with specific keys:
- `userToken`: User authentication
- `adminToken`: AMMC admin authentication
- `superAdminToken`: Super admin authentication
- `niaAdminToken`: NIA admin authentication
- `surveyorToken`: Surveyor authentication

### Utility Functions

#### `getAuthToken(tokenType?)`
```typescript
// Get specific token type
const token = getAuthToken('admin');

// Get any available token (priority order)
const token = getAuthToken();
```

#### `setAuthToken(token, tokenType)`
```typescript
// Set specific token type
setAuthToken(jwtToken, 'admin');
```

#### `hasAccessLevel(requiredLevel)`
```typescript
// Check if user has required access level
if (hasAccessLevel('admin')) {
  // User can access admin features
}
```

#### `getCurrentTokenType()`
```typescript
// Get current user's token type
const tokenType = getCurrentTokenType(); // 'admin', 'user', etc.
```

## Token Generation

### User Tokens
Generated during user login with `role: 'user'` and `model: 'User'`

### Employee Tokens
Generated during employee login with:
- `role`: Employee role (Admin, Super-admin, NIA-Admin, Surveyor, Staff)
- `model`: 'Employee'
- Additional checks for NIA Admin and Surveyor assignments

### Token Payload Structure
```javascript
{
  userId: "user_id",
  fullname: "User Name",
  role: "Admin", // or user role
  model: "Employee", // or "User"
  status: "Active",
  iat: timestamp,
  exp: timestamp
}
```

## Route Protection Examples

### User Routes
```javascript
router.use(protect);
router.use(requireUserDashboardAccess);
```

### Admin Routes
```javascript
router.use(protect);
router.use(requireAdminDashboardAccess);
```

### NIA Admin Routes
```javascript
router.use(protect);
router.use(requireNIADashboardAccess);
```

### Surveyor Routes
```javascript
router.use(protect);
router.use(requireSurveyorDashboardAccess);
```

### Cross-Organization Routes (Dual Assignments)
```javascript
router.use(protect);
router.use(requireCrossOrgAdminAccess); // Allows both AMMC and NIA admins
```

## Testing Authentication

Use the auth test endpoints to verify authentication:

```bash
# Test basic authentication
GET /api/v1/auth-test/basic

# Test specific dashboard access
GET /api/v1/auth-test/user-dashboard
GET /api/v1/auth-test/admin-dashboard
GET /api/v1/auth-test/nia-dashboard
GET /api/v1/auth-test/surveyor-dashboard

# Test super admin access
GET /api/v1/auth-test/super-admin

# Check all access levels for current user
GET /api/v1/auth-test/access-levels
```

## Error Handling

### Common Authentication Errors
- `Authentication invalid`: Missing or invalid token
- `Access denied. User dashboard access required.`: Wrong token type for user dashboard
- `Access denied. AMMC admin dashboard access required.`: Wrong token type for admin dashboard
- `Access denied. NIA admin dashboard access required.`: Wrong token type for NIA dashboard
- `Access denied. Surveyor dashboard access required.`: Wrong token type for surveyor dashboard

### Frontend Error Handling
```typescript
try {
  const response = await api.get('/admin/dashboard');
} catch (error) {
  if (error.response?.status === 401) {
    // Redirect to appropriate login page based on required access
    redirectToLogin();
  }
}
```

## Migration Notes

### From Old System
1. Replace `restrictTo('Admin', 'Super-admin')` with `requireAdminDashboardAccess`
2. Replace multiple role checks with appropriate dashboard access middleware
3. Update frontend to use specific token types instead of generic tokens
4. Update login flows to set appropriate token types

### Token Type Detection
The system automatically detects token types based on:
1. Employee role (Super-admin → super-admin token type)
2. NIA Admin assignment (→ nia-admin token type)
3. Surveyor assignment (→ surveyor token type)
4. Regular admin role (→ admin token type)
5. User model (→ user token type)

## Security Considerations

1. **Token Separation**: Each token type has specific access scope
2. **Super Admin Override**: Super admin can access all resources
3. **Organization Isolation**: NIA and AMMC resources are properly separated
4. **Role Validation**: Backend validates both token and database role
5. **Token Expiration**: All tokens respect JWT expiration times

## Troubleshooting

### Common Issues
1. **Wrong Dashboard Access**: Check token type matches required dashboard
2. **Cross-Organization Access**: Use `requireCrossOrgAdminAccess` for dual assignments
3. **Token Not Found**: Ensure correct token key is used in localStorage
4. **Role Mismatch**: Verify user has correct role assignment in database

### Debug Steps
1. Check `req.user` object in backend logs
2. Verify token type in `req.user.tokenType`
3. Use auth test endpoints to verify access levels
4. Check localStorage for correct token keys
5. Verify database role assignments
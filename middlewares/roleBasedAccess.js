const { UnauthenticatedError } = require('../errors');

/**
 * Comprehensive role-based access control middleware
 * This middleware provides fine-grained access control based on user roles and token types
 */

// Route access mappings
const ROUTE_ACCESS = {
    // User dashboard routes
    '/api/v1/user/*': ['user', 'super-admin'],
    '/api/v1/dashboard/user/*': ['user', 'super-admin'],

    // Admin dashboard routes (AMMC)
    '/api/v1/admin/*': ['admin', 'super-admin'],
    '/api/v1/dashboard/admin/*': ['admin', 'super-admin'],

    // NIA Admin dashboard routes
    '/api/v1/nia-admin/*': ['nia-admin', 'super-admin'],
    '/api/v1/dashboard/nia-admin/*': ['nia-admin', 'super-admin'],

    // Broker Admin dashboard routes
    '/api/v1/broker-admin/*': ['broker-admin', 'super-admin'],
    '/api/v1/dashboard/broker-admin/*': ['broker-admin', 'super-admin'],

    // Surveyor dashboard routes
    '/api/v1/surveyor/*': ['surveyor', 'super-admin'],
    '/api/v1/dashboard/surveyor/*': ['surveyor', 'super-admin'],

    // Dual assignment routes (both AMMC and NIA admins)
    '/api/v1/dual-assignment/*': ['admin', 'nia-admin', 'super-admin'],

    // Policy routes (users and admins)
    '/api/v1/policy/*': ['user', 'admin', 'nia-admin', 'broker-admin', 'super-admin'],

    // Assignment routes (admins and surveyors)
    '/api/v1/assignment/*': ['admin', 'nia-admin', 'surveyor', 'super-admin']
};

/**
 * Check if user has access to a specific route
 */
const checkRouteAccess = (req, res, next) => {
    const path = req.path;
    const userTokenType = req.user?.tokenType;

    if (!userTokenType) {
        throw new UnauthenticatedError('Authentication required');
    }

    // Super admin has access to everything
    if (userTokenType === 'super-admin') {
        return next();
    }

    // Check route-specific access
    for (const [routePattern, allowedTypes] of Object.entries(ROUTE_ACCESS)) {
        const regex = new RegExp(routePattern.replace('*', '.*'));
        if (regex.test(path)) {
            if (allowedTypes.includes(userTokenType)) {
                return next();
            } else {
                throw new UnauthenticatedError(`Access denied. Required access levels: ${allowedTypes.join(', ')}`);
            }
        }
    }

    // If no specific route found, allow access (for general routes)
    next();
};

/**
 * Middleware factory for specific dashboard access
 */
const createDashboardAccess = (dashboardType) => {
    return (req, res, next) => {
        const userTokenType = req.user?.tokenType;

        if (!userTokenType) {
            throw new UnauthenticatedError('Authentication required');
        }

        // Super admin has access to all dashboards
        if (userTokenType === 'super-admin') {
            return next();
        }

        // Check specific dashboard access
        switch (dashboardType) {
            case 'user':
                if (userTokenType === 'user') {
                    return next();
                }
                break;
            case 'admin':
                if (userTokenType === 'admin') {
                    return next();
                }
                break;
            case 'nia-admin':
                if (userTokenType === 'nia-admin') {
                    return next();
                }
                break;
            case 'broker-admin':
                if (userTokenType === 'broker-admin') {
                    return next();
                }
                break;
            case 'surveyor':
                if (userTokenType === 'surveyor') {
                    return next();
                }
                break;
            default:
                throw new UnauthenticatedError('Invalid dashboard type');
        }

        throw new UnauthenticatedError(`Access denied. ${dashboardType} dashboard access required.`);
    };
};

/**
 * Organization-specific access control
 */
const requireOrganizationAccess = (requiredOrg) => {
    return (req, res, next) => {
        const userOrg = req.user?.organization;
        const userTokenType = req.user?.tokenType;

        // Super admin can access all organizations
        if (userTokenType === 'super-admin') {
            return next();
        }

        if (!userOrg || userOrg !== requiredOrg) {
            throw new UnauthenticatedError(`Access denied. ${requiredOrg} organization access required.`);
        }

        next();
    };
};

/**
 * Multi-role access control
 */
const requireAnyRole = (...allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.user?.role;
        const userTokenType = req.user?.tokenType;

        // Super admin bypasses role checks
        if (userTokenType === 'super-admin') {
            return next();
        }

        if (!userRole || !allowedRoles.includes(userRole)) {
            throw new UnauthenticatedError(`Access denied. Required roles: ${allowedRoles.join(', ')}`);
        }

        next();
    };
};

/**
 * Cross-organization admin access (for dual assignments)
 */
const requireCrossOrgAdminAccess = (req, res, next) => {
    const userTokenType = req.user?.tokenType;
    const userRole = req.user?.role;

    // Allow super admin, regular admin, or NIA admin
    if (userTokenType === 'super-admin' ||
        userTokenType === 'admin' ||
        userTokenType === 'nia-admin' ||
        ['Admin', 'Super-admin', 'NIA-Admin'].includes(userRole)) {
        return next();
    }

    throw new UnauthenticatedError('Access denied. Admin access from either AMMC or NIA required.');
};

module.exports = {
    checkRouteAccess,
    createDashboardAccess,
    requireOrganizationAccess,
    requireAnyRole,
    requireCrossOrgAdminAccess,

    // Pre-configured dashboard access middlewares
    requireUserDashboard: createDashboardAccess('user'),
    requireAdminDashboard: createDashboardAccess('admin'),
    requireNIADashboard: createDashboardAccess('nia-admin'),
    requireBrokerAdminDashboard: createDashboardAccess('broker-admin'),
    requireSurveyorDashboard: createDashboardAccess('surveyor')
};
const jwt = require('jsonwebtoken');
const { UnauthenticatedError, UnauthorizedError } = require('../errors');
const { Employee } = require('../models/Employee');
const NIAAdmin = require('../models/NIAAdmin');

// Middleware to check if user is a valid NIA admin
const requireNIAAdmin = async (req, res, next) => {
    try {
        console.log('=== NIA Auth Middleware Debug ===');

        // First, ensure user is authenticated
        const authHeader = req.headers.authorization;
        console.log('Auth header present:', !!authHeader);

        if (!authHeader || !authHeader.startsWith('Bearer')) {
            console.log('Invalid auth header format');
            throw new UnauthenticatedError('Authentication invalid');
        }

        const token = authHeader.split(' ')[1];
        console.log('Token present:', !!token);

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token payload:', payload);

        // Get user from Employee model
        const user = await Employee.findById(payload.userId)
            .populate(['employeeRole', 'employeeStatus']);
        console.log('User found:', user ? `${user.firstname} ${user.lastname} (${user.email})` : 'No');

        if (!user) {
            throw new UnauthenticatedError('Authentication invalid: User not found');
        }

        // Check if user is a NIA admin
        const niaAdmin = await NIAAdmin.findOne({
            userId: payload.userId,
            status: 'active'
        }).populate('userId', 'firstname lastname email phonenumber employeeRole employeeStatus');

        console.log('NIAAdmin found:', niaAdmin ? 'Yes' : 'No');
        console.log('Searching for NIAAdmin with userId:', payload.userId);

        if (!niaAdmin) {
            console.log('NIA admin access denied for user:', user.email);
            throw new UnauthorizedError('NIA admin access required');
        }

        console.log('Setting up req.user and req.niaAdmin...');

        // Add user and NIA admin info to request
        req.user = {
            userId: user._id,
            fullname: `${user.firstname} ${user.lastname}`,
            role: user.employeeRole?.role,
            status: user.employeeStatus?.status,
            model: 'Employee',
            organization: 'NIA'
        };

        req.niaAdmin = niaAdmin;

        console.log('req.user set:', req.user);
        console.log('Calling next()...');
        next();
    } catch (error) {
        console.error('=== NIA Auth Middleware Error ===');
        console.error('Error:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);

        if (error.name === 'JsonWebTokenError') {
            throw new UnauthenticatedError('Authentication invalid');
        }
        throw error;
    }
};

// Middleware to check specific NIA admin permissions
const requireNIAPermission = (permission) => {
    return async (req, res, next) => {
        try {
            if (!req.niaAdmin) {
                throw new UnauthorizedError('NIA admin context required');
            }

            const hasPermission = req.niaAdmin.hasPermission(permission);
            if (!hasPermission) {
                throw new UnauthorizedError(`Permission '${permission}' required`);
            }

            next();
        } catch (error) {
            throw error;
        }
    };
};

// Middleware to allow both AMMC and NIA admins
const requireAnyAdmin = async (req, res, next) => {
    try {
        console.log('=== requireAnyAdmin Debug ===');

        // First, ensure user is authenticated
        const authHeader = req.headers.authorization;
        console.log('Auth header present:', !!authHeader);

        if (!authHeader || !authHeader.startsWith('Bearer')) {
            console.log('Invalid auth header format');
            throw new UnauthenticatedError('Authentication invalid');
        }

        const token = authHeader.split(' ')[1];
        console.log('Token present:', !!token);

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token payload:', payload);

        // Get user from Employee model
        const user = await Employee.findById(payload.userId)
            .populate(['employeeRole', 'employeeStatus']);

        console.log('User found:', user ? `${user.firstname} ${user.lastname} (${user.email})` : 'No');

        if (!user) {
            console.log('User not found in database');
            throw new UnauthenticatedError('Authentication invalid: User not found');
        }

        // Check if user is AMMC admin (existing logic)
        const isAMMCAdmin = ['Admin', 'Super-admin'].includes(user.employeeRole?.role);
        console.log('Is AMMC Admin:', isAMMCAdmin, 'Role:', user.employeeRole?.role);

        // Check if user is NIA admin
        const niaAdmin = await NIAAdmin.findOne({
            userId: payload.userId,
            status: 'active'
        });
        console.log('NIA Admin found:', !!niaAdmin);

        if (!isAMMCAdmin && !niaAdmin) {
            console.log('Access denied - not AMMC admin or NIA admin');
            throw new UnauthorizedError('Admin access required (AMMC or NIA)');
        }

        // Set user context
        req.user = {
            userId: user._id,
            fullname: `${user.firstname} ${user.lastname}`,
            role: user.employeeRole?.role,
            status: user.employeeStatus?.status,
            model: 'Employee',
            organization: niaAdmin ? 'NIA' : 'AMMC'
        };

        if (niaAdmin) {
            req.niaAdmin = niaAdmin;
        }

        console.log('Access granted for:', req.user.organization, 'admin');
        next();
    } catch (error) {
        console.error('requireAnyAdmin error:', error.message);
        if (error.name === 'JsonWebTokenError') {
            throw new UnauthenticatedError('Authentication invalid');
        }
        throw error;
    }
};

// Middleware to check organization-specific access
const requireOrganization = (organization) => {
    return (req, res, next) => {
        if (!req.user || !req.user.organization) {
            throw new UnauthorizedError('Organization context required');
        }

        if (req.user.organization !== organization) {
            throw new UnauthorizedError(`${organization} access required`);
        }

        next();
    };
};

// Middleware for dual-assignment operations (requires admin from either org)
const requireDualAssignmentAccess = async (req, res, next) => {
    try {
        // Use the requireAnyAdmin middleware first
        await requireAnyAdmin(req, res, () => { });

        // Additional checks for dual assignment operations can be added here
        // For example, checking if the admin has permission to work with specific policies

        next();
    } catch (error) {
        throw error;
    }
};

// Middleware to log NIA admin activities
const logNIAAdminActivity = (action) => {
    return (req, res, next) => {
        // Log the activity (you can implement logging to database or file)
        console.log(`NIA Admin Activity: ${action}`, {
            adminId: req.niaAdmin?._id,
            userId: req.user?.userId,
            timestamp: new Date(),
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        next();
    };
};

module.exports = {
    requireNIAAdmin,
    requireNIAPermission,
    requireAnyAdmin,
    requireOrganization,
    requireDualAssignmentAccess,
    logNIAAdminActivity
};
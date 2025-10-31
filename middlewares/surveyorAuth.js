const jwt = require('jsonwebtoken');
const { UnauthenticatedError, UnauthorizedError } = require('../errors');
const Employee = require('../models/Employee');
const Surveyor = require('../models/Surveyor');

// Middleware to check if user is a valid surveyor (AMMC or NIA)
const requireSurveyor = async (req, res, next) => {
    try {
        // First, ensure user is authenticated
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer')) {
            throw new UnauthenticatedError('Authentication invalid');
        }

        const token = authHeader.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from Employee model
        const user = await Employee.findById(payload.userId)
            .populate(['employeeRole', 'employeeStatus']);

        if (!user) {
            throw new UnauthenticatedError('Authentication invalid: User not found');
        }

        // Check if user is a surveyor
        const surveyor = await Surveyor.findOne({
            userId: payload.userId,
            status: 'active'
        });

        if (!surveyor) {
            throw new UnauthorizedError('Surveyor access required');
        }

        // Set user context
        req.user = {
            userId: user._id,
            fullname: `${user.firstname} ${user.lastname}`,
            role: user.employeeRole?.role,
            status: user.employeeStatus?.status,
            model: 'Employee',
            organization: surveyor.organization
        };

        req.surveyor = surveyor;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            throw new UnauthenticatedError('Authentication invalid');
        }
        throw error;
    }
};

// Middleware to check if user is a specific organization surveyor
const requireSurveyorOrganization = (organization) => {
    return (req, res, next) => {
        if (!req.surveyor || req.surveyor.organization !== organization) {
            throw new UnauthorizedError(`${organization} surveyor access required`);
        }
        next();
    };
};

// Middleware to allow any surveyor (AMMC or NIA)
const requireAnySurveyor = async (req, res, next) => {
    try {
        // Use the requireSurveyor middleware
        await requireSurveyor(req, res, next);
    } catch (error) {
        throw error;
    }
};

// Middleware to allow surveyor or admin access
const requireSurveyorOrAdmin = async (req, res, next) => {
    try {
        // First, ensure user is authenticated
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer')) {
            throw new UnauthenticatedError('Authentication invalid');
        }

        const token = authHeader.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from Employee model
        const user = await Employee.findById(payload.userId)
            .populate(['employeeRole', 'employeeStatus']);

        if (!user) {
            throw new UnauthenticatedError('Authentication invalid: User not found');
        }

        // Check if user is admin
        const isAdmin = ['Admin', 'Super-admin'].includes(user.employeeRole?.role);

        // Check if user is surveyor
        const surveyor = await Surveyor.findOne({
            userId: payload.userId,
            status: 'active'
        });

        // Check if user is NIA admin
        const NIAAdmin = require('../models/NIAAdmin');
        const niaAdmin = await NIAAdmin.findOne({
            userId: payload.userId,
            status: 'active'
        });

        if (!isAdmin && !surveyor && !niaAdmin) {
            throw new UnauthorizedError('Surveyor or admin access required');
        }

        // Set user context
        req.user = {
            userId: user._id,
            fullname: `${user.firstname} ${user.lastname}`,
            role: user.employeeRole?.role,
            status: user.employeeStatus?.status,
            model: 'Employee',
            organization: surveyor ? surveyor.organization : (niaAdmin ? 'NIA' : 'AMMC')
        };

        if (surveyor) {
            req.surveyor = surveyor;
        }
        if (niaAdmin) {
            req.niaAdmin = niaAdmin;
        }

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            throw new UnauthenticatedError('Authentication invalid');
        }
        throw error;
    }
};

// Middleware to check if surveyor can access specific assignment
const requireAssignmentAccess = async (req, res, next) => {
    try {
        const { assignmentId } = req.params;

        if (!req.surveyor) {
            throw new UnauthorizedError('Surveyor access required');
        }

        // Check if the assignment belongs to this surveyor
        const Assignment = require('../models/Assignment');
        const assignment = await Assignment.findOne({
            _id: assignmentId,
            surveyorId: req.user.userId,
            organization: req.surveyor.organization
        });

        if (!assignment) {
            throw new UnauthorizedError('Access denied: Assignment not found or not assigned to you');
        }

        req.assignment = assignment;
        next();
    } catch (error) {
        throw error;
    }
};

// Middleware to log surveyor activities
const logSurveyorActivity = (action) => {
    return (req, res, next) => {
        // Log the activity
        console.log(`Surveyor Activity: ${action}`, {
            surveyorId: req.surveyor?._id,
            userId: req.user?.userId,
            organization: req.surveyor?.organization,
            timestamp: new Date(),
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        next();
    };
};

module.exports = {
    requireSurveyor,
    requireSurveyorOrganization,
    requireAnySurveyor,
    requireSurveyorOrAdmin,
    requireAssignmentAccess,
    logSurveyorActivity
};
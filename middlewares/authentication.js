const jwt = require('jsonwebtoken')
const { UnauthenticatedError } = require('../errors')
const { Employee } = require('../models/Employee')
const User = require('../models/User')
const NIAAdmin = require('../models/NIAAdmin')
const Surveyor = require('../models/Surveyor')

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    throw new UnauthenticatedError('Authentication invalid')
  }
  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)

    let userObject;
    let modelName;

    // Determine the user model from the token payload
    if (payload.model === 'Employee') {
      userObject = await Employee.findOne({ _id: payload.userId });
      modelName = 'Employee';
    } else {
      userObject = await User.findOne({ _id: payload.userId });
      modelName = 'User';
    }

    if (!userObject) {
      throw new UnauthenticatedError('Authentication invalid: User not found');
    }

    if (modelName === 'Employee') {
      await userObject.populate(['employeeRole', 'employeeStatus']);
      const role = userObject.employeeRole?.role || undefined;
      const status = userObject.employeeStatus?.status || undefined;

      // Check for special roles and set organization
      let organization = userObject.organization || 'AMMC';
      let tokenType = 'employee';

      // Check if user is Super Admin (highest priority)
      if (role === 'Super-admin') {
        tokenType = 'super-admin';
        organization = 'AMMC'; // Super admin belongs to AMMC but can access all
      }
      // Check if user is NIA Admin
      else {
        const niaAdmin = await NIAAdmin.findOne({ userId: payload.userId, status: 'active' });
        if (niaAdmin) {
          organization = 'NIA';
          tokenType = 'nia-admin';
          req.niaAdmin = niaAdmin;
        }
      }

      // Check if user is Surveyor (can be both admin and surveyor)
      const surveyor = await Surveyor.findOne({ userId: payload.userId, status: 'active' });
      if (surveyor) {
        req.surveyor = surveyor;

        // If user is not already super-admin or nia-admin, set as surveyor
        if (tokenType !== 'super-admin' && tokenType !== 'nia-admin') {
          organization = surveyor.organization;
          tokenType = 'surveyor';
        }
      }

      // Set admin token type for regular admins
      if (role === 'Admin' && tokenType === 'employee') {
        tokenType = 'admin';
      }

      req.user = {
        userId: userObject._id,
        fullname: userObject.firstname + ' ' + userObject.lastname,
        status,
        role,
        model: "Employee",
        organization,
        tokenType
      }
    } else {
      req.user = {
        userId: payload.userId,
        fullname: payload.fullname,
        role: payload.role,
        model: "User",
        organization: null,
        tokenType: 'user'
      }
    }
    next()
  } catch (error) {
    throw new UnauthenticatedError('Authentication invalid')
  }
}

// Token type based access control
const requireTokenType = (...tokenTypes) => {
  return (req, res, next) => {
    if (!req.user || !req.user.tokenType || !tokenTypes.includes(req.user.tokenType)) {
      throw new UnauthenticatedError(`Access denied. Required token types: ${tokenTypes.join(', ')}`);
    }
    next();
  };
};

// Role-based access control
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role || !roles.includes(req.user.role)) {
      throw new UnauthenticatedError('You do not have permission to perform this action');
    }
    next();
  };
};

// Model-based access control
const restrictToModel = (...models) => {
  return (req, res, next) => {
    if (!req.user || !req.user.model || !models.includes(req.user.model)) {
      throw new UnauthenticatedError('You do not have permission to perform this action');
    }
    next();
  };
};

// Dashboard access control based on token type and role
const requireUserDashboardAccess = (req, res, next) => {
  if (req.user.tokenType === 'user' || req.user.tokenType === 'super-admin') {
    return next();
  }
  throw new UnauthenticatedError('Access denied. User dashboard access required.');
};

const requireAdminDashboardAccess = (req, res, next) => {
  if (req.user.tokenType === 'super-admin' || req.user.tokenType === 'admin') {
    return next();
  }
  throw new UnauthenticatedError('Access denied. AMMC admin dashboard access required.');
};

const requireNIADashboardAccess = (req, res, next) => {
  if (req.user.tokenType === 'super-admin' || req.user.tokenType === 'nia-admin') {
    return next();
  }
  throw new UnauthenticatedError('Access denied. NIA admin dashboard access required.');
};

// Multi-dashboard access - allows access to multiple dashboard types
const requireDashboardAccess = (...dashboardTypes) => {
  return (req, res, next) => {
    const userType = req.user.tokenType;

    // Super admin can access all dashboards
    if (userType === 'super-admin') {
      return next();
    }

    // Check if user's token type matches any of the allowed dashboard types
    const allowedTypes = {
      'user': 'user',
      'admin': 'admin',
      'nia-admin': 'nia-admin',
      'surveyor': 'surveyor'
    };

    const hasAccess = dashboardTypes.some(dashboardType => {
      return allowedTypes[dashboardType] === userType;
    });

    if (hasAccess) {
      return next();
    }

    throw new UnauthenticatedError(`Access denied. Required dashboard access: ${dashboardTypes.join(' or ')}`);
  };
};

const requireSurveyorDashboardAccess = async (req, res, next) => {
  try {
    // Super admin can access everything
    if (req.user.tokenType === 'super-admin') {
      return next();
    }

    // If user is already identified as surveyor, allow access
    if (req.user.tokenType === 'surveyor') {
      return next();
    }

    // If user is an employee but not yet identified as surveyor, check if they can be one
    if (req.user.model === 'Employee') {
      // Check if surveyor record exists
      let surveyor = await Surveyor.findOne({ userId: req.user.userId, status: 'active' });

      // If no surveyor record exists, create one automatically for employees
      if (!surveyor) {
        console.log('Creating surveyor record for employee:', req.user.userId);
        try {
          const Employee = require('../models/Employee');
          const user = await Employee.findById(req.user.userId);

          surveyor = new Surveyor({
            userId: req.user.userId,
            organization: 'AMMC', // Default to AMMC, can be changed later
            profile: {
              specialization: ['residential'],
              experience: 1,
              licenseNumber: `LIC-${Date.now()}`,
              certifications: []
            },
            contactDetails: {
              email: user.email,
              phone: user.phonenumber || '',
              address: ''
            },
            availability: {
              status: 'available',
              workingHours: {
                start: '08:00',
                end: '17:00'
              },
              workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
            },
            statistics: {
              totalAssignments: 0,
              pendingAssignments: 0,
              completedSurveys: 0,
              averageRating: 0
            },
            status: 'active'
          });

          await surveyor.save();

          // Update user context
          req.surveyor = surveyor;
          req.user.tokenType = 'surveyor';
          req.user.organization = surveyor.organization;

          console.log('Created surveyor record successfully');
          return next();
        } catch (createError) {
          console.error('Failed to create surveyor record:', createError);
          throw new UnauthenticatedError('Access denied. Unable to create surveyor profile.');
        }
      } else {
        // Surveyor record exists, update user context
        req.surveyor = surveyor;
        req.user.tokenType = 'surveyor';
        req.user.organization = surveyor.organization;
        return next();
      }
    }

    throw new UnauthenticatedError('Access denied. Surveyor dashboard access required.');
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      throw error;
    }
    console.error('Surveyor dashboard access error:', error);
    throw new UnauthenticatedError('Access denied. Surveyor dashboard access required.');
  }
};

// Super admin has access to everything
const requireSuperAdminAccess = (req, res, next) => {
  if (req.user.role === 'Super-admin') {
    return next();
  }
  throw new UnauthenticatedError('Access denied. Super admin access required.');
};

// Allow both Users and Admins to access user-related endpoints
const allowUserOrAdmin = (req, res, next) => {
  if (req.user.model === 'User' ||
    (req.user.model === 'Employee' && ['Admin', 'Super-admin', 'NIA-Admin'].includes(req.user.role))) {
    return next();
  }
  throw new UnauthenticatedError('You do not have permission to perform this action');
};

// Organization-based access control
const requireOrganization = (organization) => {
  return (req, res, next) => {
    if (req.user.role === 'Super-admin') {
      return next(); // Super admin can access all organizations
    }

    if (!req.user.organization || req.user.organization !== organization) {
      throw new UnauthenticatedError(`Access denied. ${organization} organization access required.`);
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo,
  restrictToModel,
  allowUserOrAdmin,
  requireTokenType,
  requireUserDashboardAccess,
  requireAdminDashboardAccess,
  requireNIADashboardAccess,
  requireSurveyorDashboardAccess,
  requireSuperAdminAccess,
  requireOrganization,
  requireDashboardAccess
}
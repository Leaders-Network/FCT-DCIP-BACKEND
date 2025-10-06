const { UnauthenticatedError } = require('../errors');
const { Employee, Role } = require('../models/Employee');

// Middleware to restrict access to admins only
const adminOnly = async (req, res, next) => {
  try {
    // req.user is set by authentication middleware
    if (!req.user || req.user.model !== 'Employee') {
      throw new UnauthenticatedError('Access denied: Not an employee');
    }

    const userRole = await Role.findById(req.user.role);

    if (userRole && (userRole.name === 'Admin' || userRole.name === 'Super-admin')) {
      return next();
    }
    
    throw new UnauthenticatedError('Access denied: Admins only');
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message });
  }
};

module.exports = adminOnly;

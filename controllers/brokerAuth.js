const jwt = require('jsonwebtoken');
const { Employee } = require('../models/Employee');
const BrokerAdmin = require('../models/BrokerAdmin');
const { UnauthenticatedError, BadRequestError } = require('../errors');

// Broker Admin Login
const loginBrokerAdmin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new BadRequestError('Please provide email and password');
    }

    // Find employee with organization='Broker'
    const employee = await Employee.findOne({ email }).populate(['employeeRole', 'employeeStatus']);

    if (!employee) {
        throw new UnauthenticatedError('Invalid credentials');
    }

    // Verify password
    const isPasswordCorrect = await employee.comparePassword(password);
    if (!isPasswordCorrect) {
        throw new UnauthenticatedError('Invalid credentials');
    }

    // Check if employee belongs to Broker organization
    if (employee.organization !== 'Broker') {
        throw new UnauthenticatedError('Broker admin access required');
    }

    // Check if employee status is active
    if (employee.employeeStatus?.status !== 'active') {
        throw new UnauthenticatedError('Account is not active');
    }

    // Find or create BrokerAdmin profile
    let brokerAdmin = await BrokerAdmin.findOne({ userId: employee._id });

    if (!brokerAdmin) {
        // Create default broker admin profile
        brokerAdmin = new BrokerAdmin({
            userId: employee._id,
            organization: 'Broker',
            brokerFirmName: 'Default Broker Firm',
            brokerFirmLicense: `BFL-${Date.now()}`,
            profile: {
                licenseNumber: `LIC-${Date.now()}`
            }
        });
        await brokerAdmin.save();
    }

    // Check if broker admin is active
    if (brokerAdmin.status !== 'active') {
        throw new UnauthenticatedError('Broker admin account is not active');
    }

    // Update last login
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    await brokerAdmin.updateLastLogin(ipAddress, userAgent);

    // Generate JWT token
    const token = jwt.sign(
        {
            userId: employee._id,
            model: 'Employee',
            role: employee.employeeRole?.role,
            organization: 'Broker',
            tokenType: 'broker-admin'
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_LIFETIME || '30d' }
    );

    res.status(200).json({
        success: true,
        message: 'Broker admin login successful',
        token,
        user: {
            id: employee._id,
            email: employee.email,
            fullname: `${employee.firstname} ${employee.lastname}`,
            organization: 'Broker',
            role: employee.employeeRole?.role,
            tokenType: 'broker-admin'
        },
        brokerAdmin: {
            id: brokerAdmin._id,
            brokerFirmName: brokerAdmin.brokerFirmName,
            permissions: brokerAdmin.permissions,
            settings: brokerAdmin.settings
        }
    });
};

// Verify Broker Admin Token
const verifyBrokerAdmin = async (req, res) => {
    // req.user is set by protect middleware
    // req.brokerAdmin is set by requireBrokerAdminAccess middleware

    if (!req.brokerAdmin) {
        throw new UnauthenticatedError('Broker admin context required');
    }

    res.status(200).json({
        success: true,
        user: {
            id: req.user.userId,
            fullname: req.user.fullname,
            organization: req.user.organization,
            role: req.user.role,
            tokenType: req.user.tokenType
        },
        brokerAdmin: {
            id: req.brokerAdmin._id,
            brokerFirmName: req.brokerAdmin.brokerFirmName,
            permissions: req.brokerAdmin.permissions,
            settings: req.brokerAdmin.settings,
            status: req.brokerAdmin.status
        }
    });
};

// Logout Broker Admin
const logoutBrokerAdmin = async (req, res) => {
    // In a stateless JWT system, logout is handled client-side by removing the token
    // We can log the logout event here if needed

    res.status(200).json({
        success: true,
        message: 'Broker admin logged out successfully'
    });
};

module.exports = {
    loginBrokerAdmin,
    verifyBrokerAdmin,
    logoutBrokerAdmin
};

const express = require('express');
const router = express.Router();
const {
    protect,
    requireUserDashboardAccess,
    requireAdminDashboardAccess,
    requireNIADashboardAccess,
    requireSurveyorDashboardAccess,
    requireSuperAdminAccess
} = require('../middlewares/authentication');

// Test basic authentication
router.get('/basic', protect, (req, res) => {
    res.json({
        success: true,
        message: 'Basic authentication successful',
        user: {
            userId: req.user.userId,
            fullname: req.user.fullname,
            role: req.user.role,
            model: req.user.model,
            organization: req.user.organization,
            tokenType: req.user.tokenType
        },
        timestamp: new Date().toISOString()
    });
});

// Test user dashboard access
router.get('/user-dashboard', protect, requireUserDashboardAccess, (req, res) => {
    res.json({
        success: true,
        message: 'User dashboard access granted',
        accessLevel: 'user-dashboard',
        user: req.user
    });
});

// Test admin dashboard access
router.get('/admin-dashboard', protect, requireAdminDashboardAccess, (req, res) => {
    res.json({
        success: true,
        message: 'Admin dashboard access granted',
        accessLevel: 'admin-dashboard',
        user: req.user
    });
});

// Test NIA admin dashboard access
router.get('/nia-dashboard', protect, requireNIADashboardAccess, (req, res) => {
    res.json({
        success: true,
        message: 'NIA admin dashboard access granted',
        accessLevel: 'nia-dashboard',
        user: req.user,
        niaAdmin: req.niaAdmin ? {
            id: req.niaAdmin._id,
            status: req.niaAdmin.status
        } : null
    });
});

// Test surveyor dashboard access
router.get('/surveyor-dashboard', protect, requireSurveyorDashboardAccess, (req, res) => {
    res.json({
        success: true,
        message: 'Surveyor dashboard access granted',
        accessLevel: 'surveyor-dashboard',
        user: req.user,
        surveyor: req.surveyor ? {
            id: req.surveyor._id,
            organization: req.surveyor.organization,
            status: req.surveyor.status
        } : null
    });
});

// Test super admin access
router.get('/super-admin', protect, requireSuperAdminAccess, (req, res) => {
    res.json({
        success: true,
        message: 'Super admin access granted',
        accessLevel: 'super-admin',
        user: req.user
    });
});

// Test all access levels for current user
router.get('/access-levels', protect, (req, res) => {
    const accessLevels = {
        user: req.user.tokenType === 'user' || req.user.tokenType === 'super-admin',
        admin: req.user.tokenType === 'admin' || req.user.tokenType === 'super-admin',
        niaAdmin: req.user.tokenType === 'nia-admin' || req.user.tokenType === 'super-admin',
        surveyor: req.user.tokenType === 'surveyor' || req.user.tokenType === 'super-admin',
        superAdmin: req.user.tokenType === 'super-admin'
    };

    res.json({
        success: true,
        message: 'Access levels checked',
        user: req.user,
        accessLevels,
        dashboardAccess: {
            userDashboard: accessLevels.user,
            adminDashboard: accessLevels.admin,
            niaDashboard: accessLevels.niaAdmin,
            surveyorDashboard: accessLevels.surveyor
        }
    });
});

module.exports = router;
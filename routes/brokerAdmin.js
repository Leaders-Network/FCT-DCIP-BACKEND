const express = require('express');
const router = express.Router();
const { protect, requireBrokerAdminAccess, requireSuperAdminAccess } = require('../middlewares/authentication');
const { UnauthenticatedError } = require('../errors');
const { loginBrokerAdmin, verifyBrokerAdmin, logoutBrokerAdmin } = require('../controllers/brokerAuth');
const {
    getBrokerDashboardData,
    getAllClaims,
    getClaimById,
    updateClaimStatus,
    getClaimAnalytics
} = require('../controllers/brokerClaims');
const {
    getAllBrokerAdmins,
    getBrokerAdminById,
    createBrokerAdmin,
    updateBrokerAdmin,
    deleteBrokerAdmin,
    getBrokerAdminStats
} = require('../controllers/brokerAdminManagement');

// Authentication routes (no protection needed for login)
router.post('/auth/login', loginBrokerAdmin);

// Protected routes (require authentication and broker admin access)
router.get('/auth/verify', protect, requireBrokerAdminAccess, verifyBrokerAdmin);
router.post('/auth/logout', protect, requireBrokerAdminAccess, logoutBrokerAdmin);

// Dashboard routes
router.get('/dashboard', protect, requireBrokerAdminAccess, getBrokerDashboardData);

// Claims management routes
router.get('/claims', protect, requireBrokerAdminAccess, getAllClaims);
router.get('/claims/:claimId', protect, requireBrokerAdminAccess, getClaimById);
router.patch('/claims/:claimId/status', protect, requireBrokerAdminAccess, updateClaimStatus);

// Analytics routes
router.get('/analytics', protect, requireBrokerAdminAccess, getClaimAnalytics);

// Broker Admin Management routes (Super Admin or Broker Admin with management permissions)
const requireBrokerManagementAccess = (req, res, next) => {
    // Allow Super Admins
    if (req.user.role === 'Super-admin') {
        return next();
    }

    // Allow Broker Admins with canManageAdmins permission
    if (req.user.tokenType === 'broker-admin' && req.brokerAdmin) {
        if (req.brokerAdmin.permissions?.canManageAdmins === true) {
            return next();
        }
    }

    throw new UnauthenticatedError('Access denied. Broker admin management permission required.');
};

router.get('/management/stats', protect, requireBrokerManagementAccess, getBrokerAdminStats);
router.get('/management', protect, requireBrokerManagementAccess, getAllBrokerAdmins);
router.get('/management/:id', protect, requireBrokerManagementAccess, getBrokerAdminById);
router.post('/management', protect, requireBrokerManagementAccess, createBrokerAdmin);
router.patch('/management/:id', protect, requireBrokerManagementAccess, updateBrokerAdmin);
router.delete('/management/:id', protect, requireBrokerManagementAccess, deleteBrokerAdmin);

module.exports = router;

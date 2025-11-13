const express = require('express');
const router = express.Router();
const { protect, requireBrokerAdminAccess, requireSuperAdminAccess } = require('../middlewares/authentication');
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

// Broker Admin Management routes (Super Admin only)
router.get('/management/stats', protect, requireSuperAdminAccess, getBrokerAdminStats);
router.get('/management', protect, requireSuperAdminAccess, getAllBrokerAdmins);
router.get('/management/:id', protect, requireSuperAdminAccess, getBrokerAdminById);
router.post('/management', protect, requireSuperAdminAccess, createBrokerAdmin);
router.patch('/management/:id', protect, requireSuperAdminAccess, updateBrokerAdmin);
router.delete('/management/:id', protect, requireSuperAdminAccess, deleteBrokerAdmin);

module.exports = router;

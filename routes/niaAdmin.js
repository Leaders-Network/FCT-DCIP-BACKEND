const express = require('express');
const router = express.Router();
const {
    createNIAAdmin,
    getNIAAdmins,
    getNIAAdminById,
    updateNIAAdmin,
    deleteNIAAdmin,
    getNIADashboardData,
    updateNIAAdminLogin,
    checkNIAAdminPermission,
    getSurveyors
} = require('../controllers/niaAdmin');

const { protect } = require('../middlewares/authentication');
const {
    requireNIAAdmin,
    requireNIAPermission,
    requireAnyAdmin,
    logNIAAdminActivity
} = require('../middlewares/niaAuth');

// Apply basic authentication to all routes
router.use(protect);

// Create NIA admin (requires super admin or existing NIA admin with management permission)
router.post('/', requireAnyAdmin, logNIAAdminActivity('CREATE_NIA_ADMIN'), createNIAAdmin);

// Get all NIA admins (requires NIA admin access)
router.get('/', requireNIAAdmin, requireNIAPermission('canManageSurveyors'), getNIAAdmins);

// Get NIA dashboard data (requires NIA admin access)
router.get('/dashboard', requireNIAAdmin, logNIAAdminActivity('ACCESS_DASHBOARD'), getNIADashboardData);

// Get surveyors (requires NIA admin access)
router.get('/surveyors', requireNIAAdmin, requireNIAPermission('canManageSurveyors'), getSurveyors);

// Update login information (requires NIA admin access)
router.post('/login', requireNIAAdmin, updateNIAAdminLogin);

// Check specific permission (requires NIA admin access)
router.get('/permission/:permission', requireNIAAdmin, checkNIAAdminPermission);

// Get NIA admin by ID (requires NIA admin access)
router.get('/:adminId', requireNIAAdmin, requireNIAPermission('canManageSurveyors'), getNIAAdminById);

// Update NIA admin (requires NIA admin with management permission)
router.patch('/:adminId', requireNIAAdmin, requireNIAPermission('canManageSurveyors'), logNIAAdminActivity('UPDATE_NIA_ADMIN'), updateNIAAdmin);

// Delete NIA admin (requires NIA admin with management permission)
router.delete('/:adminId', requireNIAAdmin, requireNIAPermission('canManageSurveyors'), logNIAAdminActivity('DELETE_NIA_ADMIN'), deleteNIAAdmin);

module.exports = router;
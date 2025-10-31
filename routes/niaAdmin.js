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
    checkNIAAdminPermission
} = require('../controllers/niaAdmin');

const authenticateUser = require('../middlewares/authentication');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Create NIA admin
router.post('/', createNIAAdmin);

// Get all NIA admins
router.get('/', getNIAAdmins);

// Get NIA dashboard data
router.get('/dashboard', getNIADashboardData);

// Update login information
router.post('/login', updateNIAAdminLogin);

// Check specific permission
router.get('/permission/:permission', checkNIAAdminPermission);

// Get NIA admin by ID
router.get('/:adminId', getNIAAdminById);

// Update NIA admin
router.patch('/:adminId', updateNIAAdmin);

// Delete NIA admin
router.delete('/:adminId', deleteNIAAdmin);

module.exports = router;
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
    getSurveyors,
    createSurveyor,
    updateSurveyor,
    updateSurveyorStatus,
    deleteSurveyor
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

// Middleware to check if user is admin (AMMC or NIA)
const checkAdminAccess = (req, res, next) => {
    const isSuperAdmin = req.user.role === 'Super-admin';
    const isAMMCAdmin = req.user.role === 'Admin';
    const isNIAAdmin = req.user.tokenType === 'nia-admin' || req.niaAdmin;

    if (isSuperAdmin || isAMMCAdmin || isNIAAdmin) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: 'Admin access required (AMMC or NIA)'
    });
};

// Create NIA admin (requires super admin or existing NIA admin with management permission)
router.post('/', checkAdminAccess, logNIAAdminActivity('CREATE_NIA_ADMIN'), createNIAAdmin);

// Get all NIA admins (requires NIA admin access)
router.get('/', requireNIAAdmin, requireNIAPermission('canManageSurveyors'), getNIAAdmins);

// Get NIA dashboard data (requires NIA admin access)
router.get('/dashboard', requireNIAAdmin, logNIAAdminActivity('ACCESS_DASHBOARD'), getNIADashboardData);

// Get surveyors (requires NIA admin access)
router.get('/surveyors', requireNIAAdmin, requireNIAPermission('canManageSurveyors'), getSurveyors);

// Get available surveyors for assignment (requires NIA admin access)
router.get('/surveyors/available', requireNIAAdmin, async (req, res) => {
    try {
        const { specialization, location } = req.query;

        // Build filter for available NIA surveyors
        const filter = {
            organization: 'NIA',
            status: 'active',
            'profile.availability': 'available'
        };

        if (specialization && specialization !== 'all') {
            filter['profile.specialization'] = { $in: [specialization] };
        }

        // Get available surveyors with current assignment count
        const surveyors = await require('../models/Surveyor').find(filter)
            .populate('userId', 'firstname lastname email phonenumber employeeStatus')
            .lean();

        // Get current assignment counts for each surveyor
        const surveyorsWithAssignments = await Promise.all(
            surveyors.map(async (surveyor) => {
                const currentAssignments = await require('../models/Assignment').countDocuments({
                    surveyorId: surveyor.userId._id,
                    organization: 'NIA',
                    status: { $in: ['assigned', 'accepted', 'in-progress'] }
                });

                const completedSurveys = await require('../models/Assignment').countDocuments({
                    surveyorId: surveyor.userId._id,
                    organization: 'NIA',
                    status: 'completed'
                });

                return {
                    _id: surveyor.userId._id,
                    firstname: surveyor.userId.firstname,
                    lastname: surveyor.userId.lastname,
                    email: surveyor.userId.email,
                    phoneNumber: surveyor.userId.phonenumber,
                    specialization: surveyor.profile.specialization || [],
                    experience: surveyor.profile.experience || 0,
                    availability: surveyor.profile.availability,
                    currentAssignments: currentAssignments,
                    maxAssignments: 3, // Default max assignments
                    rating: surveyor.profile.rating || 4.0,
                    completedSurveys: completedSurveys,
                    licenseNumber: surveyor.licenseNumber,
                    address: surveyor.address,
                    emergencyContact: surveyor.emergencyContact
                };
            })
        );

        // Filter out overloaded surveyors (more than 3 active assignments)
        const availableSurveyors = surveyorsWithAssignments.filter(s => s.currentAssignments < 3);

        res.status(200).json({
            success: true,
            data: {
                surveyors: availableSurveyors
            }
        });
    } catch (error) {
        console.error('Get available surveyors error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get available surveyors',
            error: error.message
        });
    }
});

// Create surveyor (requires NIA admin access)
router.post('/surveyors', requireNIAAdmin, requireNIAPermission('canManageSurveyors'), logNIAAdminActivity('CREATE_SURVEYOR'), createSurveyor);

// Update surveyor (requires NIA admin access)
router.put('/surveyors/:surveyorId', requireNIAAdmin, requireNIAPermission('canManageSurveyors'), logNIAAdminActivity('UPDATE_SURVEYOR'), updateSurveyor);

// Update surveyor status (requires NIA admin access)
router.patch('/surveyors/:surveyorId/status', requireNIAAdmin, requireNIAPermission('canManageSurveyors'), logNIAAdminActivity('UPDATE_SURVEYOR_STATUS'), updateSurveyorStatus);

// Delete surveyor (requires NIA admin access)
router.delete('/surveyors/:surveyorId', requireNIAAdmin, requireNIAPermission('canManageSurveyors'), logNIAAdminActivity('DELETE_SURVEYOR'), deleteSurveyor);

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
const NIAAdmin = require('../models/NIAAdmin');
const Employee = require('../models/Employee');
const Surveyor = require('../models/Surveyor');
const DualAssignment = require('../models/DualAssignment');
const Assignment = require('../models/Assignment');
const { StatusCodes } = require('http-status-codes');

// Create NIA admin
const createNIAAdmin = async (req, res) => {
    try {
        const { userId, permissions, profile } = req.body;

        // Check if user exists
        const user = await Employee.findById(userId);
        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if NIA admin already exists for this user
        const existingAdmin = await NIAAdmin.findOne({ userId });
        if (existingAdmin) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: 'NIA admin already exists for this user'
            });
        }

        // Create NIA admin
        const niaAdmin = new NIAAdmin({
            userId,
            permissions: permissions || {},
            profile: profile || {},
            status: 'active'
        });

        await niaAdmin.save();

        // Populate user details
        await niaAdmin.populate('userId', 'firstname lastname email phonenumber');

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: 'NIA admin created successfully',
            data: niaAdmin
        });
    } catch (error) {
        console.error('Create NIA admin error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to create NIA admin',
            error: error.message
        });
    }
};

// Get all NIA admins
const getNIAAdmins = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;

        const filter = {};
        if (status) filter.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const niaAdmins = await NIAAdmin.find(filter)
            .populate('userId', 'firstname lastname email phonenumber employeeRole employeeStatus')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await NIAAdmin.countDocuments(filter);

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                niaAdmins,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get NIA admins error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get NIA admins',
            error: error.message
        });
    }
};

// Get NIA admin by ID
const getNIAAdminById = async (req, res) => {
    try {
        const { adminId } = req.params;

        const niaAdmin = await NIAAdmin.findById(adminId)
            .populate('userId', 'firstname lastname email phonenumber employeeRole employeeStatus');

        if (!niaAdmin) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'NIA admin not found'
            });
        }

        res.status(StatusCodes.OK).json({
            success: true,
            data: niaAdmin
        });
    } catch (error) {
        console.error('Get NIA admin error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get NIA admin',
            error: error.message
        });
    }
};

// Update NIA admin
const updateNIAAdmin = async (req, res) => {
    try {
        const { adminId } = req.params;
        const { permissions, profile, settings, status } = req.body;

        const niaAdmin = await NIAAdmin.findById(adminId);
        if (!niaAdmin) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'NIA admin not found'
            });
        }

        // Update fields
        if (permissions) niaAdmin.permissions = { ...niaAdmin.permissions, ...permissions };
        if (profile) niaAdmin.profile = { ...niaAdmin.profile, ...profile };
        if (settings) niaAdmin.settings = { ...niaAdmin.settings, ...settings };
        if (status) niaAdmin.status = status;

        await niaAdmin.save();
        await niaAdmin.populate('userId', 'firstname lastname email phonenumber');

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'NIA admin updated successfully',
            data: niaAdmin
        });
    } catch (error) {
        console.error('Update NIA admin error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to update NIA admin',
            error: error.message
        });
    }
};

// Delete NIA admin
const deleteNIAAdmin = async (req, res) => {
    try {
        const { adminId } = req.params;

        const niaAdmin = await NIAAdmin.findById(adminId);
        if (!niaAdmin) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'NIA admin not found'
            });
        }

        await NIAAdmin.findByIdAndDelete(adminId);

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'NIA admin deleted successfully'
        });
    } catch (error) {
        console.error('Delete NIA admin error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to delete NIA admin',
            error: error.message
        });
    }
};

// Get NIA admin dashboard data
const getNIADashboardData = async (req, res) => {
    try {
        console.log('=== NIA Dashboard Debug ===');
        console.log('req.user:', req.user);
        console.log('req.niaAdmin:', req.niaAdmin);

        const { userId } = req.user;
        console.log('Looking for NIAAdmin with userId:', userId);

        // Check if user is NIA admin
        const niaAdmin = await NIAAdmin.findOne({ userId, status: 'active' });
        console.log('Found NIAAdmin:', niaAdmin ? 'Yes' : 'No');

        if (!niaAdmin) {
            console.log('NIAAdmin not found for userId:', userId);
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied. NIA admin privileges required.'
            });
        }

        // Get NIA-specific statistics
        const [
            totalNIASurveyors,
            activeNIASurveyors,
            niaAssignments,
            recentNIAAssignments
        ] = await Promise.all([
            Surveyor.countDocuments({ organization: 'NIA' }),
            Surveyor.countDocuments({ organization: 'NIA', status: 'active' }),
            Assignment.countDocuments({ organization: 'NIA' }),
            Assignment.find({ organization: 'NIA' })
                .populate('ammcId', 'propertyDetails contactDetails')
                .populate('surveyorId', 'firstname lastname')
                .sort({ createdAt: -1 })
                .limit(5)
        ]);

        // Get assignment status breakdown
        const assignmentStats = await Assignment.aggregate([
            { $match: { organization: 'NIA' } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get dual assignment statistics
        const dualAssignmentStats = await DualAssignment.aggregate([
            {
                $group: {
                    _id: null,
                    totalDualAssignments: { $sum: 1 },
                    niaAssigned: {
                        $sum: { $cond: [{ $ne: ['$niaAssignmentId', null] }, 1, 0] }
                    },
                    fullyAssigned: {
                        $sum: { $cond: [{ $eq: ['$assignmentStatus', 'fully_assigned'] }, 1, 0] }
                    },
                    partiallyComplete: {
                        $sum: { $cond: [{ $eq: ['$completionStatus', 50] }, 1, 0] }
                    },
                    fullyComplete: {
                        $sum: { $cond: [{ $eq: ['$completionStatus', 100] }, 1, 0] }
                    }
                }
            }
        ]);

        const dashboardData = {
            overview: {
                totalNIASurveyors,
                activeNIASurveyors,
                niaAssignments,
                dualAssignments: dualAssignmentStats[0] || {
                    totalDualAssignments: 0,
                    niaAssigned: 0,
                    fullyAssigned: 0,
                    partiallyComplete: 0,
                    fullyComplete: 0
                }
            },
            assignmentStats: assignmentStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {}),
            recentAssignments: recentNIAAssignments,
            adminInfo: {
                name: `${niaAdmin.userId.firstname} ${niaAdmin.userId.lastname}`,
                permissions: niaAdmin.permissions,
                lastLogin: niaAdmin.lastLogin
            }
        };

        res.status(StatusCodes.OK).json({
            success: true,
            data: dashboardData
        });
    } catch (error) {
        console.error('Get NIA dashboard data error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get NIA dashboard data',
            error: error.message
        });
    }
};

// Update NIA admin login
const updateNIAAdminLogin = async (req, res) => {
    try {
        const { userId } = req.user;
        const { ipAddress, userAgent } = req.body;

        const niaAdmin = await NIAAdmin.findOne({ userId });
        if (!niaAdmin) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'NIA admin not found'
            });
        }

        niaAdmin.updateLastLogin(ipAddress, userAgent);
        await niaAdmin.save();

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Login updated successfully'
        });
    } catch (error) {
        console.error('Update NIA admin login error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to update login',
            error: error.message
        });
    }
};

// Get surveyors for NIA admin
const getSurveyors = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            availability,
            specialization,
            search
        } = req.query;

        // Mock data for development when database is not available
        const mockSurveyors = [
            {
                _id: '507f1f77bcf86cd799439011',
                userId: {
                    firstname: 'John',
                    lastname: 'Doe',
                    email: 'john.doe@nia.gov.ng',
                    phonenumber: '+234-801-234-5678'
                },
                profile: {
                    specialization: ['residential', 'commercial'],
                    availability: 'available',
                    experience: 5,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Wuse', 'Garki']
                    }
                },
                status: 'active',
                organization: 'NIA',
                rating: 4.5,
                assignmentStats: {
                    total: 25,
                    completed: 20,
                    inProgress: 3,
                    pending: 2
                },
                createdAt: new Date('2024-01-15')
            },
            {
                _id: '507f1f77bcf86cd799439012',
                userId: {
                    firstname: 'Jane',
                    lastname: 'Smith',
                    email: 'jane.smith@nia.gov.ng',
                    phonenumber: '+234-802-345-6789'
                },
                profile: {
                    specialization: ['industrial', 'agricultural'],
                    availability: 'busy',
                    experience: 8,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Maitama', 'Asokoro']
                    }
                },
                status: 'active',
                organization: 'NIA',
                rating: 4.8,
                assignmentStats: {
                    total: 40,
                    completed: 35,
                    inProgress: 4,
                    pending: 1
                },
                createdAt: new Date('2024-01-10')
            },
            {
                _id: '507f1f77bcf86cd799439013',
                userId: {
                    firstname: 'Michael',
                    lastname: 'Johnson',
                    email: 'michael.johnson@nia.gov.ng',
                    phonenumber: '+234-803-456-7890'
                },
                profile: {
                    specialization: ['residential'],
                    availability: 'available',
                    experience: 3,
                    location: {
                        state: 'FCT',
                        city: 'Abuja',
                        area: ['Kubwa', 'Nyanya']
                    }
                },
                status: 'active',
                organization: 'NIA',
                rating: 4.2,
                assignmentStats: {
                    total: 15,
                    completed: 12,
                    inProgress: 2,
                    pending: 1
                },
                createdAt: new Date('2024-02-01')
            }
        ];

        // Apply filters to mock data
        let filteredSurveyors = mockSurveyors;

        if (status && status !== 'all') {
            filteredSurveyors = filteredSurveyors.filter(s => s.status === status);
        }

        if (availability && availability !== 'all') {
            filteredSurveyors = filteredSurveyors.filter(s => s.profile.availability === availability);
        }

        if (specialization && specialization !== 'all') {
            filteredSurveyors = filteredSurveyors.filter(s =>
                s.profile.specialization.includes(specialization)
            );
        }

        if (search) {
            const searchLower = search.toLowerCase();
            filteredSurveyors = filteredSurveyors.filter(s =>
                s.userId.firstname.toLowerCase().includes(searchLower) ||
                s.userId.lastname.toLowerCase().includes(searchLower) ||
                s.userId.email.toLowerCase().includes(searchLower) ||
                s.userId.phonenumber.includes(search)
            );
        }

        // Pagination
        const total = filteredSurveyors.length;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const paginatedSurveyors = filteredSurveyors.slice(skip, skip + parseInt(limit));

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                surveyors: paginatedSurveyors,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get surveyors error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get surveyors',
            error: error.message
        });
    }
};

// Check NIA admin permissions
const checkNIAAdminPermission = async (req, res) => {
    try {
        const { userId } = req.user;
        const { permission } = req.params;

        const niaAdmin = await NIAAdmin.findOne({ userId, status: 'active' });
        if (!niaAdmin) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'NIA admin access required'
            });
        }

        const hasPermission = niaAdmin.hasPermission(permission);

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                hasPermission,
                permission,
                allPermissions: niaAdmin.permissions
            }
        });
    } catch (error) {
        console.error('Check NIA admin permission error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to check permission',
            error: error.message
        });
    }
};

module.exports = {
    createNIAAdmin,
    getNIAAdmins,
    getNIAAdminById,
    updateNIAAdmin,
    deleteNIAAdmin,
    getNIADashboardData,
    updateNIAAdminLogin,
    checkNIAAdminPermission,
    getSurveyors
};
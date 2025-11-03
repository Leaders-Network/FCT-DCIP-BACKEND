const NIAAdmin = require('../models/NIAAdmin');
const { Employee, Role, Status } = require('../models/Employee');
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

        // Build filter for NIA organization
        const filter = { organization: 'NIA' };

        if (status && status !== 'all') {
            filter.status = status;
        }

        if (availability && availability !== 'all') {
            filter['profile.availability'] = availability;
        }

        if (specialization && specialization !== 'all') {
            filter['profile.specialization'] = { $in: [specialization] };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get surveyors with populated user data
        const surveyors = await Surveyor.find(filter)
            .populate('userId', 'firstname lastname email phonenumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Surveyor.countDocuments(filter);

        // Get assignment statistics for each surveyor
        const surveyorsWithStats = await Promise.all(
            surveyors.map(async (surveyor) => {
                const assignmentStats = await Assignment.aggregate([
                    { $match: { surveyorId: surveyor.userId._id } },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]);

                const stats = assignmentStats.reduce((acc, stat) => {
                    acc[stat._id] = stat.count;
                    return acc;
                }, {});

                return {
                    ...surveyor.toObject(),
                    assignmentStats: {
                        total: Object.values(stats).reduce((sum, count) => sum + count, 0),
                        completed: stats.completed || 0,
                        inProgress: stats['in-progress'] || 0,
                        pending: stats.pending || 0
                    }
                };
            })
        );

        // Apply search filter to populated data
        let filteredSurveyors = surveyorsWithStats;
        if (search) {
            const searchLower = search.toLowerCase();
            filteredSurveyors = surveyorsWithStats.filter(s =>
                s.userId?.firstname?.toLowerCase().includes(searchLower) ||
                s.userId?.lastname?.toLowerCase().includes(searchLower) ||
                s.userId?.email?.toLowerCase().includes(searchLower) ||
                s.userId?.phonenumber?.includes(search) ||
                s.licenseNumber?.toLowerCase().includes(searchLower)
            );
        }

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                surveyors: filteredSurveyors,
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

// Create NIA surveyor
const createSurveyor = async (req, res) => {
    try {
        console.log('Create surveyor request body:', req.body);

        const {
            firstname,
            lastname,
            email,
            phonenumber,
            specializations,
            licenseNumber,
            address,
            emergencyContact,
            experience,
            location
        } = req.body;

        // Validate specializations
        const validSpecializations = ['residential', 'commercial', 'industrial', 'agricultural'];
        const invalidSpecs = specializations?.filter(spec => !validSpecializations.includes(spec));
        if (invalidSpecs && invalidSpecs.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: `Invalid specializations: ${invalidSpecs.join(', ')}. Valid options are: ${validSpecializations.join(', ')}`
            });
        }

        // Validate phone number format
        const phoneRegex = /^(?:\+234\d{10}|234\d{10}|0\d{10})$/;
        if (!phoneRegex.test(phonenumber)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Invalid phone number format. Use: +234xxxxxxxxxx, 234xxxxxxxxxx, or 0xxxxxxxxxx'
            });
        }

        // Check if user already exists
        const existingUser = await Employee.findOne({ email });
        if (existingUser) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Create employee record first
        const employee = new Employee({
            firstname,
            lastname,
            email,
            phonenumber,
            employeeRole: await Role.findOne({ role: 'Surveyor' }),
            employeeStatus: await Status.findOne({ status: 'Active' }),
            organization: 'NIA'
        });

        await employee.save();

        // Create surveyor profile
        const surveyor = new Surveyor({
            userId: employee._id,
            profile: {
                specialization: specializations || ['residential'],
                experience: experience || 0,
                location: location || {
                    state: 'FCT',
                    city: 'Abuja',
                    area: []
                },
                availability: 'available'
            },
            emergencyContact: emergencyContact || '',
            address: address || '',
            licenseNumber: licenseNumber || '',
            organization: 'NIA',
            status: 'active'
        });

        await surveyor.save();

        // Send credentials email to surveyor
        const sendEmail = require('../utils/sendEmail');
        const objectId = employee._id.toString();
        const credentialsHtml = `<div>
            <h2>Welcome to NIA DCIP Portal!</h2>
            <p>Your account has been created as a NIA surveyor.</p>
            <p><b>Email:</b> ${email}</p>
            <p><b>Default Password:</b> ${objectId}</p>
            <p>Please log in at <a href="http://localhost:3000/surveyor">http://localhost:3000/surveyor</a> and change your password after first login.</p>
            <p><b>Organization:</b> Nigerian Insurers Association (NIA)</p>
        </div>`;

        try {
            await sendEmail(email, 'NIA Surveyor Credentials', credentialsHtml);

            // Console log the email details for debugging
            console.log('📧 ===== NIA SURVEYOR EMAIL SENT =====');
            console.log('📧 To:', email);
            console.log('📧 Name:', `${firstname} ${lastname}`);
            console.log('📧 Default Password:', objectId);
            console.log('📧 Organization: NIA');
            console.log('📧 Login URL: http://localhost:3000/surveyor');
            console.log('📧 =====================================');

            // Send notification email to NIA admin
            const adminEmail = req.user?.email || process.env.ADMIN_EMAIL;
            if (adminEmail) {
                const adminHtml = `<div>
                    <h2>New NIA Surveyor Created</h2>
                    <p>A new NIA surveyor account has been created.</p>
                    <p><b>Surveyor Name:</b> ${firstname} ${lastname}</p>
                    <p><b>Surveyor Email:</b> ${email}</p>
                    <p><b>Default Password:</b> ${objectId}</p>
                    <p><b>Organization:</b> NIA</p>
                    <p><b>Specializations:</b> ${specializations?.join(', ') || 'residential'}</p>
                </div>`;
                await sendEmail(adminEmail, 'New NIA Surveyor Created', adminHtml);

                console.log('📧 Admin notification sent to:', adminEmail);
            }
        } catch (emailError) {
            console.error('📧 Failed to send email:', emailError);
            // Don't fail the surveyor creation if email fails
        }

        // Populate the response
        await surveyor.populate('userId', 'firstname lastname email phonenumber');

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: 'NIA surveyor created successfully',
            data: surveyor
        });
    } catch (error) {
        console.error('Create surveyor error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to create surveyor',
            error: error.message
        });
    }
};

// Update NIA surveyor
const updateSurveyor = async (req, res) => {
    try {
        const { surveyorId } = req.params;
        const updateData = req.body;

        const surveyor = await Surveyor.findById(surveyorId);
        if (!surveyor) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Surveyor not found'
            });
        }

        // Update surveyor fields
        Object.keys(updateData).forEach(key => {
            if (key === 'profile') {
                surveyor.profile = { ...surveyor.profile, ...updateData.profile };
            } else {
                surveyor[key] = updateData[key];
            }
        });

        await surveyor.save();
        await surveyor.populate('userId', 'firstname lastname email phonenumber');

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Surveyor updated successfully',
            data: surveyor
        });
    } catch (error) {
        console.error('Update surveyor error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to update surveyor',
            error: error.message
        });
    }
};

// Update surveyor status
const updateSurveyorStatus = async (req, res) => {
    try {
        const { surveyorId } = req.params;
        const { status } = req.body;

        const surveyor = await Surveyor.findById(surveyorId);
        if (!surveyor) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Surveyor not found'
            });
        }

        surveyor.status = status;
        await surveyor.save();

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Surveyor status updated successfully'
        });
    } catch (error) {
        console.error('Update surveyor status error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to update surveyor status',
            error: error.message
        });
    }
};

// Delete NIA surveyor
const deleteSurveyor = async (req, res) => {
    try {
        const { surveyorId } = req.params;

        // Check if surveyor exists
        const surveyor = await Surveyor.findById(surveyorId);
        if (!surveyor) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Surveyor not found'
            });
        }

        // Check if surveyor has active assignments
        const activeAssignments = await Assignment.countDocuments({
            surveyorId: surveyor.userId,
            status: { $in: ['assigned', 'in-progress'] }
        });

        if (activeAssignments > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: `Cannot delete surveyor with ${activeAssignments} active assignment(s). Please complete or reassign them first.`
            });
        }

        // Delete the surveyor profile
        await Surveyor.findByIdAndDelete(surveyorId);

        // Optionally, you might want to deactivate the employee instead of deleting
        // await Employee.findByIdAndUpdate(surveyor.userId, { 
        //     employeeStatus: await Status.findOne({ status: 'Inactive' })
        // });

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Surveyor deleted successfully'
        });
    } catch (error) {
        console.error('Delete surveyor error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to delete surveyor',
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
    getSurveyors,
    createSurveyor,
    updateSurveyor,
    updateSurveyorStatus,
    deleteSurveyor
};
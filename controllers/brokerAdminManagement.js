const { Employee, Role, Status } = require('../models/Employee');
const BrokerAdmin = require('../models/BrokerAdmin');
const { BadRequestError, NotFoundError } = require('../errors');

// Get all broker admins
const getAllBrokerAdmins = async (req, res) => {
    try {
        const {
            status = 'all',
            search,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = {};

        // Filter by status
        if (status && status !== 'all') {
            query.status = status;
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query with population
        let brokerAdminsQuery = BrokerAdmin.find(query)
            .populate({
                path: 'userId',
                select: 'firstname lastname email phonenumber organization'
            })
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        // Apply search if provided
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            brokerAdminsQuery = BrokerAdmin.find({
                ...query,
                $or: [
                    { brokerFirmName: searchRegex },
                    { brokerFirmLicense: searchRegex },
                    { 'profile.licenseNumber': searchRegex }
                ]
            })
                .populate({
                    path: 'userId',
                    match: {
                        $or: [
                            { firstname: searchRegex },
                            { lastname: searchRegex },
                            { email: searchRegex }
                        ]
                    },
                    select: 'firstname lastname email phonenumber organization'
                })
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit));
        }

        const [brokerAdmins, total] = await Promise.all([
            brokerAdminsQuery.lean(),
            BrokerAdmin.countDocuments(query)
        ]);

        // Filter out broker admins where userId didn't match search
        const filteredBrokerAdmins = search
            ? brokerAdmins.filter(ba => ba.userId !== null)
            : brokerAdmins;

        res.status(200).json({
            success: true,
            data: filteredBrokerAdmins,
            total: search ? filteredBrokerAdmins.length : total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil((search ? filteredBrokerAdmins.length : total) / parseInt(limit))
        });
    } catch (error) {
        console.error('Error fetching broker admins:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch broker admins',
            message: error.message
        });
    }
};

// Get broker admin by ID
const getBrokerAdminById = async (req, res) => {
    try {
        const { id } = req.params;

        const brokerAdmin = await BrokerAdmin.findById(id)
            .populate({
                path: 'userId',
                select: 'firstname lastname email phonenumber organization employeeRole employeeStatus',
                populate: [
                    { path: 'employeeRole', select: 'role' },
                    { path: 'employeeStatus', select: 'status' }
                ]
            })
            .lean();

        if (!brokerAdmin) {
            throw new NotFoundError('Broker admin not found');
        }

        res.status(200).json({
            success: true,
            data: brokerAdmin
        });
    } catch (error) {
        console.error('Error fetching broker admin:', error);

        if (error instanceof NotFoundError) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch broker admin',
                message: error.message
            });
        }
    }
};

// Create new broker admin
const createBrokerAdmin = async (req, res) => {
    try {
        const {
            firstname,
            lastname,
            email,
            phonenumber,
            password,
            brokerFirmName,
            brokerFirmLicense,
            licenseNumber,
            department,
            position,
            permissions,
            settings
        } = req.body;

        // Validate required fields
        if (!firstname || !lastname || !email || !phonenumber || !password) {
            throw new BadRequestError('Please provide all required employee fields');
        }

        if (!brokerFirmName || !brokerFirmLicense || !licenseNumber) {
            throw new BadRequestError('Please provide all required broker admin fields');
        }

        // Check if employee with email already exists
        const existingEmployee = await Employee.findOne({ email });
        if (existingEmployee) {
            throw new BadRequestError('Employee with this email already exists');
        }

        // Get Broker-Admin role and Active status
        let brokerRole = await Role.findOne({ role: 'Broker-Admin' });
        if (!brokerRole) {
            brokerRole = await Role.create({ role: 'Broker-Admin' });
        }

        let activeStatus = await Status.findOne({ status: 'Active' });
        if (!activeStatus) {
            activeStatus = await Status.create({ status: 'Active' });
        }

        // Create employee record
        const employee = new Employee({
            firstname,
            lastname,
            email,
            phonenumber,
            password,
            employeeRole: brokerRole._id,
            employeeStatus: activeStatus._id,
            organization: 'Broker'
        });

        await employee.save();

        // Create broker admin profile
        const brokerAdmin = new BrokerAdmin({
            userId: employee._id,
            organization: 'Broker',
            brokerFirmName,
            brokerFirmLicense,
            permissions: permissions || {
                canViewClaims: true,
                canUpdateClaimStatus: true,
                canViewReports: true,
                canAccessAnalytics: false
            },
            profile: {
                department: department || 'Claims Management',
                position: position || 'Broker Administrator',
                licenseNumber
            },
            settings: settings || {
                notifications: {
                    email: true,
                    sms: false
                },
                dashboard: {
                    defaultView: 'claims',
                    autoRefresh: true
                }
            },
            status: 'active'
        });

        await brokerAdmin.save();

        // Send credentials email
        const { sendBrokerAdminCredentials } = require('../services/emailService');
        const emailResult = await sendBrokerAdminCredentials({
            email: employee.email,
            firstname: employee.firstname,
            lastname: employee.lastname,
            password: employee._id.toString(), // The ObjectId is the password
            brokerFirmName,
            brokerFirmLicense
        });

        if (emailResult.success) {
            console.log('✅ Credentials email sent to:', employee.email);
            console.log('🔗 Preview URL:', emailResult.previewUrl);
        } else {
            console.error('⚠️ Failed to send credentials email:', emailResult.error);
        }

        // Populate and return the created broker admin
        const populatedBrokerAdmin = await BrokerAdmin.findById(brokerAdmin._id)
            .populate({
                path: 'userId',
                select: 'firstname lastname email phonenumber organization'
            })
            .lean();

        res.status(201).json({
            success: true,
            message: 'Broker admin created successfully',
            data: populatedBrokerAdmin,
            emailSent: emailResult.success,
            emailPreviewUrl: emailResult.previewUrl
        });
    } catch (error) {
        console.error('Error creating broker admin:', error);

        if (error instanceof BadRequestError) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        } else if (error.code === 11000) {
            res.status(400).json({
                success: false,
                error: 'Duplicate entry detected'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to create broker admin',
                message: error.message
            });
        }
    }
};

// Update broker admin
const updateBrokerAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Find broker admin
        const brokerAdmin = await BrokerAdmin.findById(id);
        if (!brokerAdmin) {
            throw new NotFoundError('Broker admin not found');
        }

        // Update broker admin fields
        const allowedUpdates = [
            'brokerFirmName',
            'brokerFirmLicense',
            'permissions',
            'profile',
            'settings',
            'status'
        ];

        allowedUpdates.forEach(field => {
            if (updates[field] !== undefined) {
                if (typeof updates[field] === 'object' && !Array.isArray(updates[field])) {
                    // Merge nested objects
                    brokerAdmin[field] = { ...brokerAdmin[field], ...updates[field] };
                } else {
                    brokerAdmin[field] = updates[field];
                }
            }
        });

        await brokerAdmin.save();

        // Update employee if needed
        if (updates.employee) {
            const employee = await Employee.findById(brokerAdmin.userId);
            if (employee) {
                const employeeUpdates = ['firstname', 'lastname', 'phonenumber'];
                employeeUpdates.forEach(field => {
                    if (updates.employee[field] !== undefined) {
                        employee[field] = updates.employee[field];
                    }
                });
                await employee.save();
            }
        }

        // Populate and return updated broker admin
        const updatedBrokerAdmin = await BrokerAdmin.findById(id)
            .populate({
                path: 'userId',
                select: 'firstname lastname email phonenumber organization'
            })
            .lean();

        res.status(200).json({
            success: true,
            message: 'Broker admin updated successfully',
            data: updatedBrokerAdmin
        });
    } catch (error) {
        console.error('Error updating broker admin:', error);

        if (error instanceof NotFoundError) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to update broker admin',
                message: error.message
            });
        }
    }
};

// Delete broker admin
const deleteBrokerAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const brokerAdmin = await BrokerAdmin.findById(id);
        if (!brokerAdmin) {
            throw new NotFoundError('Broker admin not found');
        }

        // Soft delete by setting status to inactive
        brokerAdmin.status = 'inactive';
        await brokerAdmin.save();

        // Also update employee status
        const employee = await Employee.findById(brokerAdmin.userId);
        if (employee) {
            const inactiveStatus = await Status.findOne({ status: 'Inactive' });
            if (inactiveStatus) {
                employee.employeeStatus = inactiveStatus._id;
                await employee.save();
            }
        }

        res.status(200).json({
            success: true,
            message: 'Broker admin deactivated successfully'
        });
    } catch (error) {
        console.error('Error deleting broker admin:', error);

        if (error instanceof NotFoundError) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to delete broker admin',
                message: error.message
            });
        }
    }
};

// Get broker admin statistics
const getBrokerAdminStats = async (req, res) => {
    try {
        const totalBrokerAdmins = await BrokerAdmin.countDocuments();
        const activeBrokerAdmins = await BrokerAdmin.countDocuments({ status: 'active' });
        const inactiveBrokerAdmins = await BrokerAdmin.countDocuments({ status: 'inactive' });
        const suspendedBrokerAdmins = await BrokerAdmin.countDocuments({ status: 'suspended' });

        // Get unique broker firms
        const brokerFirms = await BrokerAdmin.distinct('brokerFirmName');

        res.status(200).json({
            success: true,
            data: {
                total: totalBrokerAdmins,
                active: activeBrokerAdmins,
                inactive: inactiveBrokerAdmins,
                suspended: suspendedBrokerAdmins,
                totalFirms: brokerFirms.length
            }
        });
    } catch (error) {
        console.error('Error fetching broker admin stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics',
            message: error.message
        });
    }
};

module.exports = {
    getAllBrokerAdmins,
    getBrokerAdminById,
    createBrokerAdmin,
    updateBrokerAdmin,
    deleteBrokerAdmin,
    getBrokerAdminStats
};

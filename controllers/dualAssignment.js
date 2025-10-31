const DualAssignment = require('../models/DualAssignment');
const Assignment = require('../models/Assignment');
const PolicyRequest = require('../models/PolicyRequest');
const Employee = require('../models/Employee');
const Surveyor = require('../models/Surveyor');
const { StatusCodes } = require('http-status-codes');

// Create a new dual assignment
const createDualAssignment = async (req, res) => {
    try {
        const { policyId, priority = 'medium' } = req.body;

        // Check if policy exists
        const policy = await PolicyRequest.findById(policyId);
        if (!policy) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Policy request not found'
            });
        }

        // Check if dual assignment already exists
        const existingDualAssignment = await DualAssignment.findOne({ policyId });
        if (existingDualAssignment) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: 'Dual assignment already exists for this policy'
            });
        }

        // Create dual assignment
        const dualAssignment = new DualAssignment({
            policyId,
            priority,
            estimatedCompletion: {
                overallDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days default
            }
        });

        // Add creation timeline event
        dualAssignment.timeline.push({
            event: 'created',
            timestamp: new Date(),
            performedBy: req.user.userId,
            organization: 'SYSTEM',
            details: 'Dual assignment created for policy'
        });

        await dualAssignment.save();

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: 'Dual assignment created successfully',
            data: dualAssignment
        });
    } catch (error) {
        console.error('Create dual assignment error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to create dual assignment',
            error: error.message
        });
    }
};

// Assign AMMC surveyor to dual assignment
const assignAMMCSurveyor = async (req, res) => {
    try {
        const { dualAssignmentId } = req.params;
        const { surveyorId, deadline, instructions, priority } = req.body;

        // Find dual assignment
        const dualAssignment = await DualAssignment.findById(dualAssignmentId);
        if (!dualAssignment) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Dual assignment not found'
            });
        }

        // Check if AMMC surveyor already assigned
        if (dualAssignment.ammcAssignmentId) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: 'AMMC surveyor already assigned to this policy'
            });
        }

        // Get surveyor details
        const surveyor = await Surveyor.findOne({ userId: surveyorId, organization: 'AMMC' })
            .populate('userId', 'firstname lastname email phonenumber');

        if (!surveyor) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'AMMC surveyor not found'
            });
        }

        // Create AMMC assignment
        const assignment = new Assignment({
            ammcId: dualAssignment.policyId,
            surveyorId: surveyorId,
            assignedBy: req.user.userId,
            deadline: deadline || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            priority: priority || dualAssignment.priority,
            instructions: instructions || '',
            organization: 'AMMC',
            dualAssignmentId: dualAssignmentId
        });

        await assignment.save();

        // Update dual assignment with AMMC surveyor
        const surveyorContact = {
            surveyorId: surveyorId,
            name: `${surveyor.userId.firstname} ${surveyor.userId.lastname}`,
            email: surveyor.userId.email,
            phone: surveyor.userId.phonenumber
        };

        dualAssignment.assignAMMCSurveyor(assignment._id, surveyorContact, req.user.userId);
        await dualAssignment.save();

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'AMMC surveyor assigned successfully',
            data: {
                dualAssignment,
                assignment
            }
        });
    } catch (error) {
        console.error('Assign AMMC surveyor error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to assign AMMC surveyor',
            error: error.message
        });
    }
};

// Assign NIA surveyor to dual assignment
const assignNIASurveyor = async (req, res) => {
    try {
        const { dualAssignmentId } = req.params;
        const { surveyorId, deadline, instructions, priority } = req.body;

        // Find dual assignment
        const dualAssignment = await DualAssignment.findById(dualAssignmentId);
        if (!dualAssignment) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Dual assignment not found'
            });
        }

        // Check if NIA surveyor already assigned
        if (dualAssignment.niaAssignmentId) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: 'NIA surveyor already assigned to this policy'
            });
        }

        // Get surveyor details
        const surveyor = await Surveyor.findOne({ userId: surveyorId, organization: 'NIA' })
            .populate('userId', 'firstname lastname email phonenumber');

        if (!surveyor) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'NIA surveyor not found'
            });
        }

        // Create NIA assignment
        const assignment = new Assignment({
            ammcId: dualAssignment.policyId,
            surveyorId: surveyorId,
            assignedBy: req.user.userId,
            deadline: deadline || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            priority: priority || dualAssignment.priority,
            instructions: instructions || '',
            organization: 'NIA',
            dualAssignmentId: dualAssignmentId
        });

        await assignment.save();

        // Update dual assignment with NIA surveyor
        const surveyorContact = {
            surveyorId: surveyorId,
            name: `${surveyor.userId.firstname} ${surveyor.userId.lastname}`,
            email: surveyor.userId.email,
            phone: surveyor.userId.phonenumber
        };

        dualAssignment.assignNIASurveyor(assignment._id, surveyorContact, req.user.userId);
        await dualAssignment.save();

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'NIA surveyor assigned successfully',
            data: {
                dualAssignment,
                assignment
            }
        });
    } catch (error) {
        console.error('Assign NIA surveyor error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to assign NIA surveyor',
            error: error.message
        });
    }
};

// Get dual assignment by policy ID
const getDualAssignmentByPolicy = async (req, res) => {
    try {
        const { policyId } = req.params;

        const dualAssignment = await DualAssignment.findOne({ policyId })
            .populate('policyId')
            .populate('ammcAssignmentId')
            .populate('niaAssignmentId')
            .populate('ammcSurveyorContact.surveyorId', 'firstname lastname email phonenumber')
            .populate('niaSurveyorContact.surveyorId', 'firstname lastname email phonenumber');

        if (!dualAssignment) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Dual assignment not found for this policy'
            });
        }

        res.status(StatusCodes.OK).json({
            success: true,
            data: dualAssignment
        });
    } catch (error) {
        console.error('Get dual assignment error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get dual assignment',
            error: error.message
        });
    }
};

// Get all dual assignments with filters
const getDualAssignments = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            assignmentStatus,
            completionStatus,
            priority,
            organization
        } = req.query;

        const filter = {};

        if (assignmentStatus) filter.assignmentStatus = assignmentStatus;
        if (completionStatus) filter.completionStatus = parseInt(completionStatus);
        if (priority) filter.priority = priority;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const dualAssignments = await DualAssignment.find(filter)
            .populate('policyId', 'propertyDetails contactDetails status')
            .populate('ammcAssignmentId', 'status deadline priority')
            .populate('niaAssignmentId', 'status deadline priority')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await DualAssignment.countDocuments(filter);

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                dualAssignments,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get dual assignments error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get dual assignments',
            error: error.message
        });
    }
};

// Update dual assignment when report is submitted
const updateReportSubmission = async (req, res) => {
    try {
        const { dualAssignmentId } = req.params;
        const { organization, reportId } = req.body;

        const dualAssignment = await DualAssignment.findById(dualAssignmentId);
        if (!dualAssignment) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Dual assignment not found'
            });
        }

        // Update completion status
        dualAssignment.reportSubmitted(organization, reportId, req.user.userId);
        await dualAssignment.save();

        res.status(StatusCodes.OK).json({
            success: true,
            message: `${organization} report submission recorded`,
            data: {
                completionStatus: dualAssignment.completionStatus,
                assignmentStatus: dualAssignment.assignmentStatus,
                bothReportsSubmitted: dualAssignment.isBothReportsSubmitted()
            }
        });
    } catch (error) {
        console.error('Update report submission error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to update report submission',
            error: error.message
        });
    }
};

// Get surveyor contacts for a dual assignment
const getSurveyorContacts = async (req, res) => {
    try {
        const { dualAssignmentId } = req.params;

        const dualAssignment = await DualAssignment.findById(dualAssignmentId);
        if (!dualAssignment) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Dual assignment not found'
            });
        }

        const contacts = dualAssignment.getSurveyorContacts();

        res.status(StatusCodes.OK).json({
            success: true,
            data: contacts
        });
    } catch (error) {
        console.error('Get surveyor contacts error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get surveyor contacts',
            error: error.message
        });
    }
};

// Get dual assignment statistics
const getDualAssignmentStats = async (req, res) => {
    try {
        const { organization } = req.query;

        const pipeline = [
            {
                $group: {
                    _id: null,
                    totalAssignments: { $sum: 1 },
                    unassigned: {
                        $sum: { $cond: [{ $eq: ['$assignmentStatus', 'unassigned'] }, 1, 0] }
                    },
                    partiallyAssigned: {
                        $sum: { $cond: [{ $eq: ['$assignmentStatus', 'partially_assigned'] }, 1, 0] }
                    },
                    fullyAssigned: {
                        $sum: { $cond: [{ $eq: ['$assignmentStatus', 'fully_assigned'] }, 1, 0] }
                    },
                    notStarted: {
                        $sum: { $cond: [{ $eq: ['$completionStatus', 0] }, 1, 0] }
                    },
                    partiallyComplete: {
                        $sum: { $cond: [{ $eq: ['$completionStatus', 50] }, 1, 0] }
                    },
                    fullyComplete: {
                        $sum: { $cond: [{ $eq: ['$completionStatus', 100] }, 1, 0] }
                    },
                    overdue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $lt: ['$estimatedCompletion.overallDeadline', new Date()] },
                                        { $lt: ['$completionStatus', 100] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ];

        const stats = await DualAssignment.aggregate(pipeline);

        res.status(StatusCodes.OK).json({
            success: true,
            data: stats[0] || {
                totalAssignments: 0,
                unassigned: 0,
                partiallyAssigned: 0,
                fullyAssigned: 0,
                notStarted: 0,
                partiallyComplete: 0,
                fullyComplete: 0,
                overdue: 0
            }
        });
    } catch (error) {
        console.error('Get dual assignment stats error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get dual assignment statistics',
            error: error.message
        });
    }
};

module.exports = {
    createDualAssignment,
    assignAMMCSurveyor,
    assignNIASurveyor,
    getDualAssignmentByPolicy,
    getDualAssignments,
    updateReportSubmission,
    getSurveyorContacts,
    getDualAssignmentStats
};
const DualAssignment = require('../models/DualAssignment');
const Assignment = require('../models/Assignment');
const PolicyRequest = require('../models/PolicyRequest');
const { Employee } = require('../models/Employee');
const Surveyor = require('../models/Surveyor');
const { StatusCodes } = require('http-status-codes');
const {
    validateSurveyorAssignment,
    checkAssignmentConflicts,
    validateDualAssignmentCreation,
    getAvailableSurveyors
} = require('../utils/assignmentValidation');

// Create a new dual assignment
const createDualAssignment = async (req, res) => {
    try {
        const { policyId, priority = 'medium', deadline } = req.body;

        // Validate required fields
        if (!policyId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Policy ID is required'
            });
        }

        // Check if policy exists and is in correct status
        const policy = await PolicyRequest.findById(policyId);
        if (!policy) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Policy request not found'
            });
        }

        // Validate policy status - should be 'submitted' to create dual assignment
        if (policy.status !== 'submitted') {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: `Cannot create dual assignment for policy with status: ${policy.status}. Policy must be in 'submitted' status.`
            });
        }

        // Validate dual assignment creation
        const validationResult = await validateDualAssignmentCreation(policyId);
        if (!validationResult.success) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: validationResult.message,
                data: validationResult.existingAssignmentId ?
                    { existingAssignmentId: validationResult.existingAssignmentId } :
                    { existingAssignments: validationResult.existingAssignments }
            });
        }

        // Calculate deadline (default 7 days, but can be customized)
        const assignmentDeadline = deadline ? new Date(deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Validate deadline is in the future
        if (assignmentDeadline <= new Date()) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Deadline must be in the future'
            });
        }

        // Create dual assignment
        const dualAssignment = new DualAssignment({
            policyId,
            priority,
            estimatedCompletion: {
                overallDeadline: assignmentDeadline,
                ammcDeadline: assignmentDeadline,
                niaDeadline: assignmentDeadline
            }
        });

        // Add creation timeline event
        dualAssignment.timeline.push({
            event: 'created',
            timestamp: new Date(),
            performedBy: req.user.userId,
            organization: req.user.organization || 'SYSTEM',
            details: `Dual assignment created for policy by ${req.user.organization || 'system'} admin`,
            metadata: {
                policyId: policyId,
                priority: priority,
                deadline: assignmentDeadline
            }
        });

        await dualAssignment.save();

        // Update policy status to indicate dual assignment created
        policy.status = 'assigned';
        policy.statusHistory.push({
            status: 'assigned',
            changedBy: req.user.userId,
            changedAt: new Date(),
            reason: 'Dual assignment created - ready for AMMC and NIA surveyor assignment'
        });
        await policy.save();

        // Populate policy details for response
        await dualAssignment.populate('policyId', 'propertyDetails contactDetails status priority');

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: 'Dual assignment created successfully',
            data: {
                dualAssignment,
                nextSteps: [
                    'Assign AMMC surveyor using POST /:dualAssignmentId/assign-ammc',
                    'Assign NIA surveyor using POST /:dualAssignmentId/assign-nia'
                ]
            }
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

        // Validate required fields
        if (!surveyorId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Surveyor ID is required'
            });
        }

        // Check if AMMC surveyor already assigned
        if (dualAssignment.ammcAssignmentId) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: 'AMMC surveyor already assigned to this policy',
                data: { existingAssignmentId: dualAssignment.ammcAssignmentId }
            });
        }

        // Get surveyor details and validate
        const surveyor = await Surveyor.findOne({ userId: surveyorId, organization: 'AMMC', status: 'active' })
            .populate('userId', 'firstname lastname email phonenumber employeeStatus');

        if (!surveyor) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'AMMC surveyor not found or inactive'
            });
        }

        // Check if surveyor is available
        if (surveyor.profile.availability !== 'available') {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: `Surveyor is currently ${surveyor.profile.availability} and cannot be assigned`
            });
        }

        // Check for existing active assignments for this surveyor
        const existingAssignments = await Assignment.countDocuments({
            surveyorId: surveyorId,
            organization: 'AMMC',
            status: { $in: ['assigned', 'accepted', 'in-progress'] }
        });

        // Prevent overloading surveyor (max 3 active assignments)
        if (existingAssignments >= 3) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: 'Surveyor has reached maximum active assignments (3). Please assign to a different surveyor.'
            });
        }

        // Get complete surveyor contact information
        const AssignmentContactService = require('../services/AssignmentContactService');
        const surveyorContactInfo = await AssignmentContactService.getSurveyorContactInfo(surveyorId, 'AMMC');

        // Create AMMC assignment with surveyor contact details
        const assignment = new Assignment({
            ammcId: dualAssignment.policyId,
            surveyorId: surveyorId,
            assignedBy: req.user.userId,
            deadline: deadline || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            priority: priority || dualAssignment.priority,
            instructions: instructions || '',
            organization: 'AMMC',
            dualAssignmentId: dualAssignmentId,
            partnerSurveyorContact: surveyorContactInfo
        });

        await assignment.save();

        // Update dual assignment with AMMC surveyor contact details using the service
        const updatedDualAssignment = await AssignmentContactService.updateDualAssignmentContacts(
            dualAssignmentId,
            'AMMC',
            surveyorId,
            assignment._id,
            req.user.userId
        );

        // Update policy status to 'assigned' when first surveyor is assigned
        const policy = await PolicyRequest.findById(dualAssignment.policyId);
        if (policy && policy.status === 'submitted') {
            policy.status = 'assigned';
            policy.statusHistory.push({
                status: 'assigned',
                changedBy: req.user.userId,
                changedAt: new Date(),
                reason: 'AMMC surveyor assigned - policy now in assignment phase'
            });
            await policy.save();
        }

        // Notify the assigned surveyor
        try {
            const NotificationService = require('../services/NotificationService');
            await NotificationService.notifySurveyorOfAssignment(assignment, surveyorContactInfo, 'AMMC');
        } catch (notificationError) {
            console.error('Failed to notify AMMC surveyor:', notificationError);
            // Don't fail the assignment if notification fails
        }

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'AMMC surveyor assigned successfully',
            data: {
                dualAssignment: updatedDualAssignment,
                assignment,
                contactsUpdated: true,
                bothAssigned: updatedDualAssignment.isBothAssigned()
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

        console.log('🎯 NIA Assignment Request:', {
            dualAssignmentId,
            surveyorId,
            requestTime: new Date().toISOString(),
            userAgent: req.headers['user-agent']?.substring(0, 50)
        });

        // Find dual assignment with atomic check and update
        const dualAssignment = await DualAssignment.findOneAndUpdate(
            {
                _id: dualAssignmentId,
                niaAssignmentId: null // Only update if NIA surveyor not already assigned
            },
            {
                $set: {
                    _tempNiaLock: new Date() // Temporary lock to prevent race conditions
                }
            },
            {
                new: false, // Return original document
                runValidators: true
            }
        );

        if (!dualAssignment) {
            // Check if it's because assignment doesn't exist or NIA already assigned
            const existingAssignment = await DualAssignment.findById(dualAssignmentId);
            if (!existingAssignment) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    success: false,
                    message: 'Dual assignment not found'
                });
            } else if (existingAssignment.niaAssignmentId) {
                console.log('⚠️ NIA surveyor already assigned:', {
                    dualAssignmentId: dualAssignmentId,
                    existingNiaAssignmentId: existingAssignment.niaAssignmentId,
                    requestedSurveyorId: surveyorId,
                    timestamp: new Date().toISOString()
                });

                // Check if the existing assignment is the same surveyor
                const existingNiaAssignment = await Assignment.findById(existingAssignment.niaAssignmentId);
                if (existingNiaAssignment && existingNiaAssignment.surveyorId.toString() === surveyorId) {
                    console.log('✅ Same surveyor already assigned, returning success');
                    return res.status(StatusCodes.OK).json({
                        success: true,
                        message: 'NIA surveyor already assigned (same surveyor)',
                        data: {
                            dualAssignment: existingAssignment,
                            assignment: existingNiaAssignment,
                            contactsUpdated: false,
                            bothAssigned: existingAssignment.isBothAssigned()
                        }
                    });
                }

                return res.status(StatusCodes.CONFLICT).json({
                    success: false,
                    message: 'NIA surveyor already assigned to this policy',
                    data: { existingAssignmentId: existingAssignment.niaAssignmentId }
                });
            }
        }

        // Validate required fields
        if (!surveyorId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Surveyor ID is required'
            });
        }

        // Get surveyor details and validate
        const surveyor = await Surveyor.findOne({ userId: surveyorId, organization: 'NIA', status: 'active' })
            .populate('userId', 'firstname lastname email phonenumber employeeStatus');

        if (!surveyor) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'NIA surveyor not found or inactive'
            });
        }

        // Check if surveyor is available
        if (surveyor.profile.availability !== 'available') {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: `Surveyor is currently ${surveyor.profile.availability} and cannot be assigned`
            });
        }

        // Check for existing active assignments for this surveyor
        const existingAssignments = await Assignment.countDocuments({
            surveyorId: surveyorId,
            organization: 'NIA',
            status: { $in: ['assigned', 'accepted', 'in-progress'] }
        });

        // Prevent overloading surveyor (max 3 active assignments)
        if (existingAssignments >= 3) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: 'Surveyor has reached maximum active assignments (3). Please assign to a different surveyor.'
            });
        }

        // Get complete surveyor contact information
        const AssignmentContactService = require('../services/AssignmentContactService');
        const surveyorContactInfo = await AssignmentContactService.getSurveyorContactInfo(surveyorId, 'NIA');

        // Create NIA assignment with surveyor contact details
        const assignment = new Assignment({
            ammcId: dualAssignment.policyId,
            surveyorId: surveyorId,
            assignedBy: req.user.userId,
            deadline: deadline || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            priority: priority || dualAssignment.priority,
            instructions: instructions || '',
            organization: 'NIA',
            dualAssignmentId: dualAssignmentId,
            partnerSurveyorContact: surveyorContactInfo
        });

        await assignment.save();

        // Update dual assignment with NIA surveyor contact details using the service
        const updatedDualAssignment = await AssignmentContactService.updateDualAssignmentContacts(
            dualAssignmentId,
            'NIA',
            surveyorId,
            assignment._id,
            req.user.userId
        );

        // Update policy status to 'assigned' when first surveyor is assigned
        const policy = await PolicyRequest.findById(dualAssignment.policyId);
        if (policy && policy.status === 'submitted') {
            policy.status = 'assigned';
            policy.statusHistory.push({
                status: 'assigned',
                changedBy: req.user.userId,
                changedAt: new Date(),
                reason: 'NIA surveyor assigned - policy now in assignment phase'
            });
            await policy.save();
        }

        // Notify the assigned surveyor
        try {
            const NotificationService = require('../services/NotificationService');
            await NotificationService.notifySurveyorOfAssignment(assignment, surveyorContactInfo, 'NIA');
        } catch (notificationError) {
            console.error('Failed to notify NIA surveyor:', notificationError);
            // Don't fail the assignment if notification fails
        }

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'NIA surveyor assigned successfully',
            data: {
                dualAssignment: updatedDualAssignment,
                assignment,
                contactsUpdated: true,
                bothAssigned: updatedDualAssignment.isBothAssigned()
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
        console.log('📋 Get Dual Assignments - Request from:', req.user?.organization, 'admin');
        console.log('📋 Query params:', req.query);

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

        console.log('📋 Applied filters:', filter);

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const dualAssignments = await DualAssignment.find(filter)
            .populate('policyId', 'propertyDetails contactDetails status')
            .populate('ammcAssignmentId', 'status deadline priority')
            .populate('niaAssignmentId', 'status deadline priority')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        console.log('📋 Found dual assignments:', dualAssignments.length);

        // Debug: Log assignment details
        dualAssignments.forEach((assignment, index) => {
            console.log(`📋 Assignment ${index + 1}:`, {
                id: assignment._id.toString().slice(-6),
                status: assignment.assignmentStatus,
                completion: assignment.completionStatus,
                hasAMMC: !!assignment.ammcSurveyorContact,
                hasNIA: !!assignment.niaSurveyorContact,
                ammcName: assignment.ammcSurveyorContact?.name,
                niaName: assignment.niaSurveyorContact?.name
            });
        });

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
            },
            debug: {
                requestedBy: req.user?.organization,
                filtersApplied: filter,
                totalFound: dualAssignments.length
            }
        });
    } catch (error) {
        console.error('❌ Get dual assignments error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get dual assignments',
            error: error.message,
            debug: {
                requestedBy: req.user?.organization,
                errorType: error.name,
                errorMessage: error.message
            }
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
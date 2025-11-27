const Assignment = require('../models/Assignment');
const Surveyor = require('../models/Surveyor');
const DualAssignment = require('../models/DualAssignment');

/**
 * Validates if a surveyor can be assigned to a dual assignment
 * @param {string} surveyorId - The surveyor's user ID
 * @param {string} organization - 'AMMC' or 'NIA'
 * @param {string} dualAssignmentId - The dual assignment ID
 * @returns {Object} Validation result with success flag and message
 */
const validateSurveyorAssignment = async (surveyorId, organization, dualAssignmentId) => {
    try {
        // Check if surveyor exists and is active
        const surveyor = await Surveyor.findOne({
            userId: surveyorId,
            organization: organization,
            status: 'active'
        }).populate('userId', 'firstname lastname email phonenumber employeeStatus');

        if (!surveyor) {
            return {
                success: false,
                message: `${organization} surveyor not found or inactive`
            };
        }

        // Check if surveyor's employee status is active
        if (surveyor.userId.employeeStatus?.status !== 'Active') {
            return {
                success: false,
                message: `Surveyor's employee status is ${surveyor.userId.employeeStatus?.status}. Only active employees can be assigned.`
            };
        }

        // Check if surveyor is available
        if (surveyor.profile.availability !== 'available') {
            return {
                success: false,
                message: `Surveyor is currently ${surveyor.profile.availability} and cannot be assigned`
            };
        }

        // Check for existing active assignments for this surveyor
        const existingAssignments = await Assignment.countDocuments({
            surveyorId: surveyorId,
            organization: organization,
            status: { $in: ['assigned', 'accepted', 'in-progress'] }
        });

        // Prevent overloading surveyor (max 3 active assignments)
        if (existingAssignments >= 3) {
            return {
                success: false,
                message: 'Surveyor has reached maximum active assignments (3). Please assign to a different surveyor.'
            };
        }

        // Check if surveyor is already assigned to this specific policy through another dual assignment
        const dualAssignment = await DualAssignment.findById(dualAssignmentId);
        if (!dualAssignment) {
            return {
                success: false,
                message: 'Dual assignment not found'
            };
        }

        // Check if surveyor is already assigned to the same policy in a different context
        const existingPolicyAssignment = await Assignment.findOne({
            ammcId: dualAssignment.policyId,
            surveyorId: surveyorId,
            organization: organization,
            status: { $in: ['assigned', 'accepted', 'in-progress', 'completed'] }
        });

        if (existingPolicyAssignment && existingPolicyAssignment.dualAssignmentId?.toString() !== dualAssignmentId) {
            return {
                success: false,
                message: `Surveyor is already assigned to this policy in another assignment context`
            };
        }

        return {
            success: true,
            message: 'Surveyor can be assigned',
            surveyor: surveyor
        };

    } catch (error) {
        console.error('Surveyor assignment validation error:', error);
        return {
            success: false,
            message: 'Failed to validate surveyor assignment',
            error: error.message
        };
    }
};

/**
 * Checks for assignment conflicts within the same organization
 * @param {string} policyId - The policy ID
 * @param {string} organization - 'AMMC' or 'NIA'
 * @param {string} excludeAssignmentId - Assignment ID to exclude from conflict check
 * @returns {Object} Conflict check result
 */
const checkAssignmentConflicts = async (policyId, organization, excludeAssignmentId = null) => {
    try {
        const conflictQuery = {
            ammcId: policyId,
            organization: organization,
            status: { $in: ['assigned', 'accepted', 'in-progress'] }
        };

        if (excludeAssignmentId) {
            conflictQuery._id = { $ne: excludeAssignmentId };
        }

        const conflictingAssignments = await Assignment.find(conflictQuery)
            .populate('surveyorId', 'firstname lastname email');

        if (conflictingAssignments.length > 0) {
            return {
                hasConflict: true,
                message: `Policy already has active ${organization} assignment(s)`,
                conflictingAssignments: conflictingAssignments.map(assignment => ({
                    assignmentId: assignment._id,
                    surveyorName: `${assignment.surveyorId.firstname} ${assignment.surveyorId.lastname}`,
                    status: assignment.status,
                    assignedAt: assignment.assignedAt
                }))
            };
        }

        return {
            hasConflict: false,
            message: 'No assignment conflicts found'
        };

    } catch (error) {
        console.error('Assignment conflict check error:', error);
        return {
            hasConflict: true,
            message: 'Failed to check for assignment conflicts',
            error: error.message
        };
    }
};

/**
 * Validates dual assignment creation
 * @param {string} policyId - The policy ID
 * @returns {Object} Validation result
 */
const validateDualAssignmentCreation = async (policyId) => {
    try {
        // Check if dual assignment already exists
        const existingDualAssignment = await DualAssignment.findOne({ policyId });
        if (existingDualAssignment) {
            return {
                success: false,
                message: 'Dual assignment already exists for this policy',
                existingAssignmentId: existingDualAssignment._id
            };
        }

        // Check for any existing assignments that might conflict
        const existingAssignments = await Assignment.find({
            ammcId: policyId,
            status: { $in: ['assigned', 'accepted', 'in-progress'] }
        });

        if (existingAssignments.length > 0) {
            return {
                success: false,
                message: 'Policy has existing active assignments. Please complete or cancel them before creating dual assignment.',
                existingAssignments: existingAssignments.map(assignment => ({
                    assignmentId: assignment._id,
                    organization: assignment.organization,
                    status: assignment.status
                }))
            };
        }

        return {
            success: true,
            message: 'Policy is ready for dual assignment creation'
        };

    } catch (error) {
        console.error('Dual assignment creation validation error:', error);
        return {
            success: false,
            message: 'Failed to validate dual assignment creation',
            error: error.message
        };
    }
};

/**
 * Gets available surveyors for assignment
 * @param {string} organization - 'AMMC' or 'NIA'
 * @param {Object} filters - Optional filters (specialization, location, etc.)
 * @returns {Array} Available surveyors
 */
const getAvailableSurveyors = async (organization, filters = {}) => {
    try {
        const query = {
            organization: organization,
            status: 'active',
            'profile.availability': 'available'
        };

        // Add optional filters
        if (filters.specialization) {
            query['profile.specialization'] = { $in: [filters.specialization] };
        }

        if (filters.location) {
            query['profile.location.state'] = filters.location;
        }

        const surveyors = await Surveyor.find(query)
            .populate('userId', 'firstname lastname email phonenumber employeeStatus')
            .lean();

        // Filter out surveyors with too many active assignments
        const availableSurveyors = [];

        for (const surveyor of surveyors) {
            // Check employee status
            if (surveyor.userId.employeeStatus?.status !== 'Active') {
                continue;
            }

            // Check active assignment count
            const activeAssignments = await Assignment.countDocuments({
                surveyorId: surveyor.userId._id,
                organization: organization,
                status: { $in: ['assigned', 'accepted', 'in-progress'] }
            });

            if (activeAssignments < 3) { // Max 3 active assignments
                availableSurveyors.push({
                    ...surveyor,
                    activeAssignments: activeAssignments,
                    capacity: `${activeAssignments}/3`
                });
            }
        }

        return availableSurveyors;

    } catch (error) {
        console.error('Get available surveyors error:', error);
        return [];
    }
};

module.exports = {
    validateSurveyorAssignment,
    checkAssignmentConflicts,
    validateDualAssignmentCreation,
    getAvailableSurveyors
};
const Assignment = require('../models/Assignment');
const DualAssignment = require('../models/DualAssignment');
const AssignmentContactService = require('../services/AssignmentContactService');

/**
 * Middleware to ensure assignment has up-to-date partner contact information
 */
const ensurePartnerContactInfo = async (req, res, next) => {
    try {
        const { assignmentId } = req.params;

        if (!assignmentId) {
            return next();
        }

        // Get the assignment
        const assignment = await Assignment.findById(assignmentId);

        if (!assignment || !assignment.dualAssignmentId) {
            return next();
        }

        // Check if partner contact info needs updating
        const shouldUpdate = !assignment.partnerSurveyorContact ||
            !assignment.partnerSurveyorContact.email ||
            !assignment.partnerSurveyorContact.licenseNumber;

        if (shouldUpdate) {
            try {
                // Get dual assignment details
                const dualAssignment = await DualAssignment.findById(assignment.dualAssignmentId);

                if (dualAssignment) {
                    // Determine which is the partner surveyor
                    const currentOrganization = assignment.organization || 'AMMC';
                    const partnerContact = currentOrganization === 'AMMC'
                        ? dualAssignment.niaSurveyorContact
                        : dualAssignment.ammcSurveyorContact;

                    if (partnerContact && partnerContact.surveyorId) {
                        // Update assignment with partner contact info
                        await AssignmentContactService.updateAssignmentWithPartnerContact(
                            assignmentId,
                            partnerContact
                        );

                        console.log(`Updated partner contact info for assignment ${assignmentId}`);
                    }
                }
            } catch (updateError) {
                console.error('Error updating partner contact info:', updateError);
                // Don't fail the request if contact update fails
            }
        }

        next();
    } catch (error) {
        console.error('Assignment contact middleware error:', error);
        // Don't fail the request if middleware fails
        next();
    }
};

/**
 * Middleware to populate dual assignment information in assignment responses
 */
const populateDualAssignmentInfo = async (req, res, next) => {
    // Store original json method
    const originalJson = res.json;

    // Override json method to modify response
    res.json = function (data) {
        // Check if this is a successful assignment response
        if (data && data.success && data.data && data.data._id) {
            const assignment = data.data;

            // If assignment has dual assignment ID, enhance the response
            if (assignment.dualAssignmentId) {
                // Add a flag to indicate this is a dual assignment
                assignment.isDualSurveyor = true;

                // If partner contact info exists, format it properly
                if (assignment.partnerSurveyorContact) {
                    assignment.dualAssignmentInfo = {
                        otherSurveyor: {
                            ...assignment.partnerSurveyorContact,
                            organization: assignment.partnerSurveyorContact.organization
                        }
                    };
                }
            }
        }

        // Call original json method
        originalJson.call(this, data);
    };

    next();
};

module.exports = {
    ensurePartnerContactInfo,
    populateDualAssignmentInfo
};
const { Employee } = require('../models/Employee');
const Surveyor = require('../models/Surveyor');
const DualAssignment = require('../models/DualAssignment');
const Assignment = require('../models/Assignment');

class AssignmentContactService {
    /**
     * Get complete surveyor contact information
     * @param {string} surveyorId - The surveyor's user ID
     * @param {string} organization - 'AMMC' or 'NIA'
     * @returns {Object} Complete contact information
     */
    async getSurveyorContactInfo(surveyorId, organization) {
        try {
            // Get surveyor details with user information
            const surveyor = await Surveyor.findOne({
                userId: surveyorId,
                organization: organization,
                status: 'active'
            }).populate('userId', 'firstname lastname email phonenumber employeeStatus');

            if (!surveyor) {
                throw new Error(`${organization} surveyor not found or inactive`);
            }

            // Build comprehensive contact information
            const contactInfo = {
                surveyorId: surveyorId,
                name: `${surveyor.userId.firstname} ${surveyor.userId.lastname}`,
                email: surveyor.userId.email,
                phone: surveyor.userId.phonenumber,
                licenseNumber: surveyor.licenseNumber || 'Not provided',
                address: surveyor.address || 'Not provided',
                emergencyContact: surveyor.emergencyContact || 'Not provided',
                specialization: surveyor.profile.specialization || [],
                experience: surveyor.profile.experience || 0,
                rating: surveyor.rating || 0,
                availability: surveyor.profile.availability || 'available',
                organization: organization,
                assignedAt: new Date()
            };

            return contactInfo;
        } catch (error) {
            console.error('Error getting surveyor contact info:', error);
            throw error;
        }
    }

    /**
     * Update dual assignment with surveyor contact details
     * @param {string} dualAssignmentId - The dual assignment ID
     * @param {string} organization - 'AMMC' or 'NIA'
     * @param {string} surveyorId - The surveyor's user ID
     * @param {string} assignmentId - The individual assignment ID
     * @param {string} assignedBy - Who assigned the surveyor
     */
    async updateDualAssignmentContacts(dualAssignmentId, organization, surveyorId, assignmentId, assignedBy) {
        try {
            const dualAssignment = await DualAssignment.findById(dualAssignmentId);
            if (!dualAssignment) {
                throw new Error('Dual assignment not found');
            }

            // Get complete contact information
            const contactInfo = await this.getSurveyorContactInfo(surveyorId, organization);

            // Update the appropriate surveyor contact
            if (organization === 'AMMC') {
                dualAssignment.assignAMMCSurveyor(assignmentId, contactInfo, assignedBy);
            } else if (organization === 'NIA') {
                dualAssignment.assignNIASurveyor(assignmentId, contactInfo, assignedBy);
            }

            await dualAssignment.save();

            // Update individual assignments with partner contact information if both are assigned
            if (dualAssignment.isBothAssigned()) {
                await this.updatePartnerContactsInAssignments(dualAssignment);
                await this.notifyBothSurveyorsAssigned(dualAssignment);
            }

            return dualAssignment;
        } catch (error) {
            console.error('Error updating dual assignment contacts:', error);
            throw error;
        }
    }

    /**
     * Update individual assignments with partner surveyor contact information
     * @param {Object} dualAssignment - The dual assignment object
     */
    async updatePartnerContactsInAssignments(dualAssignment) {
        try {
            // Update AMMC assignment with NIA surveyor contact
            if (dualAssignment.ammcAssignmentId && dualAssignment.niaSurveyorContact) {
                await this.updateAssignmentWithPartnerContact(
                    dualAssignment.ammcAssignmentId,
                    dualAssignment.niaSurveyorContact
                );
            }

            // Update NIA assignment with AMMC surveyor contact
            if (dualAssignment.niaAssignmentId && dualAssignment.ammcSurveyorContact) {
                await this.updateAssignmentWithPartnerContact(
                    dualAssignment.niaAssignmentId,
                    dualAssignment.ammcSurveyorContact
                );
            }
        } catch (error) {
            console.error('Error updating partner contacts in assignments:', error);
            throw error;
        }
    }

    /**
     * Notify both surveyors when they are both assigned
     * @param {Object} dualAssignment - The dual assignment object
     */
    async notifyBothSurveyorsAssigned(dualAssignment) {
        try {
            const DualSurveyorNotificationService = require('./DualSurveyorNotificationService');

            // Prepare notification data
            const notificationData = {
                dualAssignmentId: dualAssignment._id,
                policyId: dualAssignment.policyId,
                ammcSurveyor: dualAssignment.ammcSurveyorContact,
                niaSurveyor: dualAssignment.niaSurveyorContact,
                assignmentStatus: dualAssignment.assignmentStatus,
                priority: dualAssignment.priority,
                deadline: dualAssignment.estimatedCompletion.overallDeadline
            };

            // Send notifications to both surveyors
            const notifications = [];

            // Notify AMMC surveyor about NIA surveyor
            if (dualAssignment.ammcSurveyorContact?.surveyorId) {
                try {
                    const ammcNotification = await this.sendSurveyorAssignmentNotification(
                        dualAssignment.ammcSurveyorContact.surveyorId,
                        'AMMC',
                        dualAssignment.niaSurveyorContact,
                        notificationData
                    );
                    notifications.push(ammcNotification);
                } catch (error) {
                    console.error('Failed to notify AMMC surveyor:', error);
                }
            }

            // Notify NIA surveyor about AMMC surveyor
            if (dualAssignment.niaSurveyorContact?.surveyorId) {
                try {
                    const niaNotification = await this.sendSurveyorAssignmentNotification(
                        dualAssignment.niaSurveyorContact.surveyorId,
                        'NIA',
                        dualAssignment.ammcSurveyorContact,
                        notificationData
                    );
                    notifications.push(niaNotification);
                } catch (error) {
                    console.error('Failed to notify NIA surveyor:', error);
                }
            }

            return notifications;
        } catch (error) {
            console.error('Error notifying both surveyors assigned:', error);
            throw error;
        }
    }

    /**
     * Send assignment notification to a surveyor
     * @param {string} surveyorId - The surveyor's user ID
     * @param {string} surveyorOrganization - The surveyor's organization
     * @param {Object} partnerSurveyorContact - The partner surveyor's contact info
     * @param {Object} assignmentData - Assignment details
     */
    async sendSurveyorAssignmentNotification(surveyorId, surveyorOrganization, partnerSurveyorContact, assignmentData) {
        try {
            const surveyor = await Employee.findById(surveyorId);
            if (!surveyor || !surveyor.email) {
                console.log('Surveyor email not found for notification');
                return null;
            }

            const partnerOrganization = surveyorOrganization === 'AMMC' ? 'NIA' : 'AMMC';

            // Generate email content
            const emailContent = this.generateAssignmentNotificationEmail({
                recipientName: `${surveyor.firstname} ${surveyor.lastname}`,
                recipientOrganization: surveyorOrganization,
                partnerSurveyor: partnerSurveyorContact,
                partnerOrganization: partnerOrganization,
                assignmentData: assignmentData
            });

            // Send email using the notification service
            const DualSurveyorNotificationService = require('./DualSurveyorNotificationService');
            await DualSurveyorNotificationService.sendEmail({
                to: surveyor.email,
                subject: `Dual Survey Assignment - Partner ${partnerOrganization} Surveyor Assigned`,
                html: emailContent
            });

            return {
                success: true,
                surveyorId: surveyorId,
                organization: surveyorOrganization,
                email: surveyor.email,
                partnerOrganization: partnerOrganization
            };
        } catch (error) {
            console.error('Error sending surveyor assignment notification:', error);
            throw error;
        }
    }

    /**
     * Generate assignment notification email content
     */
    generateAssignmentNotificationEmail({
        recipientName,
        recipientOrganization,
        partnerSurveyor,
        partnerOrganization,
        assignmentData
    }) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Dual Survey Assignment - Partner Surveyor Assigned</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h1 style="margin: 0; font-size: 24px;">🤝 Dual Survey Assignment</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your partner surveyor has been assigned</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2 style="color: #495057; margin-top: 0;">Hello ${recipientName},</h2>
                        <p>You have been assigned to a dual survey with a ${partnerOrganization} surveyor. Both organizations will work together to complete this property assessment.</p>
                        
                        <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h3 style="margin-top: 0; color: #4f46e5;">Your Assignment Details</h3>
                            <p><strong>Your Organization:</strong> ${recipientOrganization}</p>
                            <p><strong>Partner Organization:</strong> ${partnerOrganization}</p>
                            <p><strong>Assignment Priority:</strong> ${assignmentData.priority}</p>
                            <p><strong>Deadline:</strong> ${new Date(assignmentData.deadline).toLocaleDateString()}</p>
                        </div>
                        
                        <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h3 style="margin-top: 0; color: #7c3aed;">Partner ${partnerOrganization} Surveyor Contact</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <p><strong>Name:</strong> ${partnerSurveyor.name}</p>
                                <p><strong>Organization:</strong> ${partnerOrganization}</p>
                                <p><strong>Email:</strong> ${partnerSurveyor.email}</p>
                                <p><strong>Phone:</strong> ${partnerSurveyor.phone}</p>
                                <p><strong>License:</strong> ${partnerSurveyor.licenseNumber}</p>
                                <p><strong>Experience:</strong> ${partnerSurveyor.experience} years</p>
                            </div>
                            ${partnerSurveyor.specialization && partnerSurveyor.specialization.length > 0 ? `
                            <div style="margin-top: 10px;">
                                <strong>Specializations:</strong>
                                <div style="margin-top: 5px;">
                                    ${partnerSurveyor.specialization.map(spec =>
            `<span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 5px;">${spec}</span>`
        ).join('')}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                        
                        <div style="background: #e0f2fe; border: 1px solid #b3e5fc; color: #01579b; padding: 15px; border-radius: 6px; margin: 15px 0;">
                            <h4 style="margin-top: 0;">📋 Next Steps</h4>
                            <ul style="margin: 0; padding-left: 20px;">
                                <li>Coordinate with your partner surveyor for site visit scheduling</li>
                                <li>Share contact information and discuss assessment approach</li>
                                <li>Complete your individual survey assessment</li>
                                <li>Submit your report - the system will automatically merge both reports</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL}/surveyor/dashboard/assignments" 
                               style="background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                View Assignment Details
                            </a>
                        </div>
                    </div>
                    
                    <div style="text-align: center; color: #6c757d; font-size: 14px;">
                        <p>This is an automated notification from the Dual Surveyor System.</p>
                        <p>For questions about this assignment, contact your administrator or the partner surveyor directly.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Update assignment with partner surveyor contact information
     * @param {string} assignmentId - The assignment ID
     * @param {Object} partnerContact - Partner surveyor contact information
     */
    async updateAssignmentWithPartnerContact(assignmentId, partnerContact) {
        try {
            const assignment = await Assignment.findById(assignmentId);
            if (!assignment) {
                throw new Error('Assignment not found');
            }

            // Add partner contact information to assignment
            assignment.partnerSurveyorContact = partnerContact;
            await assignment.save();

            return assignment;
        } catch (error) {
            console.error('Error updating assignment with partner contact:', error);
            throw error;
        }
    }

    /**
     * Get all contact information for a dual assignment
     * @param {string} dualAssignmentId - The dual assignment ID
     * @returns {Object} Complete contact information for both surveyors
     */
    async getDualAssignmentContacts(dualAssignmentId) {
        try {
            const dualAssignment = await DualAssignment.findById(dualAssignmentId)
                .populate('policyId', 'propertyDetails contactDetails');

            if (!dualAssignment) {
                throw new Error('Dual assignment not found');
            }

            return {
                dualAssignmentId: dualAssignment._id,
                policyId: dualAssignment.policyId._id,
                assignmentStatus: dualAssignment.assignmentStatus,
                completionStatus: dualAssignment.completionStatus,
                ammcSurveyor: dualAssignment.ammcSurveyorContact,
                niaSurveyor: dualAssignment.niaSurveyorContact,
                propertyDetails: dualAssignment.policyId.propertyDetails,
                contactDetails: dualAssignment.policyId.contactDetails,
                timeline: dualAssignment.timeline,
                priority: dualAssignment.priority,
                estimatedCompletion: dualAssignment.estimatedCompletion
            };
        } catch (error) {
            console.error('Error getting dual assignment contacts:', error);
            throw error;
        }
    }
}

module.exports = new AssignmentContactService();
const { Employee } = require('../models/Employee');
const NIAAdmin = require('../models/NIAAdmin');

class NotificationService {
    /**
     * Notify both AMMC and NIA admins when a new policy is created
     * @param {Object} policyRequest - The created policy request
     * @param {Object} dualAssignment - The created dual assignment
     */
    static async notifyAdminsOfNewPolicy(policyRequest, dualAssignment) {
        try {
            console.log(`🔔 Notifying admins of new policy: ${policyRequest._id}`);

            // Get all admins (Admin, Super-admin, and NIA-Admin roles)
            const admins = await Employee.find({
                employeeRole: { $in: await this.getAdminRoleIds() },
                organization: { $in: ['AMMC', 'FCT-DCIP'] }, // Include both AMMC and FCT-DCIP
                deleted: false
            }).populate('employeeRole employeeStatus');

            // Get all NIA admins
            const niaAdmins = await NIAAdmin.find({
                status: 'active'
            }).populate('userId', 'firstname lastname email');

            const notificationData = {
                type: 'new_policy_assignment_required',
                policyId: policyRequest._id,
                propertyAddress: policyRequest.propertyDetails.address,
                propertyType: policyRequest.propertyDetails.propertyType,
                buildingValue: policyRequest.propertyDetails.buildingValue,
                clientName: policyRequest.contactDetails.fullName,
                clientEmail: policyRequest.contactDetails.email,
                priority: dualAssignment.priority,
                deadline: dualAssignment.estimatedCompletion.overallDeadline,
                createdAt: new Date()
            };

            // Log notifications for AMMC admins
            console.log(`📧 AMMC Admins to notify: ${ammcAdmins.length}`);
            for (const admin of ammcAdmins) {
                console.log(`   - ${admin.firstname} ${admin.lastname} (${admin.email})`);
                // Here you would integrate with your email service or in-app notification system
                // await EmailService.sendNewPolicyNotification(admin.email, notificationData);
                // await InAppNotificationService.create(admin._id, notificationData);
            }

            // Log notifications for NIA admins
            console.log(`📧 NIA Admins to notify: ${niaAdmins.length}`);
            for (const niaAdmin of niaAdmins) {
                console.log(`   - ${niaAdmin.userId.firstname} ${niaAdmin.userId.lastname} (${niaAdmin.userId.email})`);
                // Here you would integrate with your email service or in-app notification system
                // await EmailService.sendNewPolicyNotification(niaAdmin.userId.email, notificationData);
                // await InAppNotificationService.create(niaAdmin.userId._id, notificationData);
            }

            // For now, we'll just log the notification
            console.log('📋 New Policy Notification Details:');
            console.log(`   Policy ID: ${notificationData.policyId}`);
            console.log(`   Property: ${notificationData.propertyType} at ${notificationData.propertyAddress}`);
            console.log(`   Value: ₦${notificationData.buildingValue.toLocaleString()}`);
            console.log(`   Client: ${notificationData.clientName} (${notificationData.clientEmail})`);
            console.log(`   Priority: ${notificationData.priority}`);
            console.log(`   Deadline: ${notificationData.deadline.toLocaleDateString()}`);
            console.log('✅ Admin notifications logged successfully');

            return {
                success: true,
                ammcAdminsNotified: ammcAdmins.length,
                niaAdminsNotified: niaAdmins.length,
                totalNotified: ammcAdmins.length + niaAdmins.length
            };

        } catch (error) {
            console.error('❌ Failed to notify admins:', error);
            throw error;
        }
    }

    /**
     * Get admin role IDs for all admin types
     */
    static async getAdminRoleIds() {
        try {
            const { Role } = require('../models/Employee');
            const adminRoles = await Role.find({
                role: { $in: ['Admin', 'Super-admin', 'NIA-Admin'] }
            });
            return adminRoles.map(role => role._id);
        } catch (error) {
            console.error('Failed to get admin role IDs:', error);
            return [];
        }
    }

    /**
     * Notify surveyors when they are assigned to a policy
     * @param {Object} assignment - The assignment object
     * @param {Object} surveyorContact - Surveyor contact information
     * @param {string} organization - AMMC or NIA
     */
    static async notifySurveyorOfAssignment(assignment, surveyorContact, organization) {
        try {
            console.log(`🔔 Notifying ${organization} surveyor of new assignment: ${assignment._id}`);

            const notificationData = {
                type: 'surveyor_assignment',
                assignmentId: assignment._id,
                policyId: assignment.ammcId,
                organization: organization,
                surveyorName: surveyorContact.name,
                surveyorEmail: surveyorContact.email,
                propertyAddress: assignment.location?.address,
                deadline: assignment.deadline,
                priority: assignment.priority,
                instructions: assignment.instructions,
                createdAt: new Date()
            };

            console.log('📋 Surveyor Assignment Notification:');
            console.log(`   Assignment ID: ${notificationData.assignmentId}`);
            console.log(`   Organization: ${notificationData.organization}`);
            console.log(`   Surveyor: ${notificationData.surveyorName} (${notificationData.surveyorEmail})`);
            console.log(`   Property: ${notificationData.propertyAddress}`);
            console.log(`   Deadline: ${notificationData.deadline.toLocaleDateString()}`);
            console.log(`   Priority: ${notificationData.priority}`);
            console.log('✅ Surveyor notification logged successfully');

            // Here you would integrate with your email service or in-app notification system
            // await EmailService.sendAssignmentNotification(surveyorContact.email, notificationData);
            // await InAppNotificationService.create(surveyorContact.surveyorId, notificationData);

            return {
                success: true,
                surveyorNotified: surveyorContact.name,
                organization: organization
            };

        } catch (error) {
            console.error('❌ Failed to notify surveyor:', error);
            throw error;
        }
    }
}

module.exports = NotificationService;
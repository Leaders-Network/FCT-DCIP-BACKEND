const { Employee } = require('../models/Employee');
const NIAAdmin = require('../models/NIAAdmin');
const EnhancedNotificationService = require('./EnhancedNotificationService');
const User = require('../models/User');

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
                organization: { $in: ['AMMC', 'Builders-Liability-AMMC'] },
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

            let notificationCount = 0;

            // Create notifications for AMMC admins
            console.log(`📧 AMMC Admins to notify: ${admins.length}`);
            for (const admin of admins) {
                try {
                    await EnhancedNotificationService.create({
                        recipientId: admin._id.toString(),
                        recipientType: 'admin',
                        type: 'policy_created',
                        title: 'New Policy Request Requires Assignment',
                        message: `A new policy request for ${notificationData.propertyType} at ${notificationData.propertyAddress} requires surveyor assignment.`,
                        priority: dualAssignment.priority || 'medium',
                        actionUrl: `/admin/dashboard/policies/${policyRequest._id}`,
                        actionLabel: 'Assign Surveyors',
                        metadata: {
                            policyId: policyRequest._id.toString(),
                            icon: 'FileText',
                            color: 'blue'
                        },
                        sendEmail: true,
                        recipientEmail: admin.email
                    });
                    console.log(`   ✅ Notified: ${admin.firstname} ${admin.lastname} (${admin.email})`);
                    notificationCount++;
                } catch (error) {
                    console.error(`   ❌ Failed to notify ${admin.email}:`, error.message);
                }
            }

            // Create notifications for NIA admins
            console.log(`📧 NIA Admins to notify: ${niaAdmins.length}`);
            for (const niaAdmin of niaAdmins) {
                try {
                    await EnhancedNotificationService.create({
                        recipientId: niaAdmin.userId._id.toString(),
                        recipientType: 'nia-admin',
                        type: 'policy_created',
                        title: 'New Policy Request Requires Assignment',
                        message: `A new policy request for ${notificationData.propertyType} at ${notificationData.propertyAddress} requires surveyor assignment.`,
                        priority: dualAssignment.priority || 'medium',
                        actionUrl: `/nia-admin/dashboard/policies/${policyRequest._id}`,
                        actionLabel: 'Assign Surveyors',
                        metadata: {
                            policyId: policyRequest._id.toString(),
                            icon: 'FileText',
                            color: 'blue'
                        },
                        sendEmail: true,
                        recipientEmail: niaAdmin.userId.email
                    });
                    console.log(`   ✅ Notified: ${niaAdmin.userId.firstname} ${niaAdmin.userId.lastname} (${niaAdmin.userId.email})`);
                    notificationCount++;
                } catch (error) {
                    console.error(`   ❌ Failed to notify ${niaAdmin.userId.email}:`, error.message);
                }
            }

            // Notify the user that their policy was created
            try {
                const user = await User.findById(policyRequest.userId);
                if (user) {
                    await EnhancedNotificationService.notifyPolicyCreated(
                        policyRequest._id.toString(),
                        user._id.toString(),
                        user.email
                    );
                    console.log(`   ✅ Notified user: ${user.email}`);
                    notificationCount++;
                }
            } catch (error) {
                console.error(`   ❌ Failed to notify user:`, error.message);
            }

            console.log('✅ Admin notifications sent successfully');

            return {
                success: true,
                ammcAdminsNotified: admins.length,
                niaAdminsNotified: niaAdmins.length,
                totalNotified: notificationCount
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

            // Create in-app notification and send email
            await EnhancedNotificationService.notifyPolicyAssigned(
                assignment.ammcId,
                surveyorContact.surveyorId,
                surveyorContact.email,
                assignment._id.toString()
            );

            console.log('📋 Surveyor Assignment Notification:');
            console.log(`   Assignment ID: ${notificationData.assignmentId}`);
            console.log(`   Organization: ${notificationData.organization}`);
            console.log(`   Surveyor: ${notificationData.surveyorName} (${notificationData.surveyorEmail})`);
            console.log(`   Property: ${notificationData.propertyAddress}`);
            console.log(`   Deadline: ${notificationData.deadline?.toLocaleDateString()}`);
            console.log(`   Priority: ${notificationData.priority}`);
            console.log('✅ Surveyor notification sent successfully');

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
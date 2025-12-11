const Assignment = require('../models/Assignment');
const DualAssignment = require('../models/DualAssignment');
const Surveyor = require('../models/Surveyor');
const EnhancedNotificationService = require('./EnhancedNotificationService');

class DeadlineNotificationService {
    /**
     * Check for assignments with approaching deadlines and send notifications
     */
    static async checkApproachingDeadlines() {
        try {
            console.log('🕐 Checking for approaching assignment deadlines...');

            // Check for assignments due within 24 hours
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const approachingAssignments = await Assignment.find({
                deadline: { $lte: tomorrow, $gte: new Date() },
                status: { $in: ['assigned', 'accepted', 'in-progress'] }
            }).populate('surveyorId');

            for (const assignment of approachingAssignments) {
                if (assignment.surveyorId) {
                    const surveyor = await Surveyor.findById(assignment.surveyorId).populate('userId');
                    if (surveyor && surveyor.userId) {
                        const hoursRemaining = Math.ceil((assignment.deadline - new Date()) / (1000 * 60 * 60));

                        await EnhancedNotificationService.notifyDeadlineApproaching(
                            assignment._id,
                            assignment.surveyorId,
                            surveyor.userId.email,
                            hoursRemaining
                        );
                    }
                }
            }

            // Check for dual assignments with approaching deadlines
            const approachingDualAssignments = await DualAssignment.find({
                'estimatedCompletion.overallDeadline': { $lte: tomorrow, $gte: new Date() },
                completionStatus: { $lt: 100 }
            });

            for (const dualAssignment of approachingDualAssignments) {
                // Notify AMMC surveyor if assigned and not completed
                if (dualAssignment.ammcSurveyorId && !dualAssignment.ammcSubmissionId) {
                    const ammcSurveyor = await Surveyor.findById(dualAssignment.ammcSurveyorId).populate('userId');
                    if (ammcSurveyor && ammcSurveyor.userId) {
                        const hoursRemaining = Math.ceil((dualAssignment.estimatedCompletion.overallDeadline - new Date()) / (1000 * 60 * 60));

                        await EnhancedNotificationService.create({
                            recipientId: dualAssignment.ammcSurveyorId.toString(),
                            recipientType: 'surveyor',
                            type: 'assignment_deadline_approaching',
                            title: 'Dual Assignment Deadline Approaching',
                            message: `Your dual assignment is due in ${hoursRemaining} hours. Please complete your survey soon.`,
                            priority: 'urgent',
                            actionUrl: `/surveyor/dual-assignments/${dualAssignment._id}`,
                            actionLabel: 'View Assignment',
                            metadata: {
                                assignmentId: dualAssignment._id.toString(),
                                icon: 'Clock',
                                color: 'orange'
                            },
                            sendEmail: true,
                            recipientEmail: ammcSurveyor.userId.email
                        });
                    }
                }

                // Notify NIA surveyor if assigned and not completed
                if (dualAssignment.niaSurveyorId && !dualAssignment.niaSubmissionId) {
                    const niaSurveyor = await Surveyor.findById(dualAssignment.niaSurveyorId).populate('userId');
                    if (niaSurveyor && niaSurveyor.userId) {
                        const hoursRemaining = Math.ceil((dualAssignment.estimatedCompletion.overallDeadline - new Date()) / (1000 * 60 * 60));

                        await EnhancedNotificationService.create({
                            recipientId: dualAssignment.niaSurveyorId.toString(),
                            recipientType: 'surveyor',
                            type: 'assignment_deadline_approaching',
                            title: 'Dual Assignment Deadline Approaching',
                            message: `Your dual assignment is due in ${hoursRemaining} hours. Please complete your survey soon.`,
                            priority: 'urgent',
                            actionUrl: `/surveyor/dual-assignments/${dualAssignment._id}`,
                            actionLabel: 'View Assignment',
                            metadata: {
                                assignmentId: dualAssignment._id.toString(),
                                icon: 'Clock',
                                color: 'orange'
                            },
                            sendEmail: true,
                            recipientEmail: niaSurveyor.userId.email
                        });
                    }
                }
            }

            console.log(`✅ Deadline check completed. Found ${approachingAssignments.length} regular assignments and ${approachingDualAssignments.length} dual assignments with approaching deadlines.`);
        } catch (error) {
            console.error('❌ Error checking approaching deadlines:', error);
        }
    }

    /**
     * Check for overdue assignments and send notifications
     */
    static async checkOverdueAssignments() {
        try {
            console.log('⏰ Checking for overdue assignments...');

            const now = new Date();

            // Check for overdue regular assignments
            const overdueAssignments = await Assignment.find({
                deadline: { $lt: now },
                status: { $in: ['assigned', 'accepted', 'in-progress'] }
            }).populate('surveyorId');

            for (const assignment of overdueAssignments) {
                if (assignment.surveyorId) {
                    const surveyor = await Surveyor.findById(assignment.surveyorId).populate('userId');
                    if (surveyor && surveyor.userId) {
                        const hoursOverdue = Math.ceil((now - assignment.deadline) / (1000 * 60 * 60));

                        await EnhancedNotificationService.create({
                            recipientId: assignment.surveyorId.toString(),
                            recipientType: 'surveyor',
                            type: 'assignment_overdue',
                            title: 'Assignment Overdue',
                            message: `Your assignment is ${hoursOverdue} hours overdue. Please complete it immediately.`,
                            priority: 'urgent',
                            actionUrl: `/surveyor/assignments/${assignment._id}`,
                            actionLabel: 'Complete Assignment',
                            metadata: {
                                assignmentId: assignment._id.toString(),
                                icon: 'AlertTriangle',
                                color: 'red'
                            },
                            sendEmail: true,
                            recipientEmail: surveyor.userId.email
                        });

                        // Also notify admins about overdue assignments
                        const { Employee } = require('../models/Employee');
                        const admins = await Employee.find({
                            'employeeRole.role': { $in: ['Admin', 'Super-Admin'] },
                            employeeStatus: { $exists: true }
                        }).populate('employeeStatus');

                        const activeAdmins = admins.filter(admin =>
                            admin.employeeStatus && admin.employeeStatus.status === 'Active'
                        );

                        for (const admin of activeAdmins) {
                            await EnhancedNotificationService.create({
                                recipientId: admin._id.toString(),
                                recipientType: 'admin',
                                type: 'assignment_overdue',
                                title: 'Assignment Overdue - Action Required',
                                message: `Assignment ${assignment._id} is ${hoursOverdue} hours overdue and requires immediate attention.`,
                                priority: 'urgent',
                                actionUrl: `/admin/dashboard/assignments/${assignment._id}`,
                                actionLabel: 'Take Action',
                                metadata: {
                                    assignmentId: assignment._id.toString(),
                                    icon: 'AlertTriangle',
                                    color: 'red'
                                },
                                sendEmail: true,
                                recipientEmail: admin.email
                            });
                        }
                    }
                }
            }

            console.log(`✅ Overdue check completed. Found ${overdueAssignments.length} overdue assignments.`);
        } catch (error) {
            console.error('❌ Error checking overdue assignments:', error);
        }
    }

    /**
     * Start the deadline monitoring service
     */
    static startDeadlineMonitoring() {
        console.log('🚀 Starting deadline notification monitoring...');

        // Check every hour for approaching deadlines (24 hours before)
        setInterval(() => {
            this.checkApproachingDeadlines();
        }, 60 * 60 * 1000); // 1 hour

        // Check every 30 minutes for overdue assignments
        setInterval(() => {
            this.checkOverdueAssignments();
        }, 30 * 60 * 1000); // 30 minutes

        // Run initial checks
        this.checkApproachingDeadlines();
        this.checkOverdueAssignments();
    }
}

module.exports = DeadlineNotificationService;
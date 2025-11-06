const mongoose = require('mongoose');

const DualAssignmentSchema = new mongoose.Schema({
    policyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PolicyRequest',
        required: [true, 'Policy ID is required']
        // unique: true removed - handled by schema.index() below
    },
    ammcAssignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment',
        default: null
    },
    niaAssignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment',
        default: null
    },
    assignmentStatus: {
        type: String,
        enum: ['unassigned', 'partially_assigned', 'fully_assigned'],
        default: 'unassigned'
    },
    completionStatus: {
        type: Number,
        enum: [0, 50, 100],
        default: 0
    },
    ammcSurveyorContact: {
        type: {
            surveyorId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Employee'
            },
            name: String,
            email: String,
            phone: String,
            licenseNumber: String,
            address: String,
            emergencyContact: String,
            specialization: [String],
            experience: Number,
            rating: Number,
            assignedAt: Date
        },
        default: null
    },
    niaSurveyorContact: {
        type: {
            surveyorId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Employee'
            },
            name: String,
            email: String,
            phone: String,
            licenseNumber: String,
            address: String,
            emergencyContact: String,
            specialization: [String],
            experience: Number,
            rating: Number,
            assignedAt: Date
        },
        default: null
    },
    timeline: [{
        event: {
            type: String,
            enum: ['created', 'ammc_assigned', 'nia_assigned', 'ammc_report_submitted', 'nia_report_submitted', 'reports_merged', 'conflict_detected', 'conflict_resolved', 'completed'],
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        organization: {
            type: String,
            enum: ['AMMC', 'NIA', 'SYSTEM']
        },
        details: String,
        metadata: mongoose.Schema.Types.Mixed
    }],
    notifications: {
        ammcNotified: {
            type: Boolean,
            default: false
        },
        niaNotified: {
            type: Boolean,
            default: false
        },
        userNotified: {
            type: Boolean,
            default: false
        },
        lastNotificationSent: Date
    },
    estimatedCompletion: {
        ammcDeadline: Date,
        niaDeadline: Date,
        overallDeadline: Date
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    processingStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    processingStartedAt: Date,
    processingFailedAt: Date,
    processingError: String,
    mergedReportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MergedReport',
        default: null
    },
    completedAt: Date
}, {
    timestamps: true
});

// Indexes for efficient queries
DualAssignmentSchema.index({ policyId: 1 }, { unique: true });
DualAssignmentSchema.index({ assignmentStatus: 1 });
DualAssignmentSchema.index({ completionStatus: 1 });
DualAssignmentSchema.index({ processingStatus: 1 });
DualAssignmentSchema.index({ ammcAssignmentId: 1 });
DualAssignmentSchema.index({ niaAssignmentId: 1 });
DualAssignmentSchema.index({ priority: 1, 'estimatedCompletion.overallDeadline': 1 });
DualAssignmentSchema.index({ completionStatus: 1, processingStatus: 1, mergedReportId: 1 });

// Method to assign AMMC surveyor
DualAssignmentSchema.methods.assignAMMCSurveyor = function (assignmentId, surveyorContact, assignedBy) {
    this.ammcAssignmentId = assignmentId;
    this.ammcSurveyorContact = {
        ...surveyorContact,
        assignedAt: new Date()
    };

    // Update assignment status
    if (this.niaAssignmentId) {
        this.assignmentStatus = 'fully_assigned';
    } else {
        this.assignmentStatus = 'partially_assigned';
    }

    // Add timeline event
    this.timeline.push({
        event: 'ammc_assigned',
        timestamp: new Date(),
        performedBy: assignedBy,
        organization: 'AMMC',
        details: `AMMC surveyor ${surveyorContact.name} assigned`,
        metadata: { surveyorId: surveyorContact.surveyorId }
    });

    this.notifications.ammcNotified = false;
};

// Method to assign NIA surveyor
DualAssignmentSchema.methods.assignNIASurveyor = function (assignmentId, surveyorContact, assignedBy) {
    this.niaAssignmentId = assignmentId;
    this.niaSurveyorContact = {
        ...surveyorContact,
        assignedAt: new Date()
    };

    // Update assignment status
    if (this.ammcAssignmentId) {
        this.assignmentStatus = 'fully_assigned';
    } else {
        this.assignmentStatus = 'partially_assigned';
    }

    // Add timeline event
    this.timeline.push({
        event: 'nia_assigned',
        timestamp: new Date(),
        performedBy: assignedBy,
        organization: 'NIA',
        details: `NIA surveyor ${surveyorContact.name} assigned`,
        metadata: { surveyorId: surveyorContact.surveyorId }
    });

    this.notifications.niaNotified = false;
};

// Method to update completion status when report is submitted
DualAssignmentSchema.methods.reportSubmitted = function (organization, reportId, submittedBy) {
    const eventType = organization === 'AMMC' ? 'ammc_report_submitted' : 'nia_report_submitted';

    // Add timeline event
    this.timeline.push({
        event: eventType,
        timestamp: new Date(),
        performedBy: submittedBy,
        organization: organization,
        details: `${organization} survey report submitted`,
        metadata: { reportId: reportId }
    });

    // Check if this is the first report
    const ammcReportSubmitted = this.timeline.some(event => event.event === 'ammc_report_submitted');
    const niaReportSubmitted = this.timeline.some(event => event.event === 'nia_report_submitted');

    if (ammcReportSubmitted && niaReportSubmitted) {
        this.completionStatus = 100;
    } else if (ammcReportSubmitted || niaReportSubmitted) {
        this.completionStatus = 50;
    }

    this.notifications.userNotified = false;
};

// Method to check if both surveyors are assigned
DualAssignmentSchema.methods.isBothAssigned = function () {
    return this.ammcAssignmentId && this.niaAssignmentId;
};

// Method to check if both reports are submitted
DualAssignmentSchema.methods.isBothReportsSubmitted = function () {
    const ammcReportSubmitted = this.timeline.some(event => event.event === 'ammc_report_submitted');
    const niaReportSubmitted = this.timeline.some(event => event.event === 'nia_report_submitted');
    return ammcReportSubmitted && niaReportSubmitted;
};

// Method to get assigned surveyor contacts
DualAssignmentSchema.methods.getSurveyorContacts = function () {
    return {
        ammc: this.ammcSurveyorContact,
        nia: this.niaSurveyorContact
    };
};

// Method to check if overdue
DualAssignmentSchema.methods.isOverdue = function () {
    if (!this.estimatedCompletion.overallDeadline) return false;
    return this.estimatedCompletion.overallDeadline < new Date() && this.completionStatus < 100;
};

// Virtual for progress percentage display
DualAssignmentSchema.virtual('progressDisplay').get(function () {
    switch (this.completionStatus) {
        case 0: return 'Not Started (0%)';
        case 50: return 'Partially Complete (50%)';
        case 100: return 'Fully Complete (100%)';
        default: return 'Unknown Status';
    }
});

module.exports = mongoose.models.DualAssignment || mongoose.model('DualAssignment', DualAssignmentSchema);
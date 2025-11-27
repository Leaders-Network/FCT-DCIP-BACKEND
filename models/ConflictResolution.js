const mongoose = require('mongoose');

const ConflictResolutionSchema = new mongoose.Schema({
    mergedReportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MergedReport',
        required: [true, 'Merged Report ID is required']
    },
    policyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PolicyRequest',
        required: [true, 'Policy ID is required']
    },
    conflictType: {
        type: String,
        enum: ['recommendation_mismatch', 'value_discrepancy', 'risk_assessment_difference', 'structural_disagreement', 'other'],
        required: [true, 'Conflict type is required']
    },
    conflictSeverity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    conflictDetails: {
        ammcRecommendation: String,
        niaRecommendation: String,
        ammcValue: Number,
        niaValue: Number,
        discrepancyPercentage: Number,
        ammcSurveyorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        niaSurveyorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        conflictDescription: String
    },
    resolutionStatus: {
        type: String,
        enum: ['pending', 'in_review', 'resolved', 'escalated', 'closed'],
        default: 'pending'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    assignedOrganization: {
        type: String,
        enum: ['AMMC', 'NIA', 'JOINT', 'EXTERNAL'],
        default: null
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    deadline: {
        type: Date,
        default: function () {
            // Default deadline is 3 days from creation for conflicts
            return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        }
    },
    resolution: {
        finalRecommendation: {
            type: String,
            enum: ['approve', 'reject', 'request_more_info'],
            default: null
        },
        finalValue: Number,
        resolutionMethod: {
            type: String,
            enum: ['admin_decision', 'surveyor_consensus', 'third_party_review', 'policy_override', 'escalation'],
            default: null
        },
        resolutionNotes: String,
        supportingDocuments: [{
            fileName: String,
            fileUrl: String,
            uploadedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Employee'
            },
            uploadedAt: {
                type: Date,
                default: Date.now
            }
        }]
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    resolvedAt: Date,
    timeline: [{
        action: {
            type: String,
            enum: ['created', 'assigned', 'reviewed', 'commented', 'escalated', 'resolved', 'closed'],
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
    communications: [{
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        to: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        }],
        message: {
            type: String,
            required: true
        },
        messageType: {
            type: String,
            enum: ['comment', 'question', 'clarification', 'decision', 'escalation'],
            default: 'comment'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        attachments: [{
            fileName: String,
            fileUrl: String,
            fileType: String
        }],
        isInternal: {
            type: Boolean,
            default: true
        }
    }],
    escalation: {
        escalatedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        escalatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        escalatedAt: Date,
        escalationReason: String,
        escalationLevel: {
            type: Number,
            default: 1,
            min: 1,
            max: 5
        }
    },
    notifications: {
        ammcNotified: {
            type: Boolean,
            default: false
        },
        niaNotified: {
            type: Boolean,
            default: false
        },
        adminNotified: {
            type: Boolean,
            default: false
        },
        userNotified: {
            type: Boolean,
            default: false
        },
        lastNotificationSent: Date
    },
    sla: {
        responseTime: {
            target: {
                type: Number,
                default: 24 // hours
            },
            actual: Number
        },
        resolutionTime: {
            target: {
                type: Number,
                default: 72 // hours
            },
            actual: Number
        },
        breached: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
ConflictResolutionSchema.index({ mergedReportId: 1 });
ConflictResolutionSchema.index({ policyId: 1 });
ConflictResolutionSchema.index({ resolutionStatus: 1 });
ConflictResolutionSchema.index({ assignedTo: 1 });
ConflictResolutionSchema.index({ priority: 1, deadline: 1 });
ConflictResolutionSchema.index({ conflictType: 1 });
ConflictResolutionSchema.index({ conflictSeverity: 1 });
ConflictResolutionSchema.index({ createdAt: -1 });

// Method to assign conflict to resolver
ConflictResolutionSchema.methods.assignTo = function (assigneeId, assignedBy, organization = null) {
    this.assignedTo = assigneeId;
    this.assignedOrganization = organization;
    this.resolutionStatus = 'in_review';

    // Add timeline event
    this.timeline.push({
        action: 'assigned',
        timestamp: new Date(),
        performedBy: assignedBy,
        details: `Conflict assigned to resolver`,
        metadata: { assigneeId: assigneeId, organization: organization }
    });

    // Reset notifications
    this.notifications.ammcNotified = false;
    this.notifications.niaNotified = false;
    this.notifications.adminNotified = false;
};

// Method to add communication
ConflictResolutionSchema.methods.addCommunication = function (from, to, message, messageType = 'comment', attachments = [], isInternal = true) {
    this.communications.push({
        from: from,
        to: Array.isArray(to) ? to : [to],
        message: message,
        messageType: messageType,
        timestamp: new Date(),
        attachments: attachments,
        isInternal: isInternal
    });

    // Update timeline
    this.timeline.push({
        action: 'commented',
        timestamp: new Date(),
        performedBy: from,
        details: `Added ${messageType}: ${message.substring(0, 50)}...`
    });
};

// Method to escalate conflict
ConflictResolutionSchema.methods.escalate = function (escalatedTo, escalatedBy, reason) {
    this.escalation.escalatedTo = escalatedTo;
    this.escalation.escalatedBy = escalatedBy;
    this.escalation.escalatedAt = new Date();
    this.escalation.escalationReason = reason;
    this.escalation.escalationLevel += 1;

    this.resolutionStatus = 'escalated';
    this.priority = this.priority === 'urgent' ? 'urgent' : 'high';

    // Add timeline event
    this.timeline.push({
        action: 'escalated',
        timestamp: new Date(),
        performedBy: escalatedBy,
        details: `Conflict escalated to level ${this.escalation.escalationLevel}: ${reason}`,
        metadata: { escalatedTo: escalatedTo, escalationLevel: this.escalation.escalationLevel }
    });

    // Reset notifications
    this.notifications.adminNotified = false;
};

// Method to resolve conflict
ConflictResolutionSchema.methods.resolve = function (resolution, resolvedBy) {
    this.resolution.finalRecommendation = resolution.finalRecommendation;
    this.resolution.finalValue = resolution.finalValue;
    this.resolution.resolutionMethod = resolution.resolutionMethod;
    this.resolution.resolutionNotes = resolution.resolutionNotes;
    this.resolution.supportingDocuments = resolution.supportingDocuments || [];

    this.resolvedBy = resolvedBy;
    this.resolvedAt = new Date();
    this.resolutionStatus = 'resolved';

    // Calculate actual resolution time
    const resolutionTimeHours = (new Date() - this.createdAt) / (1000 * 60 * 60);
    this.sla.resolutionTime.actual = resolutionTimeHours;
    this.sla.breached = resolutionTimeHours > this.sla.resolutionTime.target;

    // Add timeline event
    this.timeline.push({
        action: 'resolved',
        timestamp: new Date(),
        performedBy: resolvedBy,
        details: `Conflict resolved with recommendation: ${resolution.finalRecommendation}`,
        metadata: {
            finalRecommendation: resolution.finalRecommendation,
            resolutionMethod: resolution.resolutionMethod,
            resolutionTimeHours: resolutionTimeHours
        }
    });

    // Reset notifications for resolution announcement
    this.notifications.ammcNotified = false;
    this.notifications.niaNotified = false;
    this.notifications.userNotified = false;
};

// Method to check if conflict is overdue
ConflictResolutionSchema.methods.isOverdue = function () {
    return this.deadline < new Date() && !['resolved', 'closed'].includes(this.resolutionStatus);
};

// Method to calculate days remaining
ConflictResolutionSchema.methods.getDaysRemaining = function () {
    if (['resolved', 'closed'].includes(this.resolutionStatus)) {
        return null;
    }
    const diff = this.deadline - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Method to get conflict summary
ConflictResolutionSchema.methods.getSummary = function () {
    return {
        id: this._id,
        conflictType: this.conflictType,
        severity: this.conflictSeverity,
        status: this.resolutionStatus,
        priority: this.priority,
        daysRemaining: this.getDaysRemaining(),
        isOverdue: this.isOverdue(),
        assignedTo: this.assignedTo,
        escalationLevel: this.escalation.escalationLevel
    };
};

// Virtual for resolution time display
ConflictResolutionSchema.virtual('resolutionTimeDisplay').get(function () {
    if (this.sla.resolutionTime.actual) {
        const hours = Math.round(this.sla.resolutionTime.actual);
        if (hours < 24) {
            return `${hours} hours`;
        } else {
            const days = Math.round(hours / 24);
            return `${days} day${days > 1 ? 's' : ''}`;
        }
    }
    return 'Pending';
});

// Virtual for SLA status
ConflictResolutionSchema.virtual('slaStatus').get(function () {
    if (this.resolutionStatus === 'resolved') {
        return this.sla.breached ? 'Breached' : 'Met';
    }

    const hoursElapsed = (new Date() - this.createdAt) / (1000 * 60 * 60);
    const targetHours = this.sla.resolutionTime.target;

    if (hoursElapsed > targetHours) {
        return 'Breached';
    } else if (hoursElapsed > targetHours * 0.8) {
        return 'At Risk';
    } else {
        return 'On Track';
    }
});

module.exports = mongoose.model('ConflictResolution', ConflictResolutionSchema);
const mongoose = require('mongoose');

const AutomaticConflictFlagSchema = new mongoose.Schema({
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
    dualAssignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DualAssignment',
        required: [true, 'Dual Assignment ID is required']
    },
    conflictType: {
        type: String,
        enum: [
            'recommendation_mismatch',
            'value_discrepancy',
            'risk_assessment_difference',
            'structural_disagreement',
            'timeline_discrepancy',
            'photo_evidence_conflict',
            'condition_assessment_mismatch',
            'other'
        ],
        required: [true, 'Conflict type is required']
    },
    conflictSeverity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    ammcRecommendation: {
        type: String,
        required: [true, 'AMMC recommendation is required']
    },
    niaRecommendation: {
        type: String,
        required: [true, 'NIA recommendation is required']
    },
    ammcValue: {
        type: Number,
        default: null
    },
    niaValue: {
        type: Number,
        default: null
    },
    discrepancyPercentage: {
        type: Number,
        default: null,
        min: 0,
        max: 100
    },
    flaggedSections: [{
        sectionName: {
            type: String,
            required: true
        },
        ammcContent: String,
        niaContent: String,
        conflictDescription: String,
        severity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        }
    }],
    detectionMetadata: {
        detectionAlgorithm: {
            type: String,
            default: 'v1.0'
        },
        detectedAt: {
            type: Date,
            default: Date.now
        },
        confidenceScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 85
        },
        processingTime: {
            type: Number, // in milliseconds
            default: null
        }
    },
    flagStatus: {
        type: String,
        enum: ['active', 'reviewed', 'resolved', 'dismissed'],
        default: 'active'
    },
    reviewDetails: {
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        reviewNotes: {
            type: String,
            default: null
        },
        reviewDecision: {
            type: String,
            enum: ['valid_conflict', 'false_positive', 'requires_manual_review', 'escalate'],
            default: null
        }
    },
    resolutionDetails: {
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            default: null
        },
        resolvedAt: {
            type: Date,
            default: null
        },
        resolutionMethod: {
            type: String,
            enum: ['admin_override', 'surveyor_clarification', 'user_acceptance', 'policy_update'],
            default: null
        },
        resolutionNotes: {
            type: String,
            default: null
        }
    },
    userNotified: {
        type: Boolean,
        default: false
    },
    adminNotified: {
        type: Boolean,
        default: false
    },
    notificationHistory: [{
        notificationType: {
            type: String,
            enum: ['user_alert', 'admin_alert', 'escalation_notice', 'resolution_notice'],
            required: true
        },
        sentTo: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'notificationHistory.recipientType',
            required: true
        },
        recipientType: {
            type: String,
            enum: ['User', 'Employee'],
            required: true
        },
        sentAt: {
            type: Date,
            default: Date.now
        },
        method: {
            type: String,
            enum: ['email', 'dashboard', 'sms'],
            default: 'email'
        },
        status: {
            type: String,
            enum: ['sent', 'delivered', 'failed', 'pending'],
            default: 'sent'
        }
    }],
    escalationLevel: {
        type: Number,
        default: 0,
        min: 0,
        max: 3
    },
    escalatedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    tags: [{
        type: String,
        trim: true
    }],
    systemGenerated: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
AutomaticConflictFlagSchema.index({ mergedReportId: 1 });
AutomaticConflictFlagSchema.index({ policyId: 1 });
AutomaticConflictFlagSchema.index({ conflictType: 1 });
AutomaticConflictFlagSchema.index({ conflictSeverity: 1 });
AutomaticConflictFlagSchema.index({ flagStatus: 1 });
AutomaticConflictFlagSchema.index({ priority: 1 });
AutomaticConflictFlagSchema.index({ createdAt: -1 });
AutomaticConflictFlagSchema.index({ 'detectionMetadata.detectedAt': -1 });
AutomaticConflictFlagSchema.index({ escalationLevel: 1 });

// Method to mark as reviewed
AutomaticConflictFlagSchema.methods.markAsReviewed = function (reviewedBy, reviewNotes, reviewDecision) {
    this.flagStatus = 'reviewed';
    this.reviewDetails.reviewedBy = reviewedBy;
    this.reviewDetails.reviewedAt = new Date();
    this.reviewDetails.reviewNotes = reviewNotes;
    this.reviewDetails.reviewDecision = reviewDecision;

    // Adjust priority based on review decision
    if (reviewDecision === 'escalate') {
        this.priority = 'urgent';
        this.escalationLevel += 1;
    } else if (reviewDecision === 'false_positive') {
        this.priority = 'low';
        this.flagStatus = 'dismissed';
    }
};

// Method to resolve conflict flag
AutomaticConflictFlagSchema.methods.resolve = function (resolvedBy, resolutionMethod, resolutionNotes) {
    this.flagStatus = 'resolved';
    this.resolutionDetails.resolvedBy = resolvedBy;
    this.resolutionDetails.resolvedAt = new Date();
    this.resolutionDetails.resolutionMethod = resolutionMethod;
    this.resolutionDetails.resolutionNotes = resolutionNotes;
    this.priority = 'low';
};

// Method to escalate conflict flag
AutomaticConflictFlagSchema.methods.escalate = function (escalatedBy, escalatedTo, reason) {
    this.escalationLevel += 1;
    this.escalatedTo = escalatedTo;
    this.priority = this.escalationLevel >= 2 ? 'urgent' : 'high';

    // Add notification for escalation
    this.notificationHistory.push({
        notificationType: 'escalation_notice',
        sentTo: escalatedTo,
        recipientType: 'Employee',
        method: 'email'
    });
};

// Method to add flagged section
AutomaticConflictFlagSchema.methods.addFlaggedSection = function (sectionName, ammcContent, niaContent, conflictDescription, severity = 'medium') {
    this.flaggedSections.push({
        sectionName: sectionName,
        ammcContent: ammcContent,
        niaContent: niaContent,
        conflictDescription: conflictDescription,
        severity: severity
    });

    // Update overall severity if this section is more severe
    const severityLevels = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
    if (severityLevels[severity] > severityLevels[this.conflictSeverity]) {
        this.conflictSeverity = severity;
    }
};

// Method to send notification
AutomaticConflictFlagSchema.methods.sendNotification = function (notificationType, recipientId, recipientType, method = 'email') {
    this.notificationHistory.push({
        notificationType: notificationType,
        sentTo: recipientId,
        recipientType: recipientType,
        method: method,
        status: 'sent'
    });

    // Update notification flags
    if (recipientType === 'User') {
        this.userNotified = true;
    } else if (recipientType === 'Employee') {
        this.adminNotified = true;
    }
};

// Method to calculate severity score
AutomaticConflictFlagSchema.methods.calculateSeverityScore = function () {
    let score = 0;

    // Base score from conflict type
    const typeScores = {
        'recommendation_mismatch': 40,
        'value_discrepancy': 30,
        'risk_assessment_difference': 35,
        'structural_disagreement': 25,
        'timeline_discrepancy': 15,
        'photo_evidence_conflict': 20,
        'condition_assessment_mismatch': 30,
        'other': 20
    };
    score += typeScores[this.conflictType] || 20;

    // Add score from discrepancy percentage
    if (this.discrepancyPercentage) {
        score += Math.min(this.discrepancyPercentage, 40);
    }

    // Add score from number of flagged sections
    score += Math.min(this.flaggedSections.length * 5, 20);

    return Math.min(score, 100);
};

// Virtual for severity display
AutomaticConflictFlagSchema.virtual('severityDisplay').get(function () {
    return this.conflictSeverity.charAt(0).toUpperCase() + this.conflictSeverity.slice(1);
});

// Virtual for status display
AutomaticConflictFlagSchema.virtual('statusDisplay').get(function () {
    const statusMap = {
        'active': 'Active',
        'reviewed': 'Under Review',
        'resolved': 'Resolved',
        'dismissed': 'Dismissed'
    };
    return statusMap[this.flagStatus] || this.flagStatus;
});

// Virtual for days since detection
AutomaticConflictFlagSchema.virtual('daysSinceDetection').get(function () {
    const now = new Date();
    const detected = this.detectionMetadata.detectedAt;
    const diffTime = Math.abs(now - detected);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
});

// Virtual for resolution time (if resolved)
AutomaticConflictFlagSchema.virtual('resolutionTimeHours').get(function () {
    if (!this.resolutionDetails.resolvedAt) return null;

    const resolved = this.resolutionDetails.resolvedAt;
    const detected = this.detectionMetadata.detectedAt;
    const diffTime = Math.abs(resolved - detected);
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    return diffHours;
});

module.exports = mongoose.model('AutomaticConflictFlag', AutomaticConflictFlagSchema);
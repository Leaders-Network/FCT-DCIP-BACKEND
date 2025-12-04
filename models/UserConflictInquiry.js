const mongoose = require('mongoose');

const UserConflictInquirySchema = new mongoose.Schema({
    policyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PolicyRequest',
        required: false, // Optional - user might raise general inquiry
        default: null
    },
    mergedReportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MergedReport',
        default: null
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required']
    },
    referenceId: {
        type: String,
        required: false // Generated automatically by pre-save hook
        // unique: true removed - handled by schema.index() below
    },
    conflictType: {
        type: String,
        enum: [
            'disagreement_findings',
            'recommendation_concern',
            'surveyor_conduct',
            'technical_error',
            'missing_information',
            'clarification_needed',
            'other'
        ],
        required: [true, 'Conflict type is required']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    urgency: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    contactPreference: {
        type: String,
        enum: ['email', 'phone', 'both'],
        default: 'email'
    },
    userContact: {
        email: {
            type: String,
            required: [true, 'User email is required']
        },
        name: {
            type: String,
            default: ''
        },
        phone: {
            type: String,
            default: ''
        },
        preferredTime: {
            type: String,
            default: ''
        }
    },
    inquiryStatus: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    },
    assignedAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    assignedOrganization: {
        type: String,
        enum: ['AMMC', 'NIA', 'BOTH'],
        default: 'BOTH'
    },
    adminResponse: {
        type: String,
        default: null,
        maxlength: [3000, 'Admin response cannot exceed 3000 characters']
    },
    responseMethod: {
        type: String,
        enum: ['email', 'phone', 'in_person'],
        default: null
    },
    internalNotes: [{
        note: {
            type: String,
            required: true
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        noteType: {
            type: String,
            enum: ['general', 'follow_up', 'escalation', 'resolution'],
            default: 'general'
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
        resolutionType: {
            type: String,
            enum: ['explanation_provided', 'report_corrected', 'policy_updated', 'no_action_required', 'escalated_further'],
            default: null
        },
        followUpRequired: {
            type: Boolean,
            default: false
        },
        followUpDate: {
            type: Date,
            default: null
        }
    },
    communicationHistory: [{
        method: {
            type: String,
            enum: ['email', 'phone', 'in_person'],
            required: true
        },
        direction: {
            type: String,
            enum: ['inbound', 'outbound'],
            required: true
        },
        summary: {
            type: String,
            required: true
        },
        handledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        duration: {
            type: Number, // in minutes
            default: null
        }
    }],
    attachments: [{
        filename: String,
        url: String,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        fileType: String,
        fileSize: Number
    }],
    tags: [{
        type: String,
        trim: true
    }],
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    satisfactionRating: {
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: null
        },
        feedback: {
            type: String,
            default: null
        },
        ratedAt: {
            type: Date,
            default: null
        }
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
UserConflictInquirySchema.index({ policyId: 1 });
UserConflictInquirySchema.index({ userId: 1 });
UserConflictInquirySchema.index({ referenceId: 1 }, { unique: true });
UserConflictInquirySchema.index({ inquiryStatus: 1 });
UserConflictInquirySchema.index({ assignedAdminId: 1 });
UserConflictInquirySchema.index({ urgency: 1 });
UserConflictInquirySchema.index({ conflictType: 1 });
UserConflictInquirySchema.index({ createdAt: -1 });
UserConflictInquirySchema.index({ assignedOrganization: 1 });

// Pre-save middleware to generate reference ID
UserConflictInquirySchema.pre('save', function (next) {
    if (this.isNew && !this.referenceId) {
        // Generate reference ID: CF-YYYYMMDD-XXXX
        const date = new Date();
        const dateStr = date.getFullYear().toString() +
            (date.getMonth() + 1).toString().padStart(2, '0') +
            date.getDate().toString().padStart(2, '0');
        const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        this.referenceId = `CF-${dateStr}-${randomNum}`;
    }
    next();
});

// Method to assign to admin
UserConflictInquirySchema.methods.assignToAdmin = function (adminId, organization = 'BOTH') {
    this.assignedAdminId = adminId;
    this.assignedOrganization = organization;
    this.inquiryStatus = 'in_progress';

    this.internalNotes.push({
        note: `Inquiry assigned to admin (${organization})`,
        addedBy: adminId,
        noteType: 'general'
    });
};

// Method to add admin response
UserConflictInquirySchema.methods.addResponse = function (adminId, response, method = 'email') {
    this.adminResponse = response;
    this.responseMethod = method;
    this.inquiryStatus = 'resolved';

    this.resolutionDetails.resolvedBy = adminId;
    this.resolutionDetails.resolvedAt = new Date();
    this.resolutionDetails.resolutionType = 'explanation_provided';

    this.communicationHistory.push({
        method: method,
        direction: 'outbound',
        summary: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
        handledBy: adminId
    });
};

// Method to escalate inquiry
UserConflictInquirySchema.methods.escalate = function (escalatedBy, escalatedTo, reason) {
    this.escalationLevel += 1;
    this.escalatedTo = escalatedTo;
    this.priority = this.escalationLevel >= 2 ? 'urgent' : 'high';

    this.internalNotes.push({
        note: `Escalated to higher level: ${reason}`,
        addedBy: escalatedBy,
        noteType: 'escalation'
    });
};

// Method to add internal note
UserConflictInquirySchema.methods.addInternalNote = function (adminId, note, noteType = 'general') {
    this.internalNotes.push({
        note: note,
        addedBy: adminId,
        noteType: noteType
    });
};

// Method to log communication
UserConflictInquirySchema.methods.logCommunication = function (adminId, method, direction, summary, duration = null) {
    this.communicationHistory.push({
        method: method,
        direction: direction,
        summary: summary,
        handledBy: adminId,
        duration: duration
    });
};

// Virtual for display status
UserConflictInquirySchema.virtual('statusDisplay').get(function () {
    const statusMap = {
        'open': 'Open',
        'in_progress': 'In Progress',
        'resolved': 'Resolved',
        'closed': 'Closed'
    };
    return statusMap[this.inquiryStatus] || this.inquiryStatus;
});

// Virtual for urgency display
UserConflictInquirySchema.virtual('urgencyDisplay').get(function () {
    return this.urgency.charAt(0).toUpperCase() + this.urgency.slice(1);
});

// Virtual for days since creation
UserConflictInquirySchema.virtual('daysSinceCreation').get(function () {
    const now = new Date();
    const created = this.createdAt;
    const diffTime = Math.abs(now - created);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
});

// Virtual for response time (if resolved)
UserConflictInquirySchema.virtual('responseTimeHours').get(function () {
    if (!this.resolutionDetails.resolvedAt) return null;

    const resolved = this.resolutionDetails.resolvedAt;
    const created = this.createdAt;
    const diffTime = Math.abs(resolved - created);
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    return diffHours;
});

module.exports = mongoose.models.UserConflictInquiry || mongoose.model('UserConflictInquiry', UserConflictInquirySchema);
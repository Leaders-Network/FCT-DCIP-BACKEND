const mongoose = require('mongoose');

const MergedReportSchema = new mongoose.Schema({
    policyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PolicyRequest',
        required: [true, 'Policy ID is required'],
        unique: true
    },
    dualAssignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DualAssignment',
        required: [true, 'Dual Assignment ID is required']
    },
    ammcReportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SurveySubmission',
        required: [true, 'AMMC Report ID is required']
    },
    niaReportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SurveySubmission',
        required: [true, 'NIA Report ID is required']
    },
    mergedDocumentUrl: {
        type: String,
        default: null
    },
    mergedDocumentPublicId: {
        type: String,
        default: null
    },
    conflictDetected: {
        type: Boolean,
        default: false
    },
    conflictResolved: {
        type: Boolean,
        default: false
    },
    conflictDetails: {
        conflictType: {
            type: String,
            enum: ['recommendation_mismatch', 'value_discrepancy', 'risk_assessment_difference', 'structural_disagreement', 'other']
        },
        ammcRecommendation: String,
        niaRecommendation: String,
        ammcValue: Number,
        niaValue: Number,
        discrepancyPercentage: Number,
        conflictSeverity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        }
    },
    finalRecommendation: {
        type: String,
        enum: ['approve', 'reject', 'request_more_info'],
        default: null
    },
    paymentEnabled: {
        type: Boolean,
        default: false
    },
    reportSections: {
        ammc: {
            propertyCondition: String,
            structuralAssessment: String,
            riskFactors: String,
            recommendations: String,
            estimatedValue: Number,
            surveyorName: String,
            surveyorLicense: String,
            submissionDate: Date,
            photos: [{
                url: String,
                description: String,
                timestamp: Date
            }]
        },
        nia: {
            propertyCondition: String,
            structuralAssessment: String,
            riskFactors: String,
            recommendations: String,
            estimatedValue: Number,
            surveyorName: String,
            surveyorLicense: String,
            submissionDate: Date,
            photos: [{
                url: String,
                description: String,
                timestamp: Date
            }]
        }
    },
    mergingMetadata: {
        mergedBy: {
            type: String,
            default: 'SYSTEM'
        },
        mergedAt: {
            type: Date,
            default: Date.now
        },
        mergingAlgorithmVersion: {
            type: String,
            default: '1.0'
        },
        processingTime: Number, // in milliseconds
        qualityScore: {
            type: Number,
            min: 0,
            max: 100
        }
    },
    releaseStatus: {
        type: String,
        enum: ['pending', 'withheld', 'released'],
        default: 'pending'
    },
    releasedAt: Date,
    releasedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    accessHistory: [{
        accessedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        accessedAt: {
            type: Date,
            default: Date.now
        },
        accessType: {
            type: String,
            enum: ['view', 'download', 'share'],
            default: 'view'
        },
        ipAddress: String,
        userAgent: String
    }],
    notifications: {
        userNotified: {
            type: Boolean,
            default: false
        },
        adminNotified: {
            type: Boolean,
            default: false
        },
        conflictNotificationSent: {
            type: Boolean,
            default: false
        },
        releaseNotificationSent: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

// Indexes for efficient queries (policyId already indexed due to unique: true)
MergedReportSchema.index({ dualAssignmentId: 1 });
MergedReportSchema.index({ conflictDetected: 1 });
MergedReportSchema.index({ conflictResolved: 1 });
MergedReportSchema.index({ releaseStatus: 1 });
MergedReportSchema.index({ finalRecommendation: 1 });
MergedReportSchema.index({ createdAt: -1 });

// Method to detect conflicts between AMMC and NIA reports
MergedReportSchema.methods.detectConflicts = function () {
    const ammcRec = this.reportSections.ammc.recommendations;
    const niaRec = this.reportSections.nia.recommendations;
    const ammcVal = this.reportSections.ammc.estimatedValue;
    const niaVal = this.reportSections.nia.estimatedValue;

    let conflictDetected = false;
    let conflictType = null;
    let conflictSeverity = 'low';

    // Check recommendation conflicts
    if (ammcRec && niaRec) {
        const ammcAction = this.extractRecommendationAction(ammcRec);
        const niaAction = this.extractRecommendationAction(niaRec);

        if (ammcAction !== niaAction) {
            conflictDetected = true;
            conflictType = 'recommendation_mismatch';
            conflictSeverity = 'high';
        }
    }

    // Check value discrepancies
    if (ammcVal && niaVal && ammcVal > 0 && niaVal > 0) {
        const discrepancy = Math.abs(ammcVal - niaVal) / Math.max(ammcVal, niaVal) * 100;

        if (discrepancy > 20) { // More than 20% difference
            conflictDetected = true;
            conflictType = conflictType || 'value_discrepancy';
            conflictSeverity = discrepancy > 50 ? 'critical' : 'medium';

            this.conflictDetails.discrepancyPercentage = discrepancy;
        }
    }

    this.conflictDetected = conflictDetected;
    if (conflictDetected) {
        this.conflictDetails.conflictType = conflictType;
        this.conflictDetails.ammcRecommendation = ammcRec;
        this.conflictDetails.niaRecommendation = niaRec;
        this.conflictDetails.ammcValue = ammcVal;
        this.conflictDetails.niaValue = niaVal;
        this.conflictDetails.conflictSeverity = conflictSeverity;
        this.releaseStatus = 'withheld';
    }

    return conflictDetected;
};

// Helper method to extract recommendation action from text
MergedReportSchema.methods.extractRecommendationAction = function (recommendationText) {
    if (!recommendationText) return null;

    const text = recommendationText.toLowerCase();
    if (text.includes('approve') || text.includes('accept') || text.includes('recommend')) {
        return 'approve';
    } else if (text.includes('reject') || text.includes('deny') || text.includes('not recommend')) {
        return 'reject';
    } else if (text.includes('more info') || text.includes('additional') || text.includes('clarification')) {
        return 'request_more_info';
    }

    return 'unknown';
};

// Method to determine final recommendation and payment eligibility
MergedReportSchema.methods.determineFinalRecommendation = function () {
    if (this.conflictDetected && !this.conflictResolved) {
        this.finalRecommendation = null;
        this.paymentEnabled = false;
        return;
    }

    const ammcAction = this.extractRecommendationAction(this.reportSections.ammc.recommendations);
    const niaAction = this.extractRecommendationAction(this.reportSections.nia.recommendations);

    // If both approve
    if (ammcAction === 'approve' && niaAction === 'approve') {
        this.finalRecommendation = 'approve';
        this.paymentEnabled = true;
    }
    // If both reject
    else if (ammcAction === 'reject' && niaAction === 'reject') {
        this.finalRecommendation = 'reject';
        this.paymentEnabled = false;
    }
    // If both request more info
    else if (ammcAction === 'request_more_info' && niaAction === 'request_more_info') {
        this.finalRecommendation = 'request_more_info';
        this.paymentEnabled = false;
    }
    // Mixed recommendations - should be handled by conflict resolution
    else {
        this.finalRecommendation = null;
        this.paymentEnabled = false;
    }
};

// Method to release report
MergedReportSchema.methods.releaseReport = function (releasedBy) {
    this.releaseStatus = 'released';
    this.releasedAt = new Date();
    this.releasedBy = releasedBy;
    this.notifications.releaseNotificationSent = false;
};

// Method to log access
MergedReportSchema.methods.logAccess = function (accessedBy, accessType, ipAddress, userAgent) {
    this.accessHistory.push({
        accessedBy: accessedBy,
        accessedAt: new Date(),
        accessType: accessType,
        ipAddress: ipAddress,
        userAgent: userAgent
    });

    // Keep only last 50 access records
    if (this.accessHistory.length > 50) {
        this.accessHistory = this.accessHistory.slice(-50);
    }
};

// Virtual for conflict status display
MergedReportSchema.virtual('conflictStatusDisplay').get(function () {
    if (!this.conflictDetected) return 'No Conflicts';
    if (this.conflictResolved) return 'Conflicts Resolved';
    return `Conflict Detected (${this.conflictDetails.conflictSeverity})`;
});

// Virtual for payment status display
MergedReportSchema.virtual('paymentStatusDisplay').get(function () {
    if (this.paymentEnabled) return 'Payment Enabled';
    if (this.finalRecommendation === 'reject') return 'Payment Denied - Policy Rejected';
    if (this.finalRecommendation === 'request_more_info') return 'Payment Pending - More Info Required';
    return 'Payment Pending - Under Review';
});

module.exports = mongoose.model('MergedReport', MergedReportSchema);
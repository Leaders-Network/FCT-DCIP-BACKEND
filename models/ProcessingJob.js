const mongoose = require('mongoose');

const ProcessingJobSchema = new mongoose.Schema({
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
    mergedReportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MergedReport',
        default: null
    },
    jobId: {
        type: String,
        unique: true,
        required: [true, 'Job ID is required']
    },
    processingStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    processingStage: {
        type: String,
        enum: [
            'validation',
            'data_extraction',
            'conflict_detection',
            'report_merging',
            'document_generation',
            'notification',
            'finalization'
        ],
        default: 'validation'
    },
    processingStartedAt: {
        type: Date,
        default: null
    },
    processingCompletedAt: {
        type: Date,
        default: null
    },
    processingDuration: {
        type: Number, // in seconds
        default: null
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    retryCount: {
        type: Number,
        default: 0,
        max: 3
    },
    maxRetries: {
        type: Number,
        default: 3
    },
    errorDetails: {
        errorCode: String,
        errorMessage: String,
        errorStack: String,
        failedStage: String,
        timestamp: Date,
        recoverable: {
            type: Boolean,
            default: true
        }
    },
    conflictDetection: {
        conflictsDetected: {
            type: Boolean,
            default: false
        },
        conflictCount: {
            type: Number,
            default: 0
        },
        conflictSeverity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: null
        },
        conflictTypes: [{
            type: String,
            enum: [
                'recommendation_mismatch',
                'value_discrepancy',
                'risk_assessment_difference',
                'structural_disagreement',
                'timeline_conflict',
                'methodology_difference'
            ]
        }],
        conflictFlags: [{
            flagType: String,
            description: String,
            severity: {
                type: String,
                enum: ['low', 'medium', 'high', 'critical']
            },
            autoResolvable: {
                type: Boolean,
                default: false
            }
        }],
        resolutionRequired: {
            type: Boolean,
            default: false
        }
    },
    reportDetails: {
        ammcReport: {
            surveyorId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Surveyor'
            },
            surveyorName: String,
            surveyorEmail: String,
            surveyorLicense: String,
            submittedAt: Date,
            reportDocument: String,
            findings: {
                propertyCondition: String,
                structuralAssessment: String,
                riskFactors: String,
                recommendations: String,
                estimatedValue: Number
            },
            recommendation: {
                type: String,
                enum: ['approve', 'reject', 'request_more_info']
            },
            surveyNotes: String,
            qualityScore: {
                type: Number,
                min: 0,
                max: 100
            }
        },
        niaReport: {
            surveyorId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Surveyor'
            },
            surveyorName: String,
            surveyorEmail: String,
            surveyorLicense: String,
            submittedAt: Date,
            reportDocument: String,
            findings: {
                propertyCondition: String,
                structuralAssessment: String,
                riskFactors: String,
                recommendations: String,
                estimatedValue: Number
            },
            recommendation: {
                type: String,
                enum: ['approve', 'reject', 'request_more_info']
            },
            surveyNotes: String,
            qualityScore: {
                type: Number,
                min: 0,
                max: 100
            }
        }
    },
    processingMetrics: {
        validationTime: Number, // in milliseconds
        extractionTime: Number,
        conflictDetectionTime: Number,
        mergingTime: Number,
        documentGenerationTime: Number,
        notificationTime: Number,
        totalProcessingTime: Number,
        memoryUsage: Number, // in MB
        cpuUsage: Number // percentage
    },
    notifications: {
        userNotified: {
            type: Boolean,
            default: false
        },
        userNotificationSentAt: Date,
        adminNotified: {
            type: Boolean,
            default: false
        },
        adminNotificationSentAt: Date,
        conflictNotificationSent: {
            type: Boolean,
            default: false
        },
        errorNotificationSent: {
            type: Boolean,
            default: false
        }
    },
    systemInfo: {
        processingNode: String,
        algorithmVersion: {
            type: String,
            default: '2.0'
        },
        environmentType: {
            type: String,
            enum: ['development', 'staging', 'production'],
            default: 'production'
        },
        queuePosition: Number,
        estimatedCompletionTime: Date
    },
    auditTrail: [{
        action: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        performedBy: {
            type: String,
            default: 'SYSTEM'
        },
        details: mongoose.Schema.Types.Mixed,
        duration: Number // in milliseconds
    }]
}, {
    timestamps: true
});

// Indexes for efficient queries
ProcessingJobSchema.index({ policyId: 1 });
ProcessingJobSchema.index({ jobId: 1 }, { unique: true });
ProcessingJobSchema.index({ processingStatus: 1 });
ProcessingJobSchema.index({ processingStage: 1 });
ProcessingJobSchema.index({ priority: 1 });
ProcessingJobSchema.index({ createdAt: -1 });
ProcessingJobSchema.index({ processingStartedAt: -1 });
ProcessingJobSchema.index({ 'conflictDetection.conflictsDetected': 1 });
ProcessingJobSchema.index({ 'conflictDetection.conflictSeverity': 1 });
ProcessingJobSchema.index({ retryCount: 1 });

// Pre-save middleware to generate job ID
ProcessingJobSchema.pre('save', function (next) {
    if (this.isNew && !this.jobId) {
        // Generate job ID: PJ-YYYYMMDD-HHMMSS-XXXX
        const now = new Date();
        const dateStr = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0');
        const timeStr = now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0');
        const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        this.jobId = `PJ-${dateStr}-${timeStr}-${randomNum}`;
    }
    next();
});

// Method to start processing
ProcessingJobSchema.methods.startProcessing = function () {
    this.processingStatus = 'processing';
    this.processingStartedAt = new Date();
    this.processingStage = 'validation';

    this.addAuditEntry('processing_started', 'Processing job started');
};

// Method to complete processing
ProcessingJobSchema.methods.completeProcessing = function (mergedReportId) {
    this.processingStatus = 'completed';
    this.processingCompletedAt = new Date();
    this.mergedReportId = mergedReportId;

    if (this.processingStartedAt) {
        this.processingDuration = Math.floor((this.processingCompletedAt - this.processingStartedAt) / 1000);
    }

    this.addAuditEntry('processing_completed', 'Processing job completed successfully');
};

// Method to fail processing
ProcessingJobSchema.methods.failProcessing = function (errorCode, errorMessage, errorStack, failedStage) {
    this.processingStatus = 'failed';
    this.processingCompletedAt = new Date();

    this.errorDetails = {
        errorCode: errorCode,
        errorMessage: errorMessage,
        errorStack: errorStack,
        failedStage: failedStage,
        timestamp: new Date(),
        recoverable: this.retryCount < this.maxRetries
    };

    if (this.processingStartedAt) {
        this.processingDuration = Math.floor((this.processingCompletedAt - this.processingStartedAt) / 1000);
    }

    this.addAuditEntry('processing_failed', `Processing failed at stage: ${failedStage}`, {
        errorCode: errorCode,
        errorMessage: errorMessage
    });
};

// Method to retry processing
ProcessingJobSchema.methods.retryProcessing = function () {
    if (this.retryCount >= this.maxRetries) {
        throw new Error('Maximum retry attempts exceeded');
    }

    this.retryCount += 1;
    this.processingStatus = 'pending';
    this.processingStage = 'validation';
    this.processingStartedAt = null;
    this.processingCompletedAt = null;
    this.processingDuration = null;
    this.errorDetails = {};

    this.addAuditEntry('processing_retry', `Retry attempt ${this.retryCount}`);
};

// Method to update processing stage
ProcessingJobSchema.methods.updateStage = function (stage, details = null) {
    const previousStage = this.processingStage;
    this.processingStage = stage;

    this.addAuditEntry('stage_updated', `Stage changed from ${previousStage} to ${stage}`, details);
};

// Method to detect conflicts
ProcessingJobSchema.methods.detectConflicts = function () {
    const ammc = this.reportDetails.ammcReport;
    const nia = this.reportDetails.niaReport;

    if (!ammc || !nia) return false;

    let conflictsDetected = false;
    let conflictCount = 0;
    let conflictTypes = [];
    let conflictFlags = [];
    let maxSeverity = 'low';

    // Check recommendation conflicts
    if (ammc.recommendation && nia.recommendation && ammc.recommendation !== nia.recommendation) {
        conflictsDetected = true;
        conflictCount++;
        conflictTypes.push('recommendation_mismatch');
        conflictFlags.push({
            flagType: 'recommendation_mismatch',
            description: `AMMC recommends ${ammc.recommendation}, NIA recommends ${nia.recommendation}`,
            severity: 'high',
            autoResolvable: false
        });
        maxSeverity = 'high';
    }

    // Check value discrepancies
    if (ammc.findings?.estimatedValue && nia.findings?.estimatedValue) {
        const ammcVal = ammc.findings.estimatedValue;
        const niaVal = nia.findings.estimatedValue;
        const discrepancy = Math.abs(ammcVal - niaVal) / Math.max(ammcVal, niaVal) * 100;

        if (discrepancy > 20) {
            conflictsDetected = true;
            conflictCount++;
            conflictTypes.push('value_discrepancy');

            const severity = discrepancy > 50 ? 'critical' : discrepancy > 30 ? 'high' : 'medium';
            conflictFlags.push({
                flagType: 'value_discrepancy',
                description: `Property value discrepancy: ${discrepancy.toFixed(1)}% difference`,
                severity: severity,
                autoResolvable: discrepancy < 30
            });

            if (severity === 'critical') maxSeverity = 'critical';
            else if (severity === 'high' && maxSeverity !== 'critical') maxSeverity = 'high';
            else if (severity === 'medium' && maxSeverity === 'low') maxSeverity = 'medium';
        }
    }

    // Update conflict detection results
    this.conflictDetection = {
        conflictsDetected: conflictsDetected,
        conflictCount: conflictCount,
        conflictSeverity: conflictsDetected ? maxSeverity : null,
        conflictTypes: conflictTypes,
        conflictFlags: conflictFlags,
        resolutionRequired: conflictsDetected && maxSeverity !== 'low'
    };

    return conflictsDetected;
};

// Method to add audit entry
ProcessingJobSchema.methods.addAuditEntry = function (action, details, metadata = null) {
    this.auditTrail.push({
        action: action,
        timestamp: new Date(),
        performedBy: 'SYSTEM',
        details: typeof details === 'string' ? details : JSON.stringify(details),
        duration: null
    });

    // Keep only last 100 audit entries
    if (this.auditTrail.length > 100) {
        this.auditTrail = this.auditTrail.slice(-100);
    }
};

// Method to update metrics
ProcessingJobSchema.methods.updateMetrics = function (metrics) {
    this.processingMetrics = {
        ...this.processingMetrics,
        ...metrics
    };
};

// Virtual for processing time display
ProcessingJobSchema.virtual('processingTimeDisplay').get(function () {
    if (!this.processingDuration) return 'N/A';

    const minutes = Math.floor(this.processingDuration / 60);
    const seconds = this.processingDuration % 60;

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
});

// Virtual for status display
ProcessingJobSchema.virtual('statusDisplay').get(function () {
    const statusMap = {
        'pending': 'Pending',
        'processing': 'Processing',
        'completed': 'Completed',
        'failed': 'Failed',
        'cancelled': 'Cancelled'
    };
    return statusMap[this.processingStatus] || this.processingStatus;
});

// Virtual for conflict summary
ProcessingJobSchema.virtual('conflictSummary').get(function () {
    if (!this.conflictDetection.conflictsDetected) {
        return 'No conflicts detected';
    }

    const count = this.conflictDetection.conflictCount;
    const severity = this.conflictDetection.conflictSeverity;
    return `${count} conflict${count > 1 ? 's' : ''} detected (${severity} severity)`;
});

module.exports = mongoose.model('ProcessingJob', ProcessingJobSchema);
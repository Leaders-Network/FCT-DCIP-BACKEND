const mongoose = require('mongoose');

const ProcessingJobSchema = new mongoose.Schema({
    jobType: {
        type: String,
        required: [true, 'Job type is required'],
        enum: ['report_merging', 'batch_report_merging', 'scheduled_report_merging', 'conflict_resolution'],
        index: true
    },
    entityId: {
        type: mongoose.Schema.ObjectId,
        required: [true, 'Entity ID is required'],
        index: true
    },
    entityType: {
        type: String,
        required: [true, 'Entity type is required'],
        enum: ['DualAssignment', 'MergedReport', 'ConflictFlag']
    },
    status: {
        type: String,
        required: [true, 'Status is required'],
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    startedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    completedAt: {
        type: Date
    },
    initiatedBy: {
        type: String,
        required: [true, 'Initiated by is required'],
        default: 'system'
    },
    result: {
        type: mongoose.Schema.Types.Mixed
    },
    error: {
        type: String
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    priority: {
        type: Number,
        default: 1,
        min: 1,
        max: 10
    },
    retryCount: {
        type: Number,
        default: 0
    },
    maxRetries: {
        type: Number,
        default: 3
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
ProcessingJobSchema.index({ jobType: 1, status: 1 });
ProcessingJobSchema.index({ entityId: 1, entityType: 1 });
ProcessingJobSchema.index({ startedAt: -1 });
ProcessingJobSchema.index({ createdAt: -1 });

// Virtual for processing duration
ProcessingJobSchema.virtual('processingDuration').get(function () {
    if (this.completedAt && this.startedAt) {
        return this.completedAt.getTime() - this.startedAt.getTime();
    }
    return null;
});

// Virtual for current status duration
ProcessingJobSchema.virtual('statusDuration').get(function () {
    const endTime = this.completedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
});

// Pre-save middleware
ProcessingJobSchema.pre('save', function (next) {
    // Set completedAt when status changes to completed or failed
    if (this.isModified('status') && ['completed', 'failed', 'cancelled'].includes(this.status)) {
        if (!this.completedAt) {
            this.completedAt = new Date();
        }
    }
    next();
});

// Static methods
ProcessingJobSchema.statics.getActiveJobs = function () {
    return this.find({ status: { $in: ['pending', 'processing'] } });
};

ProcessingJobSchema.statics.getJobsByType = function (jobType, limit = 50) {
    return this.find({ jobType })
        .sort({ createdAt: -1 })
        .limit(limit);
};

ProcessingJobSchema.statics.getJobStats = function (timeframe = '24h') {
    const now = new Date();
    let timeFilter;

    switch (timeframe) {
        case '1h':
            timeFilter = new Date(now.getTime() - 60 * 60 * 1000);
            break;
        case '24h':
            timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        default:
            timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return this.aggregate([
        { $match: { createdAt: { $gte: timeFilter } } },
        {
            $group: {
                _id: {
                    status: '$status',
                    jobType: '$jobType'
                },
                count: { $sum: 1 },
                avgDuration: {
                    $avg: {
                        $cond: [
                            { $and: ['$startedAt', '$completedAt'] },
                            { $subtract: ['$completedAt', '$startedAt'] },
                            null
                        ]
                    }
                }
            }
        }
    ]);
};

// Instance methods
ProcessingJobSchema.methods.markAsCompleted = function (result) {
    this.status = 'completed';
    this.completedAt = new Date();
    this.result = result;
    return this.save();
};

ProcessingJobSchema.methods.markAsFailed = function (error) {
    this.status = 'failed';
    this.completedAt = new Date();
    this.error = error;
    this.retryCount += 1;
    return this.save();
};

ProcessingJobSchema.methods.canRetry = function () {
    return this.retryCount < this.maxRetries && this.status === 'failed';
};

ProcessingJobSchema.methods.retry = function () {
    if (!this.canRetry()) {
        throw new Error('Job cannot be retried');
    }

    this.status = 'pending';
    this.error = undefined;
    this.completedAt = undefined;
    return this.save();
};

module.exports = mongoose.model('ProcessingJob', ProcessingJobSchema);
const mongoose = require('mongoose');

const ContactLogEntrySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Contact date is required']
  },
  method: {
    type: String,
    enum: ['phone', 'email', 'sms', 'visit'],
    required: [true, 'Contact method is required']
  },
  notes: {
    type: String,
    required: [true, 'Contact notes are required']
  },
  successful: {
    type: Boolean,
    default: true
  },
  duration: {
    type: Number, // in minutes
    default: null
  }
}, { _id: false });

const SurveySubmissionSchema = new mongoose.Schema({
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PolicyRequest',
    required: [true, 'Policy ID is required']
  },
  surveyorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Surveyor ID is required']
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment'
  },
  surveyDetails: {
    propertyCondition: {
      type: String,
      required: [true, 'Property condition assessment is required']
    },
    structuralAssessment: {
      type: String,
      required: [true, 'Structural assessment is required']
    },
    riskFactors: {
      type: String,
      required: [true, 'Risk factors assessment is required']
    },
    recommendations: {
      type: String,
      required: [true, 'Recommendations are required']
    },
    estimatedValue: {
      type: Number,
      min: 0
    },
    photos: [{
      url: String,
      publicId: String,
      description: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }]
  },
  surveyDocument: {
    type: mongoose.Schema.Types.Mixed, // Object with {name, url, publicId}
    required: [true, 'Survey document is required']
  },
  surveyNotes: {
    type: String,
    required: [true, 'Survey notes are required']
  },
  contactLog: [ContactLogEntrySchema],
  recommendedAction: {
    type: String,
    enum: ['approve', 'reject', 'request_more_info'],
    required: [true, 'Recommended action is required']
  },
  qualityCheck: {
    completeness: {
      type: Number,
      min: 0,
      max: 100
    },
    accuracy: {
      type: Number,
      min: 0,
      max: 100
    },
    timeliness: {
      type: Number,
      min: 0,
      max: 100
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    reviewedAt: Date,
    comments: String
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'revision_required'],
    default: 'submitted'
  },
  submissionTime: {
    type: Date,
    default: Date.now
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  },
  reviewedAt: Date,
  reviewNotes: String,
  revisionHistory: [{
    version: Number,
    changes: String,
    revisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    revisedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
SurveySubmissionSchema.index({ policyId: 1 });
SurveySubmissionSchema.index({ surveyorId: 1 });
SurveySubmissionSchema.index({ status: 1 });
SurveySubmissionSchema.index({ submissionTime: -1 });
SurveySubmissionSchema.index({ 'qualityCheck.overallScore': -1 });

// Middleware to calculate overall quality score
SurveySubmissionSchema.pre('save', function(next) {
  if (this.qualityCheck && 
      this.qualityCheck.completeness !== undefined && 
      this.qualityCheck.accuracy !== undefined && 
      this.qualityCheck.timeliness !== undefined) {
    
    this.qualityCheck.overallScore = Math.round(
      (this.qualityCheck.completeness + this.qualityCheck.accuracy + this.qualityCheck.timeliness) / 3
    );
  }
  next();
});

// Method to add contact log entry
SurveySubmissionSchema.methods.addContactEntry = function(entry) {
  this.contactLog.push({
    date: entry.date || new Date(),
    method: entry.method,
    notes: entry.notes,
    successful: entry.successful !== undefined ? entry.successful : true,
    duration: entry.duration
  });
};

// Method to calculate completion percentage
SurveySubmissionSchema.methods.getCompletionPercentage = function() {
  const requiredFields = [
    'surveyDetails.propertyCondition',
    'surveyDetails.structuralAssessment',
    'surveyDetails.riskFactors',
    'surveyDetails.recommendations',
    'surveyDocument',
    'surveyNotes',
    'recommendedAction'
  ];
  
  let completed = 0;
  requiredFields.forEach(field => {
    const value = field.split('.').reduce((obj, key) => obj && obj[key], this);
    if (value) completed++;
  });
  
  return Math.round((completed / requiredFields.length) * 100);
};

// Virtual for time since submission
SurveySubmissionSchema.virtual('daysSinceSubmission').get(function() {
  const diff = new Date() - this.submissionTime;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('SurveySubmission', SurveySubmissionSchema);
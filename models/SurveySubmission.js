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
  ammcId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PolicyRequest',
    required: [true, 'AMMC ID is required']
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
  documents: [{
    fileName: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      required: true
    },
    fileSize: {
      type: Number,
      required: true
    },
    cloudinaryUrl: {
      type: String,
      required: true
    },
    cloudinaryPublicId: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ['survey_report', 'inspection_photos', 'damage_photos', 'area_photos', 'supporting_documents', 'forms'],
      default: 'survey_report'
    },
    description: String,
    documentType: {
      type: String,
      enum: ['main_report', 'photo', 'form', 'supporting_doc', 'other'],
      default: 'other'
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    isMainReport: {
      type: Boolean,
      default: false
    }
  }],
  // Legacy field for backward compatibility
  surveyDocument: {
    type: mongoose.Schema.Types.Mixed,
    default: null
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
  }],
  organization: {
    type: String,
    enum: ['AMMC', 'NIA'],
    default: 'AMMC'
  },
  isMerged: {
    type: Boolean,
    default: false
  },
  mergedReportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MergedReport',
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
SurveySubmissionSchema.index({ ammcId: 1 });
SurveySubmissionSchema.index({ surveyorId: 1 });
SurveySubmissionSchema.index({ status: 1 });
SurveySubmissionSchema.index({ submissionTime: -1 });
SurveySubmissionSchema.index({ 'qualityCheck.overallScore': -1 });
SurveySubmissionSchema.index({ organization: 1 });
SurveySubmissionSchema.index({ isMerged: 1 });
SurveySubmissionSchema.index({ mergedReportId: 1 });

// Middleware to calculate overall quality score
SurveySubmissionSchema.pre('save', function (next) {
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
SurveySubmissionSchema.methods.addContactEntry = function (entry) {
  this.contactLog.push({
    date: entry.date || new Date(),
    method: entry.method,
    notes: entry.notes,
    successful: entry.successful !== undefined ? entry.successful : true,
    duration: entry.duration
  });
};

// Method to calculate completion percentage
SurveySubmissionSchema.methods.getCompletionPercentage = function () {
  const requiredFields = [
    'surveyDetails.propertyCondition',
    'surveyDetails.structuralAssessment',
    'surveyDetails.riskFactors',
    'surveyDetails.recommendations',
    'surveyNotes',
    'recommendedAction'
  ];

  let completed = 0;
  requiredFields.forEach(field => {
    const value = field.split('.').reduce((obj, key) => obj && obj[key], this);
    if (value) completed++;
  });

  // Check for required documents
  const hasMainReport = this.documents && this.documents.some(doc => doc.isMainReport);
  if (hasMainReport || (this.surveyDocument && this.surveyDocument.url)) {
    completed++;
  }

  return Math.round((completed / (requiredFields.length + 1)) * 100);
};

// Method to get main survey report
SurveySubmissionSchema.methods.getMainReport = function () {
  if (this.documents && this.documents.length > 0) {
    return this.documents.find(doc => doc.isMainReport) || this.documents[0];
  }
  return this.surveyDocument;
};

// Virtual for time since submission
SurveySubmissionSchema.virtual('daysSinceSubmission').get(function () {
  const diff = new Date() - this.submissionTime;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('SurveySubmission', SurveySubmissionSchema);
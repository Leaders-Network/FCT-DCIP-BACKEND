const mongoose = require('mongoose');

const PolicyRequestSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required']
  },
  propertyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
  },
  propertyDetails: {
    address: {
      type: String,
      required: [true, 'Property address is required']
    },
    propertyType: {
      type: String,
      enum: ['Residential House',
        'Apartment/Condo',
        'Commercial Building',
        'Industrial Facility',
        'Mixed Use'],

      required: [true, 'Property type is required']
    },
    buildingValue: {
      type: Number,
      required: [true, 'Building value is required'],
      min: 0
    },
    yearBuilt: {
      type: Number,
      required: [true, 'Year built is required'],
      min: 1800,
      max: new Date().getFullYear() + 1
    },
    squareFootage: {
      type: Number,
      required: [true, 'Square footage is required'],
      min: 0
    },
    constructionMaterial: {
      type: String,
      enum: ['Concrete Block', 'Steel Frame', 'Wood Frame', 'Brick', 'Stone', 'Mixed Materials'],
      required: [true, 'Construction material is required']
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  contactDetails: {
    fullName: {
      type: String,
      required: [true, 'Builder/Contractor name is required']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required']
    },
    alternatePhone: String,
    rcNumber: {
      type: String,
      required: [true, 'RC number is required'],
      trim: true,
      uppercase: true
    }
  },
  requestDetails: {
    coverageType: {
      type: String,
      enum: ['Contract Works Coverage',
        'Public Liability Coverage',
        'Employers Liability Coverage',
        'Contractors Plant and Equipment Coverage',
        'Professional Indemnity'],
      required: [true, 'Coverage type is required']
    },
    policyDuration: {
      type: String,
      enum: ['3 Months (Short-term Project)',
        '6 Months',
        '1 Year',
        'Project-Based (Until Completion)'],
      required: [true, 'Policy duration is required']
    },
    additionalCoverage: [{
      type: String,
      enum: ['Flood and Storm Damage',
        'Theft or Vandalism at Site',
        'Collapse or Structural Failure',
        'Third-Party Property Damage',
        'Injury to Non-Employees (Public)',
        'Machinery Breakdown',
        'Temporary Structures (Scaffolding, Site Office)',
        'Fire and Explosion',
        'Debris Removal Costs',
        'Cross Liability (Between Contractors/Subcontractors)']
    }],
    specialRequests: String
  },
  status: {
    type: String,
    enum: ['submitted', 'assigned', 'surveyed', 'approved', 'rejected', 'requires_more_info', 'completed', 'sent_to_user'],
    default: 'submitted'
  },
  assignedSurveyors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee'
  }],
  surveyDocument: {
    type: mongoose.Schema.Types.Mixed, // Can be string (legacy) or object (Cloudinary)
    default: null
  },
  surveyNotes: {
    type: String,
    default: ''
  },
  adminNotes: {
    type: String,
    default: ''
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
      enum: ['application_documents', 'identification', 'property_documents', 'supporting_documents', 'survey_reports', 'general'],
      default: 'general'
    },
    description: String,
    documentType: {
      type: String,
      enum: ['application_form', 'id_document', 'property_deed', 'survey_report', 'photo', 'other'],
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
    isRequired: {
      type: Boolean,
      default: false
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    verifiedAt: Date
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  deadline: {
    type: Date,
    default: function () {
      // Default deadline is 7 days from creation
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['submitted', 'assigned', 'surveyed', 'approved', 'rejected', 'requires_more_info', 'completed', 'sent_to_user']
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }],
  // Broker-specific fields
  brokerStatus: {
    type: String,
    enum: ['pending', 'under_review', 'rejected', 'completed'],
    default: 'pending'
  },
  brokerNotes: {
    type: String,
    default: ''
  },
  brokerAssignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BrokerAdmin'
  },
  brokerStatusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'under_review', 'rejected', 'completed']
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BrokerAdmin'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    reason: String,
    notes: String
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
PolicyRequestSchema.index({ userId: 1 });
PolicyRequestSchema.index({ status: 1 });
PolicyRequestSchema.index({ assignedSurveyors: 1 });
PolicyRequestSchema.index({ createdAt: -1 });
PolicyRequestSchema.index({ priority: 1, deadline: 1 });
// Broker-specific indexes
PolicyRequestSchema.index({ brokerStatus: 1 });
PolicyRequestSchema.index({ brokerAssignedTo: 1 });
PolicyRequestSchema.index({ brokerStatus: 1, createdAt: -1 });

// Middleware to update status history
PolicyRequestSchema.pre('save', function (next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date()
    });
  }

  // Track broker status changes
  if (this.isModified('brokerStatus') && !this.isNew) {
    this.brokerStatusHistory.push({
      status: this.brokerStatus,
      changedAt: new Date()
    });
  }

  next();
});

// Method to assign surveyor
PolicyRequestSchema.methods.assignSurveyor = function (surveyorId, assignedBy) {
  if (!this.assignedSurveyors.includes(surveyorId)) {
    this.assignedSurveyors.push(surveyorId);
    this.status = 'assigned';
    this.statusHistory.push({
      status: 'assigned',
      changedBy: assignedBy,
      changedAt: new Date(),
      reason: `Assigned to surveyor ${surveyorId}`
    });
  }
};

// Method to check if overdue
PolicyRequestSchema.methods.isOverdue = function () {
  return this.deadline < new Date() && !['completed', 'approved', 'rejected'].includes(this.status);
};

// Virtual for days remaining
PolicyRequestSchema.virtual('daysRemaining').get(function () {
  if (['completed', 'approved', 'rejected'].includes(this.status)) {
    return null;
  }
  const diff = this.deadline - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model('PolicyRequest', PolicyRequestSchema);
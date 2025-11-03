const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
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
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'Assigned by is required']
  },
  assignedAt: {
    type: Date,
    default: Date.now
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline is required']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['assigned', 'accepted', 'in-progress', 'completed', 'rejected', 'cancelled'],
    default: 'assigned'
  },
  instructions: {
    type: String,
    default: ''
  },
  organization: {
    type: String,
    enum: ['AMMC', 'NIA'],
    default: 'AMMC'
  },
  dualAssignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DualAssignment',
    default: null
  },
  partnerSurveyorContact: {
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
    organization: String,
    assignedAt: Date
  },
  specialRequirements: [{
    type: String,
    enum: [
      'urgent_inspection',
      'detailed_photos_required',
      'structural_engineer_needed',
      'hazmat_assessment',
      'drone_survey',
      'night_inspection',
      'weekend_availability'
    ]
  }],
  location: {
    address: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    accessInstructions: String,
    contactPerson: {
      name: String,
      phone: String,
      email: String,
      availableHours: String,
      rcNumber: String
    }
  },
  estimatedDuration: {
    type: Number, // in hours
    default: 4
  },
  actualDuration: {
    type: Number // in hours
  },
  progressTracking: {
    startedAt: Date,
    completedAt: Date,
    lastUpdate: {
      type: Date,
      default: Date.now
    },
    milestones: [{
      name: String,
      completedAt: Date,
      notes: String
    }],
    checkpoints: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      location: {
        latitude: Number,
        longitude: Number
      },
      notes: String,
      photos: [String] // URLs to photos
    }]
  },
  communication: {
    messages: [{
      from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
      },
      message: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      type: {
        type: String,
        enum: ['message', 'status_update', 'question', 'clarification'],
        default: 'message'
      }
    }],
    lastContact: Date
  },
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    feedback: String,
    ratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    },
    ratedAt: Date
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
      enum: ['survey_report', 'photos', 'receipts', 'legal_documents', 'inspection_forms', 'general'],
      default: 'general'
    },
    description: String,
    documentType: {
      type: String,
      enum: ['survey_document', 'photo', 'receipt', 'report', 'form', 'other'],
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
    isPublic: {
      type: Boolean,
      default: false
    },
    metadata: {
      location: {
        latitude: Number,
        longitude: Number
      },
      timestamp: Date,
      deviceInfo: String
    }
  }],
  timeline: [{
    action: {
      type: String,
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
    details: String,
    notes: String
  }],
  expenses: {
    transportation: {
      type: Number,
      default: 0
    },
    accommodation: {
      type: Number,
      default: 0
    },
    meals: {
      type: Number,
      default: 0
    },
    equipment: {
      type: Number,
      default: 0
    },
    other: {
      type: Number,
      default: 0
    },
    receipts: [{
      description: String,
      amount: Number,
      receiptUrl: String,
      category: {
        type: String,
        enum: ['transportation', 'accommodation', 'meals', 'equipment', 'other']
      }
    }],
    totalExpenses: {
      type: Number,
      default: 0
    },
    approved: {
      type: Boolean,
      default: false
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee'
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
AssignmentSchema.index({ surveyorId: 1, status: 1 });
AssignmentSchema.index({ ammcId: 1 });
AssignmentSchema.index({ assignedAt: -1 });
AssignmentSchema.index({ deadline: 1 });
AssignmentSchema.index({ priority: 1, deadline: 1 });
AssignmentSchema.index({ status: 1 });
AssignmentSchema.index({ organization: 1 });
AssignmentSchema.index({ dualAssignmentId: 1 });

// Middleware to calculate total expenses
AssignmentSchema.pre('save', function (next) {
  if (this.expenses) {
    this.expenses.totalExpenses =
      (this.expenses.transportation || 0) +
      (this.expenses.accommodation || 0) +
      (this.expenses.meals || 0) +
      (this.expenses.equipment || 0) +
      (this.expenses.other || 0);
  }
  next();
});

// Method to check if assignment is overdue
AssignmentSchema.methods.isOverdue = function () {
  return this.deadline < new Date() && !['completed', 'cancelled'].includes(this.status);
};

// Method to calculate days remaining
AssignmentSchema.methods.getDaysRemaining = function () {
  if (['completed', 'cancelled'].includes(this.status)) {
    return null;
  }
  const diff = this.deadline - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Method to update progress
AssignmentSchema.methods.updateProgress = function (milestone, notes) {
  this.progressTracking.milestones.push({
    name: milestone,
    completedAt: new Date(),
    notes: notes
  });
  this.progressTracking.lastUpdate = new Date();
};

// Method to add checkpoint
AssignmentSchema.methods.addCheckpoint = function (location, notes, photos = []) {
  this.progressTracking.checkpoints.push({
    timestamp: new Date(),
    location: location,
    notes: notes,
    photos: photos
  });
};

// Method to add message
AssignmentSchema.methods.addMessage = function (from, message, type = 'message') {
  this.communication.messages.push({
    from: from,
    message: message,
    timestamp: new Date(),
    type: type
  });
  this.communication.lastContact = new Date();
};

// Virtual for assignment duration (if completed)
AssignmentSchema.virtual('duration').get(function () {
  if (this.progressTracking.completedAt && this.progressTracking.startedAt) {
    const diff = this.progressTracking.completedAt - this.progressTracking.startedAt;
    return Math.round(diff / (1000 * 60 * 60)); // in hours
  }
  return null;
});

// Virtual for progress percentage
AssignmentSchema.virtual('progressPercentage').get(function () {
  const milestoneCount = this.progressTracking.milestones.length;
  const expectedMilestones = 5; // Define expected number of milestones
  return Math.min(Math.round((milestoneCount / expectedMilestones) * 100), 100);
});

module.exports = mongoose.model('Assignment', AssignmentSchema);
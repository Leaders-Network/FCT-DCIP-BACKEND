const mongoose = require('mongoose');

const SurveyorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: [true, 'User ID is required']
  },
  profile: {
    specialization: {
      type: [String],
      enum: ['residential', 'commercial', 'industrial', 'agricultural'],
      default: ['residential']
    },
    certifications: [{
      name: String,
      issuedBy: String,
      issuedDate: Date,
      expiryDate: Date
    }],
    experience: {
      type: Number,
      default: 0 // years of experience
    },
    location: {
      state: String,
      city: String,
      area: [String]
    },
    availability: {
      type: String,
      enum: ['available', 'busy', 'on-leave'],
      default: 'available'
    }
  },
  statistics: {
    totalAssignments: {
      type: Number,
      default: 0
    },
    completedSurveys: {
      type: Number,
      default: 0
    },
    pendingAssignments: {
      type: Number,
      default: 0
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalRatings: {
      type: Number,
      default: 0
    }
  },
  settings: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      },
      pushNotifications: {
        type: Boolean,
        default: true
      }
    },
    workingHours: {
      start: {
        type: String,
        default: '09:00'
      },
      end: {
        type: String,
        default: '17:00'
      },
      workingDays: {
        type: [String],
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
      }
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for efficient queries
SurveyorSchema.index({ userId: 1 });
SurveyorSchema.index({ 'profile.availability': 1 });
SurveyorSchema.index({ 'profile.location.state': 1 });
SurveyorSchema.index({ status: 1 });

// Method to update statistics
SurveyorSchema.methods.updateStatistics = async function() {
  const Assignment = mongoose.model('Assignment');
  const SurveySubmission = mongoose.model('SurveySubmission');
  
  const totalAssignments = await Assignment.countDocuments({ surveyorId: this.userId });
  const completedSurveys = await SurveySubmission.countDocuments({ surveyorId: this.userId });
  const pendingAssignments = await Assignment.countDocuments({ 
    surveyorId: this.userId, 
    status: { $in: ['assigned', 'in-progress'] }
  });
  
  this.statistics.totalAssignments = totalAssignments;
  this.statistics.completedSurveys = completedSurveys;
  this.statistics.pendingAssignments = pendingAssignments;
  
  await this.save();
};

module.exports = mongoose.model('Surveyor', SurveyorSchema);
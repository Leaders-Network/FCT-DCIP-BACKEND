const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  recipientId: {
    type: String,
    required: true,
    index: true
  },
  recipientType: {
    type: String,
    enum: ['user', 'employee', 'surveyor', 'admin', 'nia-admin', 'broker-admin'],
    required: true
  },
  type: {
    type: String,
    enum: [
      'policy_created',
      'policy_assigned',
      'policy_surveyed',
      'policy_approved',
      'policy_rejected',
      'policy_requires_revision',
      'assignment_created',
      'assignment_reassigned',
      'assignment_deadline_approaching',
      'assignment_overdue',
      'survey_submitted',
      'survey_reviewed',
      'report_ready',
      'report_released',
      'payment_required',
      'payment_received',
      'conflict_detected',
      'system_alert',
      'message_received'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  actionUrl: {
    type: String
  },
  actionLabel: {
    type: String
  },
  expiresAt: {
    type: Date
  },
  metadata: {
    policyId: String,
    assignmentId: String,
    reportId: String,
    surveyorId: String,
    icon: String,
    color: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
NotificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, type: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods
NotificationSchema.methods.markAsRead = function () {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Statics
NotificationSchema.statics.markAllAsRead = async function (recipientId) {
  return this.updateMany(
    { recipientId, read: false },
    { read: true, readAt: new Date() }
  );
};

NotificationSchema.statics.getUnreadCount = async function (recipientId) {
  return this.countDocuments({ recipientId, read: false });
};

NotificationSchema.statics.deleteOldNotifications = async function (daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    read: true
  });
};

module.exports = mongoose.model('Notification', NotificationSchema);

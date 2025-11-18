const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  claimId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PolicyRequest',
    required: [true, 'Claim ID is required']
  },
  type: {
    type: String,
    enum: ['status_change', 'assignment', 'completion', 'rejection', 'under_review'],
    required: [true, 'Notification type is required']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required']
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  metadata: {
    oldStatus: String,
    newStatus: String,
    rejectionReason: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);

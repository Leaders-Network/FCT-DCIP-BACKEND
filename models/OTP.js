const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Please provide email'],
      match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        'Please provide a valid email',
      ]
    },
    otp: {
      type: String,
      required: true,
    },
    // For password reset functionality
    resetToken: {
      type: String,
      default: null
    },
    resetTokenExpiry: {
      type: Date,
      default: null
    },
    verified: {
      type: Boolean,
      default: false
    },
    // Custom expiry for different use cases
    expiresAt: {
      type: Date,
      default: function () {
        return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes default
      }
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }
);

// Create index for automatic document expiration
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Check if model already exists to prevent OverwriteModelError
// Use both lowercase and check mongoose.models to ensure we don't overwrite
let Otp;
try {
    // First check if model exists in mongoose.models (case-insensitive check)
    if (mongoose.models.otp) {
        Otp = mongoose.models.otp;
    } else if (mongoose.models.Otp) {
        Otp = mongoose.models.Otp;
    } else {
        // Model doesn't exist, create it
        Otp = mongoose.model("otp", otpSchema);
    }
} catch (error) {
    // If there's an error, try to get existing model or create new one
    if (mongoose.models.otp) {
        Otp = mongoose.models.otp;
    } else {
        Otp = mongoose.model("otp", otpSchema);
    }
}

module.exports = Otp;
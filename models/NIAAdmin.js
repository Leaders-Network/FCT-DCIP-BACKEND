const mongoose = require('mongoose');

const NIAAdminSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: [true, 'User ID is required'],
        unique: true
    },
    organization: {
        type: String,
        default: 'NIA',
        immutable: true
    },
    permissions: {
        canAssignSurveyors: {
            type: Boolean,
            default: true
        },
        canManageSurveyors: {
            type: Boolean,
            default: true
        },
        canViewReports: {
            type: Boolean,
            default: true
        },
        canResolveConflicts: {
            type: Boolean,
            default: false
        },
        canAccessAnalytics: {
            type: Boolean,
            default: true
        }
    },
    profile: {
        department: String,
        position: String,
        licenseNumber: String,
        certifications: [{
            name: String,
            issuedBy: String,
            issuedDate: Date,
            expiryDate: Date
        }]
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
        dashboard: {
            defaultView: {
                type: String,
                enum: ['assignments', 'surveyors', 'reports', 'analytics'],
                default: 'assignments'
            },
            autoRefresh: {
                type: Boolean,
                default: true
            }
        }
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    lastLogin: Date,
    loginHistory: [{
        timestamp: {
            type: Date,
            default: Date.now
        },
        ipAddress: String,
        userAgent: String
    }]
}, {
    timestamps: true
});

// Indexes for efficient queries (userId already indexed due to unique: true)
NIAAdminSchema.index({ organization: 1 });
NIAAdminSchema.index({ status: 1 });
NIAAdminSchema.index({ lastLogin: -1 });

// Method to check if admin has specific permission
NIAAdminSchema.methods.hasPermission = function (permission) {
    return this.permissions[permission] === true;
};

// Method to update last login
NIAAdminSchema.methods.updateLastLogin = function (ipAddress, userAgent) {
    this.lastLogin = new Date();
    this.loginHistory.push({
        timestamp: new Date(),
        ipAddress: ipAddress,
        userAgent: userAgent
    });

    // Keep only last 10 login records
    if (this.loginHistory.length > 10) {
        this.loginHistory = this.loginHistory.slice(-10);
    }
};

module.exports = mongoose.model('NIAAdmin', NIAAdminSchema);
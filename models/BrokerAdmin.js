const mongoose = require('mongoose');

const BrokerAdminSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        unique: true
    },
    organization: {
        type: String,
        default: 'Broker'
    },
    brokerFirmName: {
        type: String,
        required: [true, 'Broker firm name is required']
    },
    brokerFirmLicense: {
        type: String,
        required: [true, 'Broker firm license is required']
    },
    permissions: {
        canViewClaims: {
            type: Boolean,
            default: true
        },
        canUpdateClaimStatus: {
            type: Boolean,
            default: true
        },
        canViewReports: {
            type: Boolean,
            default: true
        },
        canAccessAnalytics: {
            type: Boolean,
            default: false
        }
    },
    profile: {
        department: {
            type: String,
            default: 'Claims Management'
        },
        position: {
            type: String,
            default: 'Broker Administrator'
        },
        licenseNumber: {
            type: String,
            required: [true, 'License number is required']
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
            }
        },
        dashboard: {
            defaultView: {
                type: String,
                enum: ['claims', 'analytics', 'reports'],
                default: 'claims'
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
    lastLogin: {
        type: Date
    },
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

// Indexes for efficient queries
BrokerAdminSchema.index({ userId: 1 });
BrokerAdminSchema.index({ organization: 1 });
BrokerAdminSchema.index({ status: 1 });
BrokerAdminSchema.index({ lastLogin: -1 });
BrokerAdminSchema.index({ brokerFirmName: 1 });

// Method to check if broker has specific permission
BrokerAdminSchema.methods.hasPermission = function (permission) {
    return this.permissions[permission] === true;
};

// Method to update last login
BrokerAdminSchema.methods.updateLastLogin = function (ipAddress, userAgent) {
    this.lastLogin = new Date();
    this.loginHistory.push({
        timestamp: new Date(),
        ipAddress,
        userAgent
    });

    // Keep only last 50 login records
    if (this.loginHistory.length > 50) {
        this.loginHistory = this.loginHistory.slice(-50);
    }

    return this.save();
};

module.exports = mongoose.model('BrokerAdmin', BrokerAdminSchema);

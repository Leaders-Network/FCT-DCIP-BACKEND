const PolicyRequest = require('../models/PolicyRequest');
const BrokerAdmin = require('../models/BrokerAdmin');
const { BadRequestError, NotFoundError, UnauthorizedError } = require('../errors');

// Get Broker Dashboard Data
const getBrokerDashboardData = async (req, res) => {
    try {
        const brokerAdminId = req.brokerAdmin._id;

        // Aggregate claim statistics (only for policies with claim requests)
        const statistics = await PolicyRequest.aggregate([
            {
                $match: { claimRequested: true }
            },
            {
                $group: {
                    _id: '$brokerStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Format statistics
        const stats = {
            pending: 0,
            under_review: 0,
            rejected: 0,
            completed: 0,
            total: 0
        };

        statistics.forEach(stat => {
            if (stat._id && stats.hasOwnProperty(stat._id)) {
                stats[stat._id] = stat.count;
            }
            stats.total += stat.count;
        });

        // Calculate average processing time
        const completedClaims = await PolicyRequest.find({
            claimRequested: true,
            brokerStatus: 'completed',
            'brokerStatusHistory.0': { $exists: true }
        }).select('brokerStatusHistory createdAt');

        let totalProcessingTime = 0;
        let processedCount = 0;

        completedClaims.forEach(claim => {
            const firstStatus = claim.brokerStatusHistory[0];
            const lastStatus = claim.brokerStatusHistory[claim.brokerStatusHistory.length - 1];

            if (firstStatus && lastStatus) {
                const startTime = new Date(firstStatus.changedAt || claim.createdAt);
                const endTime = new Date(lastStatus.changedAt);
                const processingTime = (endTime - startTime) / (1000 * 60 * 60 * 24); // days

                totalProcessingTime += processingTime;
                processedCount++;
            }
        });

        const averageProcessingTime = processedCount > 0
            ? Math.round(totalProcessingTime / processedCount * 10) / 10
            : 0;

        // Get recent activity
        const recentActivity = await PolicyRequest.find({
            claimRequested: true,
            'brokerStatusHistory.0': { $exists: true }
        })
            .sort({ 'brokerStatusHistory.changedAt': -1 })
            .limit(10)
            .select('_id policyNumber brokerStatusHistory')
            .populate({
                path: 'brokerStatusHistory.changedBy',
                select: 'firstname lastname'
            });

        const formattedActivity = recentActivity.map(claim => {
            const latestChange = claim.brokerStatusHistory[claim.brokerStatusHistory.length - 1];
            return {
                claimId: claim._id,
                policyNumber: claim.policyNumber,
                action: `Status changed to ${latestChange.status}`,
                timestamp: latestChange.changedAt,
                performedBy: latestChange.changedBy
                    ? `${latestChange.changedBy.firstname} ${latestChange.changedBy.lastname}`
                    : 'System'
            };
        });

        res.status(200).json({
            success: true,
            data: {
                statistics: stats,
                averageProcessingTime,
                recentActivity: formattedActivity
            }
        });
    } catch (error) {
        console.error('Error fetching broker dashboard data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard data',
            message: error.message
        });
    }
};

// Get All Claims with Filters
const getAllClaims = async (req, res) => {
    try {
        const {
            status = 'all',
            dateFrom,
            dateTo,
            policyNumber,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            page = 1,
            limit = 10
        } = req.query;

        // Build query - only fetch policies with claim requests
        const query = { claimRequested: true };

        // Filter by broker status
        if (status && status !== 'all') {
            query.brokerStatus = status;
        }

        // Filter by date range
        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom) {
                query.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                query.createdAt.$lte = new Date(dateTo);
            }
        }

        // Filter by policy number
        if (policyNumber) {
            query.policyNumber = { $regex: policyNumber, $options: 'i' };
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query
        const [claims, total] = await Promise.all([
            PolicyRequest.find(query)
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .select('_id policyNumber propertyDetails contactDetails requestDetails brokerStatus priority createdAt updatedAt')
                .lean(),
            PolicyRequest.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            claims,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (error) {
        console.error('Error fetching claims:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch claims',
            message: error.message
        });
    }
};

// Get Claim by ID
const getClaimById = async (req, res) => {
    try {
        const { claimId } = req.params;

        const claim = await PolicyRequest.findById(claimId)
            .populate({
                path: 'brokerAssignedTo',
                select: 'brokerFirmName profile'
            })
            .populate({
                path: 'brokerStatusHistory.changedBy',
                select: 'firstname lastname email'
            })
            .lean();

        if (!claim) {
            throw new NotFoundError('Claim not found');
        }

        res.status(200).json({
            success: true,
            claim
        });
    } catch (error) {
        console.error('Error fetching claim:', error);

        if (error instanceof NotFoundError) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch claim',
                message: error.message
            });
        }
    }
};

// Update Claim Status
const updateClaimStatus = async (req, res) => {
    try {
        const { claimId } = req.params;
        const { status, reason, notes } = req.body;
        const brokerAdminId = req.brokerAdmin._id;

        // Validate status
        const validStatuses = ['under_review', 'rejected', 'completed'];
        if (!validStatuses.includes(status)) {
            throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        // Require reason for rejected status
        if (status === 'rejected' && !reason) {
            throw new BadRequestError('Reason is required when rejecting a claim');
        }

        // Find the claim
        const claim = await PolicyRequest.findById(claimId);
        if (!claim) {
            throw new NotFoundError('Claim not found');
        }

        // Validate status transition
        const currentStatus = claim.brokerStatus;
        const validTransitions = {
            'pending': ['under_review'],
            'under_review': ['rejected', 'completed'],
            'rejected': [], // Cannot transition from rejected
            'completed': [] // Cannot transition from completed
        };

        if (!validTransitions[currentStatus].includes(status)) {
            throw new BadRequestError(
                `Invalid status transition from ${currentStatus} to ${status}`
            );
        }

        // Update claim status
        claim.brokerStatus = status;
        if (notes) {
            claim.brokerNotes = notes;
        }
        if (!claim.brokerAssignedTo) {
            claim.brokerAssignedTo = brokerAdminId;
        }

        // Add to status history
        claim.brokerStatusHistory.push({
            status,
            changedBy: brokerAdminId,
            changedAt: new Date(),
            reason: reason || '',
            notes: notes || ''
        });

        await claim.save();

        // Populate the updated claim
        const updatedClaim = await PolicyRequest.findById(claimId)
            .populate({
                path: 'brokerAssignedTo',
                select: 'brokerFirmName profile'
            })
            .populate({
                path: 'brokerStatusHistory.changedBy',
                select: 'firstname lastname email'
            })
            .lean();

        // Trigger status propagation to other dashboards
        const { propagateBrokerStatusChange } = require('../services/statusPropagation');

        // Propagate asynchronously (don't wait for completion)
        propagateBrokerStatusChange(claimId, status, {
            changedBy: brokerAdminId,
            reason,
            notes,
            timestamp: new Date()
        }).catch(error => {
            console.error('Status propagation error:', error);
            // Log error but don't fail the request
        });

        res.status(200).json({
            success: true,
            message: 'Claim status updated successfully',
            claim: updatedClaim
        });
    } catch (error) {
        console.error('Error updating claim status:', error);

        if (error instanceof BadRequestError || error instanceof NotFoundError) {
            res.status(error.statusCode).json({
                success: false,
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to update claim status',
                message: error.message
            });
        }
    }
};

// Get Claim Analytics
const getClaimAnalytics = async (req, res) => {
    try {
        const { period = '30d' } = req.query;

        // Calculate date range based on period
        const now = new Date();
        let startDate = new Date();

        switch (period) {
            case '7d':
                startDate.setDate(now.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(now.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(now.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            default:
                startDate.setDate(now.getDate() - 30);
        }

        // Status distribution
        const statusDistribution = await PolicyRequest.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: '$brokerStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Processing time statistics
        const processingStats = await PolicyRequest.aggregate([
            {
                $match: {
                    brokerStatus: 'completed',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $project: {
                    processingTime: {
                        $divide: [
                            { $subtract: ['$updatedAt', '$createdAt'] },
                            1000 * 60 * 60 * 24 // Convert to days
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgProcessingTime: { $avg: '$processingTime' },
                    minProcessingTime: { $min: '$processingTime' },
                    maxProcessingTime: { $max: '$processingTime' }
                }
            }
        ]);

        // Trend data (daily claims)
        const trendData = await PolicyRequest.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                period,
                statusDistribution,
                processingStats: processingStats[0] || {
                    avgProcessingTime: 0,
                    minProcessingTime: 0,
                    maxProcessingTime: 0
                },
                trendData
            }
        });
    } catch (error) {
        console.error('Error fetching claim analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics',
            message: error.message
        });
    }
};

module.exports = {
    getBrokerDashboardData,
    getAllClaims,
    getClaimById,
    updateClaimStatus,
    getClaimAnalytics
};

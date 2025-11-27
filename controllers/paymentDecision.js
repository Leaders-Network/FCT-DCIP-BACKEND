const { StatusCodes } = require('http-status-codes');
const PaymentDecisionEngine = require('../services/PaymentDecisionEngine');
const MergedReport = require('../models/MergedReport');

// Initialize the payment decision engine
const paymentEngine = new PaymentDecisionEngine();

// @desc    Process payment decision for a specific merged report
// @route   POST /api/v1/payment-decision/process/:reportId
// @access  Private (Admin)
const processPaymentDecision = async (req, res) => {
    try {
        const { reportId } = req.params;

        // Check if report exists
        const report = await MergedReport.findById(reportId);
        if (!report) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Merged report not found'
            });
        }

        // Check if decision already exists
        if (report.paymentDecision) {
            return res.status(StatusCodes.CONFLICT).json({
                success: false,
                message: 'Payment decision already exists for this report',
                existingDecision: report.paymentDecision
            });
        }

        // Process the payment decision
        const result = await paymentEngine.analyzePaymentDecision(reportId);

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Payment decision processed successfully',
            data: result
        });

    } catch (error) {
        console.error('Process payment decision error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to process payment decision',
            error: error.message
        });
    }
};

// @desc    Process all pending payment decisions
// @route   POST /api/v1/payment-decision/process-all
// @access  Private (Admin)
const processAllPendingDecisions = async (req, res) => {
    try {
        const result = await paymentEngine.processAllPendingDecisions();

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Batch payment decision processing completed',
            data: result
        });

    } catch (error) {
        console.error('Process all pending decisions error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to process pending payment decisions',
            error: error.message
        });
    }
};

// @desc    Get payment decision statistics
// @route   GET /api/v1/payment-decision/stats
// @access  Private (Admin)
const getPaymentDecisionStats = async (req, res) => {
    try {
        const { timeframe = '7d' } = req.query;

        const stats = await paymentEngine.getDecisionStatistics(timeframe);

        res.status(StatusCodes.OK).json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Get payment decision stats error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get payment decision statistics',
            error: error.message
        });
    }
};

// @desc    Get payment decision for a specific report
// @route   GET /api/v1/payment-decision/:reportId
// @access  Private
const getPaymentDecision = async (req, res) => {
    try {
        const { reportId } = req.params;

        const report = await MergedReport.findById(reportId)
            .select('paymentDecision paymentEnabled finalRecommendation confidenceScore releaseStatus')
            .populate('policyId', 'contactDetails propertyDetails');

        if (!report) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Merged report not found'
            });
        }

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                reportId,
                paymentDecision: report.paymentDecision,
                paymentEnabled: report.paymentEnabled,
                finalRecommendation: report.finalRecommendation,
                confidenceScore: report.confidenceScore,
                releaseStatus: report.releaseStatus,
                policyInfo: report.policyId
            }
        });

    } catch (error) {
        console.error('Get payment decision error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get payment decision',
            error: error.message
        });
    }
};

// @desc    Override payment decision (admin manual override)
// @route   PUT /api/v1/payment-decision/:reportId/override
// @access  Private (Admin)
const overridePaymentDecision = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { decision, reasoning, overrideReason } = req.body;

        // Validate input
        const validDecisions = ['approve', 'conditional', 'reject', 'request_more_info'];
        if (!validDecisions.includes(decision)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Invalid decision value'
            });
        }

        const report = await MergedReport.findById(reportId);
        if (!report) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Merged report not found'
            });
        }

        // Store original decision for audit
        const originalDecision = report.paymentDecision;

        // Update with override
        report.paymentDecision = {
            decision,
            confidence: report.confidenceScore,
            reasoning: reasoning || ['Manual admin override'],
            conditions: [],
            requiredActions: [],
            reviewRequired: false,
            escalationLevel: 'none',
            decidedAt: new Date(),
            decidedBy: req.user.userId,
            isOverride: true,
            originalDecision,
            overrideReason: overrideReason || 'Admin manual override'
        };

        report.paymentEnabled = (decision === 'approve');

        await report.save();

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Payment decision overridden successfully',
            data: {
                reportId,
                newDecision: report.paymentDecision,
                originalDecision
            }
        });

    } catch (error) {
        console.error('Override payment decision error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to override payment decision',
            error: error.message
        });
    }
};

// @desc    Get reports pending payment decisions
// @route   GET /api/v1/payment-decision/pending
// @access  Private (Admin)
const getPendingDecisions = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const reports = await MergedReport.find({
            releaseStatus: 'approved',
            paymentDecision: { $exists: false }
        })
            .populate('policyId', 'propertyDetails contactDetails')
            .populate('dualAssignmentId')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await MergedReport.countDocuments({
            releaseStatus: 'approved',
            paymentDecision: { $exists: false }
        });

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                reports,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get pending decisions error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get pending payment decisions',
            error: error.message
        });
    }
};

module.exports = {
    processPaymentDecision,
    processAllPendingDecisions,
    getPaymentDecisionStats,
    getPaymentDecision,
    overridePaymentDecision,
    getPendingDecisions
};
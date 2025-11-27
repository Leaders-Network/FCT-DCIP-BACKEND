const express = require('express');
const router = express.Router();
const {
    processPaymentDecision,
    processAllPendingDecisions,
    getPaymentDecisionStats,
    getPaymentDecision,
    overridePaymentDecision,
    getPendingDecisions
} = require('../controllers/paymentDecision');
const { protect, restrictTo } = require('../middlewares/authentication');

// @route   POST /api/v1/payment-decision/process/:reportId
// @desc    Process payment decision for a specific merged report
// @access  Private (Admin)
router.post('/process/:reportId',
    protect,
    restrictTo('Admin', 'Super-admin'),
    processPaymentDecision
);

// @route   POST /api/v1/payment-decision/process-all
// @desc    Process all pending payment decisions
// @access  Private (Admin)
router.post('/process-all',
    protect,
    restrictTo('Admin', 'Super-admin'),
    processAllPendingDecisions
);

// @route   GET /api/v1/payment-decision/stats
// @desc    Get payment decision statistics
// @access  Private (Admin)
router.get('/stats',
    protect,
    restrictTo('Admin', 'Super-admin'),
    getPaymentDecisionStats
);

// @route   GET /api/v1/payment-decision/:reportId
// @desc    Get payment decision for a specific report
// @access  Private
router.get('/:reportId',
    protect,
    getPaymentDecision
);

// @route   PUT /api/v1/payment-decision/:reportId/override
// @desc    Override payment decision (admin manual override)
// @access  Private (Admin)
router.put('/:reportId/override',
    protect,
    restrictTo('Admin', 'Super-admin'),
    overridePaymentDecision
);

// @route   GET /api/v1/payment-decision/pending
// @desc    Get reports pending payment decisions
// @access  Private (Admin)
router.get('/pending',
    protect,
    restrictTo('Admin', 'Super-admin'),
    getPendingDecisions
);

module.exports = router;
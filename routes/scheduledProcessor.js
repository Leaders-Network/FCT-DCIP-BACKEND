const express = require('express');
const router = express.Router();
const {
    getProcessorStatus,
    triggerManualProcessing,
    retryFailedAssignments,
    resetProcessorStats
} = require('../controllers/scheduledProcessor');
const { protect, restrictTo } = require('../middlewares/authentication');

// @route   GET /api/v1/scheduled-processor/status
// @desc    Get processor status and statistics
// @access  Private (Admin)
router.get('/status',
    protect,
    restrictTo('Admin', 'Super-admin'),
    getProcessorStatus
);

// @route   POST /api/v1/scheduled-processor/trigger
// @desc    Manually trigger processing
// @access  Private (Admin)
router.post('/trigger',
    protect,
    restrictTo('Admin', 'Super-admin'),
    triggerManualProcessing
);

// @route   POST /api/v1/scheduled-processor/retry-failed
// @desc    Retry failed assignments
// @access  Private (Admin)
router.post('/retry-failed',
    protect,
    restrictTo('Admin', 'Super-admin'),
    retryFailedAssignments
);

// @route   POST /api/v1/scheduled-processor/reset-stats
// @desc    Reset processor statistics
// @access  Private (Admin)
router.post('/reset-stats',
    protect,
    restrictTo('Admin', 'Super-admin'),
    resetProcessorStats
);

module.exports = router;
const express = require('express');
const router = express.Router();
const {
    processDualAssignment,
    processAllPending,
    getMergedReport,
    getProcessingJobStatus,
    getMergingStats,
    reprocessMergedReport
} = require('../controllers/reportMerging');
const { protect, restrictTo } = require('../middlewares/authentication');

// @route   POST /api/v1/report-merging/process/:dualAssignmentId
// @desc    Process a specific dual assignment
// @access  Private (Admin)
router.post('/process/:dualAssignmentId',
    protect,
    restrictTo('Admin', 'Super-admin'),
    processDualAssignment
);

// @route   POST /api/v1/report-merging/process-all
// @desc    Process all pending dual assignments
// @access  Private (Admin)
router.post('/process-all',
    protect,
    restrictTo('Admin', 'Super-admin'),
    processAllPending
);

// @route   GET /api/v1/report-merging/merged-report/:reportId
// @desc    Get merged report details
// @access  Private (Admin/User)
router.get('/merged-report/:reportId',
    protect,
    getMergedReport
);

// @route   GET /api/v1/report-merging/job/:jobId
// @desc    Get processing job status
// @access  Private (Admin)
router.get('/job/:jobId',
    protect,
    restrictTo('Admin', 'Super-admin'),
    getProcessingJobStatus
);

// @route   GET /api/v1/report-merging/stats
// @desc    Get merging statistics
// @access  Private (Admin)
router.get('/stats',
    protect,
    restrictTo('Admin', 'Super-admin'),
    getMergingStats
);

// @route   POST /api/v1/report-merging/reprocess/:reportId
// @desc    Reprocess a merged report
// @access  Private (Admin)
router.post('/reprocess/:reportId',
    protect,
    restrictTo('Admin', 'Super-admin'),
    reprocessMergedReport
);

module.exports = router;
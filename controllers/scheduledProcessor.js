const { StatusCodes } = require('http-status-codes');
const scheduledProcessor = require('../services/ScheduledReportProcessor');

// @desc    Get scheduled processor status
// @route   GET /api/v1/scheduled-processor/status
// @access  Private (Admin)
const getProcessorStatus = async (req, res) => {
    try {
        const status = scheduledProcessor.getStatus();
        const pendingCount = await scheduledProcessor.getPendingCount();
        const failedAssignments = await scheduledProcessor.getFailedAssignments();

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                ...status,
                pendingAssignments: pendingCount,
                failedAssignments: failedAssignments.length,
                failedDetails: failedAssignments
            }
        });
    } catch (error) {
        console.error('Get processor status error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get processor status',
            error: error.message
        });
    }
};

// @desc    Manually trigger processing
// @route   POST /api/v1/scheduled-processor/trigger
// @access  Private (Admin)
const triggerManualProcessing = async (req, res) => {
    try {
        // Run processing in background
        setImmediate(async () => {
            await scheduledProcessor.triggerManualRun();
        });

        res.status(StatusCodes.ACCEPTED).json({
            success: true,
            message: 'Manual processing triggered successfully'
        });
    } catch (error) {
        console.error('Trigger manual processing error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to trigger manual processing',
            error: error.message
        });
    }
};

// @desc    Retry failed assignments
// @route   POST /api/v1/scheduled-processor/retry-failed
// @access  Private (Admin)
const retryFailedAssignments = async (req, res) => {
    try {
        await scheduledProcessor.retryFailedAssignments();

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Failed assignments reset for retry'
        });
    } catch (error) {
        console.error('Retry failed assignments error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to retry assignments',
            error: error.message
        });
    }
};

// @desc    Reset processor statistics
// @route   POST /api/v1/scheduled-processor/reset-stats
// @access  Private (Admin)
const resetProcessorStats = async (req, res) => {
    try {
        scheduledProcessor.resetStats();

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Processor statistics reset successfully'
        });
    } catch (error) {
        console.error('Reset processor stats error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to reset statistics',
            error: error.message
        });
    }
};

module.exports = {
    getProcessorStatus,
    triggerManualProcessing,
    retryFailedAssignments,
    resetProcessorStats
};
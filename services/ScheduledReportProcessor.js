const cron = require('node-cron');
const AutoReportMerger = require('./AutoReportMerger');
const DualAssignment = require('../models/DualAssignment');
const ProcessingJob = require('../models/ProcessingJob');

class ScheduledReportProcessor {
    constructor() {
        this.autoMerger = new AutoReportMerger();
        this.isRunning = false;
        this.lastRunTime = null;
        this.processingStats = {
            totalProcessed: 0,
            successCount: 0,
            errorCount: 0,
            lastError: null
        };
    }

    /**
     * Start the scheduled processor
     */
    start() {
        console.log('🕐 Starting scheduled report processor...');

        // Run every 5 minutes to check for completed assignments
        this.scheduledTask = cron.schedule('0 * * * *', async () => {
            await this.processCompletedAssignments();
        }, {
            scheduled: true,
            timezone: 'Africa/Lagos'
        });

        // Run every hour to clean up old processing jobs
        this.cleanupTask = cron.schedule('0 * * * *', async () => {
            await this.cleanupOldJobs();
        }, {
            scheduled: true,
            timezone: 'Africa/Lagos'
        });

        console.log('✅ Scheduled report processor started');
        console.log('📅 Processing schedule: Every 5 minutes');
        console.log('🧹 Cleanup schedule: Every hour');
    }

    /**
     * Stop the scheduled processor
     */
    stop() {
        if (this.scheduledTask) {
            this.scheduledTask.stop();
        }
        if (this.cleanupTask) {
            this.cleanupTask.stop();
        }
        console.log('⏹️ Scheduled report processor stopped');
    }

    /**
     * Process all completed dual assignments
     */
    async processCompletedAssignments() {
        if (this.isRunning) {
            console.log('⏳ Processor already running, skipping this cycle');
            return;
        }

        this.isRunning = true;
        this.lastRunTime = new Date();

        try {
            console.log('🔄 Checking for completed assignments to process...');

            // Find assignments that are completed but not yet processed
            const completedAssignments = await DualAssignment.find({
                completionStatus: 100,
                processingStatus: { $ne: 'completed' },
                mergedReportId: { $exists: false },
                // Only process assignments completed more than 2 minutes ago
                // to ensure both surveys are fully submitted
                updatedAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) }
            }).limit(10); // Process max 10 at a time to avoid overload

            if (completedAssignments.length === 0) {
                console.log('✅ No completed assignments found to process');
                return;
            }

            console.log(`📋 Found ${completedAssignments.length} assignments to process`);

            // Process each assignment
            for (const assignment of completedAssignments) {
                try {
                    console.log(`🔄 Processing assignment: ${assignment._id}`);

                    // Mark as processing to prevent duplicate processing
                    await DualAssignment.findByIdAndUpdate(assignment._id, {
                        processingStatus: 'processing',
                        processingStartedAt: new Date()
                    });

                    // Create processing job record
                    const processingJob = new ProcessingJob({
                        jobType: 'scheduled_report_merging',
                        entityId: assignment._id,
                        entityType: 'DualAssignment',
                        status: 'processing',
                        startedAt: new Date(),
                        initiatedBy: 'system'
                    });
                    await processingJob.save();

                    // Process the assignment
                    const result = await this.autoMerger.processDualAssignment(assignment._id);

                    // Update processing job
                    processingJob.status = 'completed';
                    processingJob.completedAt = new Date();
                    processingJob.result = result;
                    await processingJob.save();

                    this.processingStats.successCount++;
                    console.log(`✅ Successfully processed assignment: ${assignment._id}`);

                } catch (error) {
                    console.error(`❌ Failed to process assignment ${assignment._id}:`, error);

                    // Update assignment with error status
                    await DualAssignment.findByIdAndUpdate(assignment._id, {
                        processingStatus: 'failed',
                        processingError: error.message,
                        processingFailedAt: new Date()
                    });

                    this.processingStats.errorCount++;
                    this.processingStats.lastError = {
                        assignmentId: assignment._id,
                        error: error.message,
                        timestamp: new Date()
                    };
                }

                this.processingStats.totalProcessed++;
            }

            console.log(`📊 Processing cycle completed. Processed: ${completedAssignments.length}`);

        } catch (error) {
            console.error('❌ Error in scheduled processing cycle:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Clean up old processing jobs
     */
    async cleanupOldJobs() {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const result = await ProcessingJob.deleteMany({
                createdAt: { $lt: thirtyDaysAgo },
                status: { $in: ['completed', 'failed'] }
            });

            if (result.deletedCount > 0) {
                console.log(`🧹 Cleaned up ${result.deletedCount} old processing jobs`);
            }
        } catch (error) {
            console.error('❌ Error cleaning up old jobs:', error);
        }
    }

    /**
     * Get processor status and statistics
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastRunTime: this.lastRunTime,
            isScheduled: this.scheduledTask ? this.scheduledTask.running : false,
            stats: this.processingStats,
            nextRun: this.scheduledTask ? this.scheduledTask.nextDate() : null
        };
    }

    /**
     * Manually trigger processing (for testing/admin use)
     */
    async triggerManualRun() {
        console.log('🔧 Manual processing triggered');
        await this.processCompletedAssignments();
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.processingStats = {
            totalProcessed: 0,
            successCount: 0,
            errorCount: 0,
            lastError: null
        };
        console.log('📊 Processing statistics reset');
    }

    /**
     * Get pending assignments count
     */
    async getPendingCount() {
        return await DualAssignment.countDocuments({
            completionStatus: 100,
            processingStatus: { $ne: 'completed' },
            mergedReportId: { $exists: false }
        });
    }

    /**
     * Get failed assignments that need retry
     */
    async getFailedAssignments() {
        return await DualAssignment.find({
            processingStatus: 'failed',
            processingFailedAt: { $exists: true }
        }).select('_id processingError processingFailedAt');
    }

    /**
     * Retry failed assignments
     */
    async retryFailedAssignments() {
        const failedAssignments = await this.getFailedAssignments();

        console.log(`🔄 Retrying ${failedAssignments.length} failed assignments`);

        for (const assignment of failedAssignments) {
            try {
                // Reset status to allow reprocessing
                await DualAssignment.findByIdAndUpdate(assignment._id, {
                    processingStatus: 'pending',
                    $unset: {
                        processingError: 1,
                        processingFailedAt: 1
                    }
                });

                console.log(`✅ Reset assignment ${assignment._id} for retry`);
            } catch (error) {
                console.error(`❌ Failed to reset assignment ${assignment._id}:`, error);
            }
        }
    }
}

// Create singleton instance
const scheduledProcessor = new ScheduledReportProcessor();

module.exports = scheduledProcessor;
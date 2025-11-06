const mongoose = require('mongoose');
const DualAssignment = require('../models/DualAssignment');
const MergedReport = require('../models/MergedReport');
const AutoReportMerger = require('../services/AutoReportMerger');
const scheduledProcessor = require('../services/ScheduledReportProcessor');

async function diagnoseReportMerging() {
    try {
        console.log('🔍 Diagnosing Report Merging Issues...\n');

        // 1. Check dual assignments that should be processed
        console.log('1. Checking Dual Assignments:');
        const completedAssignments = await DualAssignment.find({
            completionStatus: 100
        }).populate('policyId', 'propertyDetails.address');

        console.log(`   - Total completed assignments: ${completedAssignments.length}`);

        const unprocessedAssignments = await DualAssignment.find({
            completionStatus: 100,
            $or: [
                { processingStatus: { $exists: false } },
                { processingStatus: { $ne: 'completed' } },
                { mergedReportId: { $exists: false } }
            ]
        }).populate('policyId', 'propertyDetails.address');

        console.log(`   - Unprocessed assignments: ${unprocessedAssignments.length}`);

        if (unprocessedAssignments.length > 0) {
            console.log('   - Unprocessed assignments details:');
            unprocessedAssignments.forEach((assignment, index) => {
                console.log(`     ${index + 1}. ID: ${assignment._id}`);
                console.log(`        Policy: ${assignment.policyId?._id}`);
                console.log(`        Address: ${assignment.policyId?.propertyDetails?.address || 'N/A'}`);
                console.log(`        Processing Status: ${assignment.processingStatus || 'undefined'}`);
                console.log(`        Has Merged Report: ${!!assignment.mergedReportId}`);
                console.log('');
            });
        }

        // 2. Check merged reports
        console.log('2. Checking Merged Reports:');
        const totalMergedReports = await MergedReport.countDocuments();
        const releasedReports = await MergedReport.countDocuments({ releaseStatus: 'released' });
        const pendingReports = await MergedReport.countDocuments({ releaseStatus: 'pending' });
        const withheldReports = await MergedReport.countDocuments({ releaseStatus: 'withheld' });

        console.log(`   - Total merged reports: ${totalMergedReports}`);
        console.log(`   - Released reports: ${releasedReports}`);
        console.log(`   - Pending reports: ${pendingReports}`);
        console.log(`   - Withheld reports: ${withheldReports}`);

        // 3. Check scheduled processor status
        console.log('\n3. Checking Scheduled Processor:');
        const processorStatus = scheduledProcessor.getStatus();
        console.log(`   - Is running: ${processorStatus.isRunning}`);
        console.log(`   - Is scheduled: ${processorStatus.isScheduled}`);
        console.log(`   - Last run: ${processorStatus.lastRunTime}`);
        console.log(`   - Total processed: ${processorStatus.stats.totalProcessed}`);
        console.log(`   - Success count: ${processorStatus.stats.successCount}`);
        console.log(`   - Error count: ${processorStatus.stats.errorCount}`);
        if (processorStatus.stats.lastError) {
            console.log(`   - Last error: ${processorStatus.stats.lastError.error}`);
        }

        // 4. Attempt to process unprocessed assignments
        if (unprocessedAssignments.length > 0) {
            console.log('\n4. Attempting to Process Unprocessed Assignments:');

            const autoMerger = new AutoReportMerger();

            for (let i = 0; i < Math.min(3, unprocessedAssignments.length); i++) {
                const assignment = unprocessedAssignments[i];
                console.log(`\n   Processing assignment ${i + 1}: ${assignment._id}`);

                try {
                    const result = await autoMerger.processDualAssignment(assignment._id);
                    console.log(`   ✅ Success: Merged report created with ID: ${result.mergedReportId}`);
                    console.log(`   📊 Conflicts detected: ${result.conflictsDetected}`);
                    console.log(`   🎯 Final recommendation: ${result.recommendation}`);
                } catch (error) {
                    console.log(`   ❌ Error: ${error.message}`);
                }
            }
        }

        // 5. Check if there are assignments awaiting merging
        console.log('\n5. Summary:');
        if (unprocessedAssignments.length === 0) {
            console.log('   ✅ All completed assignments have been processed');
        } else {
            console.log(`   ⚠️  ${unprocessedAssignments.length} assignments are awaiting processing`);
            console.log('   💡 Consider running manual processing or checking the scheduled processor');
        }

        if (pendingReports > 0 || withheldReports > 0) {
            console.log(`   ⚠️  ${pendingReports + withheldReports} merged reports are not yet released to users`);
            console.log('   💡 These reports may need admin review or conflict resolution');
        }

    } catch (error) {
        console.error('❌ Diagnosis failed:', error);
    }
}

// Run diagnosis if called directly
if (require.main === module) {
    const connectDB = require('../database/connectWithRetry');

    const runDiagnosis = async () => {
        try {
            const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fct-dcip-local';
            await connectDB(uri);
            await diagnoseReportMerging();
        } catch (error) {
            console.error('Failed to run diagnosis:', error);
        } finally {
            process.exit(0);
        }
    };

    runDiagnosis();
}

module.exports = { diagnoseReportMerging };
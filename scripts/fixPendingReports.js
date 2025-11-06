require('dotenv').config();
const mongoose = require('mongoose');
const DualAssignment = require('../models/DualAssignment');
const MergedReport = require('../models/MergedReport');
const AutoReportMerger = require('../services/AutoReportMerger');

async function fixPendingReports() {
    try {
        console.log('🔧 Fixing Pending Report Issues...\n');

        // Connect to database
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fct-dcip-local';
        await mongoose.connect(uri);
        console.log('✅ Connected to database\n');

        // 1. Find assignments that should have merged reports but don't
        const pendingAssignments = await DualAssignment.find({
            completionStatus: 100,
            $or: [
                { processingStatus: { $exists: false } },
                { processingStatus: { $ne: 'completed' } },
                { mergedReportId: { $exists: false } }
            ]
        }).populate('policyId', 'propertyDetails.address userId');

        console.log(`📋 Found ${pendingAssignments.length} assignments needing processing\n`);

        if (pendingAssignments.length === 0) {
            console.log('✅ No pending assignments found. All reports are up to date!');
            return;
        }

        // 2. Process each assignment
        const autoMerger = new AutoReportMerger();
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < pendingAssignments.length; i++) {
            const assignment = pendingAssignments[i];
            console.log(`\n🔄 Processing ${i + 1}/${pendingAssignments.length}: ${assignment._id}`);
            console.log(`   Policy: ${assignment.policyId._id}`);
            console.log(`   Address: ${assignment.policyId.propertyDetails?.address || 'N/A'}`);

            try {
                const result = await autoMerger.processDualAssignment(assignment._id);
                console.log(`   ✅ Success! Merged report: ${result.mergedReportId}`);
                console.log(`   📊 Conflicts: ${result.conflictsDetected}, Recommendation: ${result.recommendation}`);
                successCount++;
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                errorCount++;
            }
        }

        // 3. Release non-conflicted reports
        console.log('\n🚀 Releasing non-conflicted reports...');
        const pendingReports = await MergedReport.find({
            releaseStatus: 'pending',
            conflictDetected: false
        });

        let releasedCount = 0;
        for (const report of pendingReports) {
            try {
                report.releaseStatus = 'released';
                report.releasedAt = new Date();
                report.releasedBy = null; // System release
                await report.save();
                releasedCount++;
            } catch (error) {
                console.log(`   ❌ Failed to release report ${report._id}: ${error.message}`);
            }
        }

        // 4. Summary
        console.log('\n📊 Summary:');
        console.log(`   ✅ Successfully processed: ${successCount} assignments`);
        console.log(`   ❌ Failed to process: ${errorCount} assignments`);
        console.log(`   🚀 Released reports: ${releasedCount}`);

        if (errorCount > 0) {
            console.log('\n⚠️  Some assignments failed to process. Check the logs above for details.');
        }

        if (successCount > 0 || releasedCount > 0) {
            console.log('\n🎉 Report merging issues have been fixed!');
            console.log('   Users should now see their merged reports in the dashboard.');
        }

    } catch (error) {
        console.error('❌ Fix script failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from database');
        process.exit(0);
    }
}

// Run the fix
fixPendingReports();
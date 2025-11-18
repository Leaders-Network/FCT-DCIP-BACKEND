/**
 * Script to test and verify conflict detection in merged reports
 * This script checks if conflicts are properly detected when recommendations differ
 */

require('dotenv').config();
const mongoose = require('mongoose');
const MergedReport = require('../models/MergedReport');
const DualAssignment = require('../models/DualAssignment');
const SurveySubmission = require('../models/SurveySubmission');
const AutoReportMerger = require('../services/AutoReportMerger');

async function testConflictDetection() {
    try {
        console.log('🔍 Testing Conflict Detection System\n');
        console.log('='.repeat(60));

        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        // 1. Check existing merged reports for conflicts
        console.log('📊 Checking Existing Merged Reports:');
        console.log('-'.repeat(60));

        const allMergedReports = await MergedReport.find({})
            .populate('ammcReportId')
            .populate('niaReportId')
            .populate('policyId', 'propertyDetails')
            .sort({ createdAt: -1 })
            .limit(20);

        console.log(`Found ${allMergedReports.length} merged reports\n`);

        let conflictCount = 0;
        let noConflictCount = 0;
        let mismatchedRecommendations = 0;

        for (const report of allMergedReports) {
            const ammcRec = report.ammcReportId?.recommendedAction;
            const niaRec = report.niaReportId?.recommendedAction;
            const hasConflict = report.conflictDetected;
            const recommendationsDiffer = ammcRec && niaRec && ammcRec !== niaRec;

            console.log(`Report ID: ${report._id}`);
            console.log(`  Policy: ${report.policyId?.propertyDetails?.address || 'N/A'}`);
            console.log(`  AMMC Recommendation: ${ammcRec || 'N/A'}`);
            console.log(`  NIA Recommendation: ${niaRec || 'N/A'}`);
            console.log(`  Final Recommendation: ${report.finalRecommendation}`);
            console.log(`  Conflict Detected: ${hasConflict ? '✅ YES' : '❌ NO'}`);
            console.log(`  Conflict Details: ${report.conflictDetails ? JSON.stringify(report.conflictDetails) : 'None'}`);

            if (recommendationsDiffer && !hasConflict) {
                console.log(`  ⚠️  WARNING: Recommendations differ but no conflict detected!`);
                mismatchedRecommendations++;
            }

            if (hasConflict) {
                conflictCount++;
            } else {
                noConflictCount++;
            }

            console.log('');
        }

        console.log('='.repeat(60));
        console.log('📈 SUMMARY:');
        console.log(`  Total Reports: ${allMergedReports.length}`);
        console.log(`  With Conflicts: ${conflictCount}`);
        console.log(`  Without Conflicts: ${noConflictCount}`);
        console.log(`  ⚠️  Mismatched (should have conflict): ${mismatchedRecommendations}`);
        console.log('='.repeat(60));

        // 2. Check for dual assignments that need reprocessing
        console.log('\n🔄 Checking for Assignments Needing Reprocessing:');
        console.log('-'.repeat(60));

        const completedAssignments = await DualAssignment.find({
            completionStatus: 100,
            processingStatus: { $in: ['pending', 'failed', null] }
        }).populate('policyId', 'propertyDetails');

        console.log(`Found ${completedAssignments.length} completed assignments without merged reports\n`);

        if (completedAssignments.length > 0) {
            console.log('Would you like to process these? (This is a dry run, no processing will occur)');
            for (const assignment of completedAssignments) {
                console.log(`  - Assignment ${assignment._id}`);
                console.log(`    Policy: ${assignment.policyId?.propertyDetails?.address || 'N/A'}`);
                console.log(`    Completion: ${assignment.completionStatus}%`);
            }
        }

        // 3. Test the conflict detection logic directly
        console.log('\n🧪 Testing Conflict Detection Logic:');
        console.log('-'.repeat(60));

        const testCases = [
            { ammc: 'approve', nia: 'approve', shouldConflict: false },
            { ammc: 'approve', nia: 'reject', shouldConflict: true },
            { ammc: 'reject', nia: 'approve', shouldConflict: true },
            { ammc: 'reject', nia: 'reject', shouldConflict: false },
            { ammc: 'approve', nia: 'request_more_info', shouldConflict: true },
            { ammc: 'request_more_info', nia: 'reject', shouldConflict: true }
        ];

        const merger = new AutoReportMerger();

        for (const testCase of testCases) {
            const result = merger.mergeRecommendations(testCase.ammc, testCase.nia);
            const hasConflict = result.conflicts.length > 0;
            const passed = hasConflict === testCase.shouldConflict;

            console.log(`Test: AMMC=${testCase.ammc}, NIA=${testCase.nia}`);
            console.log(`  Expected Conflict: ${testCase.shouldConflict}`);
            console.log(`  Actual Conflict: ${hasConflict}`);
            console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
            console.log(`  Merged Recommendation: ${result.merged}`);
            if (result.conflicts.length > 0) {
                console.log(`  Conflict Details: ${JSON.stringify(result.conflicts[0])}`);
            }
            console.log('');
        }

        // 4. Provide recommendations
        console.log('='.repeat(60));
        console.log('💡 RECOMMENDATIONS:');
        console.log('='.repeat(60));

        if (mismatchedRecommendations > 0) {
            console.log(`\n⚠️  Found ${mismatchedRecommendations} reports with mismatched recommendations but no conflict flag.`);
            console.log('   These reports should be reprocessed to properly detect conflicts.');
            console.log('\n   To reprocess these reports, run:');
            console.log('   npm run reprocess-reports');
        }

        if (completedAssignments.length > 0) {
            console.log(`\n📋 Found ${completedAssignments.length} completed assignments without merged reports.`);
            console.log('   These should be processed to create merged reports.');
            console.log('\n   To process these assignments, run:');
            console.log('   npm run process-pending-reports');
        }

        if (mismatchedRecommendations === 0 && completedAssignments.length === 0) {
            console.log('\n✅ All reports are properly processed with correct conflict detection!');
        }

        console.log('\n' + '='.repeat(60));

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');

    } catch (error) {
        console.error('❌ Error testing conflict detection:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    testConflictDetection();
}

module.exports = testConflictDetection;

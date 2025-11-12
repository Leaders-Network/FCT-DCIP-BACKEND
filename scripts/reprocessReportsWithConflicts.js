/**
 * Script to reprocess merged reports that have conflicting recommendations
 * but weren't properly flagged with conflictDetected
 */

require('dotenv').config();
const mongoose = require('mongoose');
const MergedReport = require('../models/MergedReport');
const DualAssignment = require('../models/DualAssignment');
const AutoReportMerger = require('../services/AutoReportMerger');

async function reprocessReportsWithConflicts() {
    try {
        console.log('🔄 Reprocessing Reports with Conflicting Recommendations\n');
        console.log('='.repeat(60));

        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        // Find all merged reports
        const allMergedReports = await MergedReport.find({})
            .populate('ammcReportId')
            .populate('niaReportId')
            .populate('dualAssignmentId')
            .populate('policyId', 'propertyDetails');

        console.log(`📋 Found ${allMergedReports.length} merged reports\n`);

        let reprocessedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const report of allMergedReports) {
            const ammcRec = report.ammcReportId?.recommendedAction;
            const niaRec = report.niaReportId?.recommendedAction;
            const hasConflict = report.conflictDetected;
            const recommendationsDiffer = ammcRec && niaRec && ammcRec !== niaRec;

            console.log(`\nReport ID: ${report._id}`);
            console.log(`  Policy: ${report.policyId?.propertyDetails?.address || 'N/A'}`);
            console.log(`  AMMC: ${ammcRec} | NIA: ${niaRec}`);
            console.log(`  Current Conflict Flag: ${hasConflict}`);

            // Check if this report needs reprocessing
            if (recommendationsDiffer && !hasConflict) {
                console.log(`  ⚠️  Recommendations differ but no conflict detected - REPROCESSING...`);

                try {
                    // Update the conflict detection manually
                    const conflictDetails = {
                        conflictType: 'recommendation_mismatch',
                        ammcRecommendation: ammcRec,
                        niaRecommendation: niaRec,
                        ammcValue: report.reportSections?.ammc?.estimatedValue || 0,
                        niaValue: report.reportSections?.nia?.estimatedValue || 0,
                        discrepancyPercentage: 0,
                        conflictSeverity: 'critical'
                    };

                    // Determine final recommendation (more conservative)
                    let finalRecommendation;
                    if (ammcRec === 'reject' || niaRec === 'reject') {
                        finalRecommendation = 'reject';
                    } else if (ammcRec === 'request_more_info' || niaRec === 'request_more_info') {
                        finalRecommendation = 'request_more_info';
                    } else {
                        finalRecommendation = 'approve';
                    }

                    // Update the report
                    report.conflictDetected = true;
                    report.conflictResolved = false;
                    report.conflictDetails = conflictDetails;
                    report.finalRecommendation = finalRecommendation;
                    report.releaseStatus = 'withheld'; // Withhold reports with critical conflicts
                    report.paymentEnabled = false; // Disable payment for conflicted reports

                    await report.save();

                    console.log(`  ✅ Updated successfully`);
                    console.log(`     - Conflict Detected: true`);
                    console.log(`     - Final Recommendation: ${finalRecommendation}`);
                    console.log(`     - Release Status: withheld`);
                    reprocessedCount++;

                } catch (error) {
                    console.log(`  ❌ Error updating report: ${error.message}`);
                    errorCount++;
                }

            } else if (hasConflict && !recommendationsDiffer) {
                console.log(`  ℹ️  Conflict flag set but recommendations match - may need review`);
                skippedCount++;
            } else if (hasConflict && recommendationsDiffer) {
                console.log(`  ✅ Already properly flagged`);
                skippedCount++;
            } else {
                console.log(`  ✅ No conflict - recommendations match`);
                skippedCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 REPROCESSING SUMMARY:');
        console.log('='.repeat(60));
        console.log(`Total Reports Checked: ${allMergedReports.length}`);
        console.log(`✅ Reprocessed: ${reprocessedCount}`);
        console.log(`⏭️  Skipped: ${skippedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log('='.repeat(60));

        if (reprocessedCount > 0) {
            console.log('\n✅ Successfully reprocessed reports with conflicts!');
            console.log('   These reports are now:');
            console.log('   - Flagged with conflictDetected: true');
            console.log('   - Set to releaseStatus: withheld');
            console.log('   - Payment disabled');
            console.log('   - Admins can now review and resolve conflicts');
        }

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');

        if (errorCount > 0) {
            console.log('\n⚠️  Some reports had errors. Check the logs above.');
            process.exit(1);
        } else {
            process.exit(0);
        }

    } catch (error) {
        console.error('❌ Error reprocessing reports:', error);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    reprocessReportsWithConflicts();
}

module.exports = reprocessReportsWithConflicts;

const mongoose = require('mongoose');
const DualAssignment = require('../models/DualAssignment');
const MergedReport = require('../models/MergedReport');
const PolicyRequest = require('../models/PolicyRequest');
require('dotenv').config();

async function checkReportStatus() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to database');

        // Find all completed assignments with merged reports
        const completedAssignments = await DualAssignment.find({
            completionStatus: 100,
            processingStatus: 'completed',
            mergedReportId: { $exists: true }
        }).populate('policyId').populate('mergedReportId');

        console.log(`\n✅ Found ${completedAssignments.length} completed assignments with merged reports:\n`);

        for (const assignment of completedAssignments) {
            console.log(`📋 Assignment: ${assignment._id}`);
            console.log(`📄 Policy: ${assignment.policyId?.policyNumber || 'Unknown'}`);
            console.log(`🔄 Processing Status: ${assignment.processingStatus}`);
            console.log(`📊 Completion Status: ${assignment.completionStatus}%`);

            if (assignment.mergedReportId) {
                console.log(`📄 Merged Report: ${assignment.mergedReportId._id}`);
                console.log(`🔄 Release Status: ${assignment.mergedReportId.releaseStatus}`);
                console.log(`💰 Payment Enabled: ${assignment.mergedReportId.paymentEnabled}`);
                console.log(`📋 Final Recommendation: ${assignment.mergedReportId.finalRecommendation || 'Not set'}`);
                console.log(`⚠️ Conflicts Detected: ${assignment.mergedReportId.conflictDetected}`);

                // This is what the frontend should show
                if (assignment.mergedReportId.releaseStatus === 'released') {
                    console.log(`✅ STATUS: REPORT READY - User should see "Report Available"`);
                } else if (assignment.mergedReportId.releaseStatus === 'pending') {
                    console.log(`⏳ STATUS: UNDER REVIEW - User should see "Report Under Review"`);
                } else if (assignment.mergedReportId.releaseStatus === 'withheld') {
                    console.log(`⚠️ STATUS: WITHHELD - User should see "Report Withheld for Review"`);
                }
            }

            console.log(`${'='.repeat(80)}`);
        }

        // Check if there are any assignments still showing "AWAITING SURVEYS"
        const awaitingAssignments = await DualAssignment.find({
            $or: [
                { completionStatus: { $lt: 100 } },
                { processingStatus: { $ne: 'completed' } },
                { mergedReportId: { $exists: false } }
            ]
        }).populate('policyId');

        if (awaitingAssignments.length > 0) {
            console.log(`\n⚠️ Found ${awaitingAssignments.length} assignments that might still show "AWAITING SURVEYS":`);
            awaitingAssignments.forEach(assignment => {
                console.log(`  - ${assignment.policyId?.policyNumber || 'Unknown'}: ${assignment.completionStatus}% complete, ${assignment.processingStatus || 'pending'} processing`);
            });
        } else {
            console.log(`\n✅ No assignments should show "AWAITING SURVEYS" status anymore!`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkReportStatus();
const mongoose = require('mongoose');
const DualAssignment = require('../models/DualAssignment');
const MergedReport = require('../models/MergedReport');
const Assignment = require('../models/Assignment');
const PolicyRequest = require('../models/PolicyRequest');
const SurveySubmission = require('../models/SurveySubmission');
const AutoReportMerger = require('../services/AutoReportMerger');
require('dotenv').config();

async function fixStuckAssignments() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to database');

        // Find assignments that are completed but not processed
        const stuckAssignments = await DualAssignment.find({
            completionStatus: 100,
            $or: [
                { processingStatus: { $exists: false } },
                { processingStatus: { $ne: 'completed' } }
            ],
            mergedReportId: { $exists: false }
        }).populate('policyId');

        console.log(`Found ${stuckAssignments.length} stuck assignments`);

        for (const assignment of stuckAssignments) {
            try {
                console.log(`\n🔄 Processing assignment: ${assignment._id}`);
                console.log(`Policy: ${assignment.policyId?.policyNumber || 'Unknown'}`);

                // Check if merged report already exists
                const existingReport = await MergedReport.findOne({
                    policyId: assignment.policyId._id
                });

                if (existingReport) {
                    console.log(`📄 Merged report already exists: ${existingReport._id}`);

                    // Update assignment to point to existing report
                    await DualAssignment.findByIdAndUpdate(assignment._id, {
                        mergedReportId: existingReport._id,
                        processingStatus: 'completed',
                        completedAt: new Date()
                    });

                    console.log(`✅ Updated assignment to reference existing report`);
                } else {
                    console.log(`🔧 No merged report found, triggering merge...`);

                    // Update processing status first
                    await DualAssignment.findByIdAndUpdate(assignment._id, {
                        processingStatus: 'processing'
                    });

                    // Trigger merging
                    const merger = new AutoReportMerger();
                    const result = await merger.processDualAssignment(assignment._id);

                    console.log(`✅ Merge completed successfully`);
                    console.log(`📄 New merged report: ${result.mergedReportId}`);
                    console.log(`⚠️ Conflicts detected: ${result.conflictsDetected}`);
                    console.log(`📋 Recommendation: ${result.recommendation}`);
                }

            } catch (error) {
                console.error(`❌ Failed to process assignment ${assignment._id}:`, error.message);

                // Update with error status
                await DualAssignment.findByIdAndUpdate(assignment._id, {
                    processingStatus: 'failed',
                    processingError: error.message,
                    processingFailedAt: new Date()
                });
            }
        }

        console.log('\n✅ Finished processing stuck assignments');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixStuckAssignments();
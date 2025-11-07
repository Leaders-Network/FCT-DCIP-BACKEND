const mongoose = require('mongoose');
const DualAssignment = require('../models/DualAssignment');
const MergedReport = require('../models/MergedReport');
const SurveySubmission = require('../models/SurveySubmission');
const PolicyRequest = require('../models/PolicyRequest');
const AutoReportMerger = require('../services/AutoReportMerger');
require('dotenv').config();

async function debugReportProcessing() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to database');

        // Find the specific policy (690C895E)
        const policyNumber = '690C895E';

        // First, let's see what policies exist
        console.log('📋 Checking available policies...');
        const allPolicies = await PolicyRequest.find({}).select('policyNumber _id').limit(10);
        console.log('Available policies:', allPolicies.map(p => p.policyNumber));

        // Also check dual assignments
        const allDualAssignments = await DualAssignment.find({}).populate('policyId').limit(10);
        console.log('Dual assignments found:', allDualAssignments.length);
        allDualAssignments.forEach(da => {
            console.log(`  - ${da.policyId?.policyNumber || 'Unknown'} (${da._id}) - Status: ${da.completionStatus}%`);
        });

        // Check completed assignments that might need processing
        const completedAssignments = await DualAssignment.find({
            completionStatus: 100
        }).populate('policyId').populate('ammcAssignmentId').populate('niaAssignmentId');

        console.log(`\n🔍 Found ${completedAssignments.length} completed assignments:`);

        for (const assignment of completedAssignments) {
            console.log(`\n📋 Assignment: ${assignment._id}`);
            console.log(`📄 Policy: ${assignment.policyId?.policyNumber || 'Unknown'} (${assignment.policyId?._id})`);
            console.log(`🔄 Processing Status: ${assignment.processingStatus || 'undefined'}`);
            console.log(`🔗 Merged Report ID: ${assignment.mergedReportId || 'none'}`);

            // Check if this needs processing
            if (!assignment.mergedReportId && assignment.processingStatus !== 'completed') {
                console.log(`⚠️ This assignment needs processing!`);

                // Check for existing merged report
                const existingReport = await MergedReport.findOne({ policyId: assignment.policyId._id });
                if (existingReport) {
                    console.log(`📄 Found existing merged report: ${existingReport._id}`);
                    console.log(`🔄 Release Status: ${existingReport.releaseStatus}`);
                } else {
                    console.log(`❌ No merged report found - this is likely the issue!`);
                }
            }
        }

        // Find dual assignment for this policy
        const dualAssignment = await DualAssignment.findOne()
            .populate('policyId')
            .populate('ammcAssignmentId')
            .populate('niaAssignmentId')
            .where('policyId')
            .populate({
                path: 'policyId',
                match: { policyNumber: policyNumber }
            });

        if (!dualAssignment || !dualAssignment.policyId) {
            console.log(`❌ No dual assignment found for policy ${policyNumber}`);

            // Let's search more broadly
            const policy = await PolicyRequest.findOne({ policyNumber: policyNumber });

            if (policy) {
                console.log(`✅ Found policy: ${policy._id}`);

                const assignment = await DualAssignment.findOne({ policyId: policy._id })
                    .populate('policyId')
                    .populate('ammcAssignmentId')
                    .populate('niaAssignmentId');

                if (assignment) {
                    console.log(`✅ Found dual assignment: ${assignment._id}`);
                    console.log(`📊 Completion Status: ${assignment.completionStatus}%`);
                    console.log(`🔄 Processing Status: ${assignment.processingStatus || 'undefined'}`);
                    console.log(`📋 Assignment Status: ${assignment.assignmentStatus}`);
                    console.log(`🔗 Merged Report ID: ${assignment.mergedReportId || 'none'}`);

                    // Check if both reports are submitted
                    const ammcReportSubmitted = assignment.timeline.some(event => event.event === 'ammc_report_submitted');
                    const niaReportSubmitted = assignment.timeline.some(event => event.event === 'nia_report_submitted');

                    console.log(`📝 AMMC Report Submitted: ${ammcReportSubmitted}`);
                    console.log(`📝 NIA Report Submitted: ${niaReportSubmitted}`);

                    if (ammcReportSubmitted && niaReportSubmitted) {
                        console.log('✅ Both reports submitted');

                        // Check for existing merged report
                        const existingMergedReport = await MergedReport.findOne({ policyId: policy._id });
                        if (existingMergedReport) {
                            console.log(`📄 Existing merged report found: ${existingMergedReport._id}`);
                            console.log(`🔄 Release Status: ${existingMergedReport.releaseStatus}`);
                            console.log(`💰 Payment Enabled: ${existingMergedReport.paymentEnabled}`);
                        } else {
                            console.log('❌ No merged report found - this is the issue!');

                            // Try to trigger merging manually
                            console.log('🔧 Attempting manual merge...');
                            try {
                                const merger = new AutoReportMerger();
                                const result = await merger.processDualAssignment(assignment._id);
                                console.log('✅ Manual merge successful:', result);
                            } catch (mergeError) {
                                console.error('❌ Manual merge failed:', mergeError);
                            }
                        }
                    } else {
                        console.log('❌ Not both reports submitted yet');
                    }

                    // Show timeline
                    console.log('\n📅 Timeline:');
                    assignment.timeline.forEach(event => {
                        console.log(`  ${event.timestamp.toISOString()}: ${event.event} (${event.organization || 'SYSTEM'})`);
                    });

                } else {
                    console.log(`❌ No dual assignment found for policy ID: ${policy._id}`);
                }
            } else {
                console.log(`❌ Policy ${policyNumber} not found`);
            }

            return;
        }

        console.log(`✅ Found dual assignment for policy ${policyNumber}`);
        console.log(`Assignment ID: ${dualAssignment._id}`);
        console.log(`Completion Status: ${dualAssignment.completionStatus}%`);
        console.log(`Processing Status: ${dualAssignment.processingStatus || 'undefined'}`);

        // Check for survey submissions
        const ammcSurveyorId = dualAssignment.ammcAssignmentId?.surveyorId;
        const niaSurveyorId = dualAssignment.niaAssignmentId?.surveyorId;

        if (ammcSurveyorId && niaSurveyorId) {
            const [ammcSubmission, niaSubmission] = await Promise.all([
                SurveySubmission.findOne({
                    surveyorId: ammcSurveyorId,
                    policyId: dualAssignment.policyId._id,
                    status: 'completed'
                }).sort({ submittedAt: -1 }),
                SurveySubmission.findOne({
                    surveyorId: niaSurveyorId,
                    policyId: dualAssignment.policyId._id,
                    status: 'completed'
                }).sort({ submittedAt: -1 })
            ]);

            console.log(`AMMC Submission: ${ammcSubmission ? 'Found' : 'Not found'}`);
            console.log(`NIA Submission: ${niaSubmission ? 'Found' : 'Not found'}`);

            if (ammcSubmission && niaSubmission) {
                console.log('✅ Both submissions found - should be ready for merging');

                // Check if merged report already exists
                const existingReport = await MergedReport.findOne({ policyId: dualAssignment.policyId._id });
                if (existingReport) {
                    console.log(`Merged report already exists: ${existingReport._id}`);
                } else {
                    console.log('No merged report found - triggering merge...');
                    try {
                        const merger = new AutoReportMerger();
                        const result = await merger.processDualAssignment(dualAssignment._id);
                        console.log('Merge result:', result);
                    } catch (error) {
                        console.error('Merge failed:', error);
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugReportProcessing();
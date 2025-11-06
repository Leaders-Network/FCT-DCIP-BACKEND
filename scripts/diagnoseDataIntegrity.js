const mongoose = require('mongoose');
const DualAssignment = require('../models/DualAssignment');
const MergedReport = require('../models/MergedReport');
const Assignment = require('../models/Assignment');
const PolicyRequest = require('../models/PolicyRequest');
const SurveySubmission = require('../models/SurveySubmission');
require('dotenv').config();

async function diagnoseDataIntegrity() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to database');

        // Find completed assignments
        const completedAssignments = await DualAssignment.find({
            completionStatus: 100
        }).populate('policyId').populate('ammcAssignmentId').populate('niaAssignmentId');

        console.log(`\n🔍 Analyzing ${completedAssignments.length} completed assignments:\n`);

        for (const assignment of completedAssignments) {
            console.log(`\n📋 Assignment: ${assignment._id}`);
            console.log(`📄 Policy: ${assignment.policyId?.policyNumber || 'Unknown'} (${assignment.policyId?._id})`);
            console.log(`🔄 Processing Status: ${assignment.processingStatus || 'undefined'}`);

            // Check assignment details
            console.log(`🏢 AMMC Assignment: ${assignment.ammcAssignmentId?._id || 'none'}`);
            console.log(`🏛️ NIA Assignment: ${assignment.niaAssignmentId?._id || 'none'}`);

            // Get surveyor IDs from assignments
            let ammcSurveyorId = null;
            let niaSurveyorId = null;

            if (assignment.ammcAssignmentId) {
                ammcSurveyorId = assignment.ammcAssignmentId.surveyorId;
                console.log(`👨‍💼 AMMC Surveyor: ${ammcSurveyorId || 'not found'}`);
            }

            if (assignment.niaAssignmentId) {
                niaSurveyorId = assignment.niaAssignmentId.surveyorId;
                console.log(`👨‍💼 NIA Surveyor: ${niaSurveyorId || 'not found'}`);
            }

            // Check for survey submissions
            if (ammcSurveyorId && niaSurveyorId && assignment.policyId) {
                const [ammcSubmissions, niaSubmissions] = await Promise.all([
                    SurveySubmission.find({
                        surveyorId: ammcSurveyorId,
                        policyId: assignment.policyId._id
                    }).sort({ submittedAt: -1 }),
                    SurveySubmission.find({
                        surveyorId: niaSurveyorId,
                        policyId: assignment.policyId._id
                    }).sort({ submittedAt: -1 })
                ]);

                console.log(`📝 AMMC Submissions: ${ammcSubmissions.length} (completed: ${ammcSubmissions.filter(s => s.status === 'completed').length})`);
                console.log(`📝 NIA Submissions: ${niaSubmissions.length} (completed: ${niaSubmissions.filter(s => s.status === 'completed').length})`);

                if (ammcSubmissions.length > 0) {
                    const latest = ammcSubmissions[0];
                    console.log(`   Latest AMMC: ${latest.status} at ${latest.submittedAt || latest.createdAt}`);
                }

                if (niaSubmissions.length > 0) {
                    const latest = niaSubmissions[0];
                    console.log(`   Latest NIA: ${latest.status} at ${latest.submittedAt || latest.createdAt}`);
                }

                // Check if both have completed submissions
                const ammcCompleted = ammcSubmissions.find(s => s.status === 'completed');
                const niaCompleted = niaSubmissions.find(s => s.status === 'completed');

                if (ammcCompleted && niaCompleted) {
                    console.log(`✅ Both surveyors have completed submissions`);

                    // Check for existing merged report
                    const existingReport = await MergedReport.findOne({ policyId: assignment.policyId._id });
                    if (existingReport) {
                        console.log(`📄 Merged report exists: ${existingReport._id} (${existingReport.releaseStatus})`);

                        // Update assignment if needed
                        if (!assignment.mergedReportId) {
                            console.log(`🔧 Updating assignment to reference existing report`);
                            await DualAssignment.findByIdAndUpdate(assignment._id, {
                                mergedReportId: existingReport._id,
                                processingStatus: 'completed',
                                completedAt: new Date()
                            });
                        }
                    } else {
                        console.log(`❌ No merged report found - needs processing`);
                    }
                } else {
                    console.log(`❌ Missing completed submissions:`);
                    if (!ammcCompleted) console.log(`   - AMMC submission not completed`);
                    if (!niaCompleted) console.log(`   - NIA submission not completed`);
                }
            } else {
                console.log(`❌ Missing surveyor IDs or policy ID`);
            }

            // Check timeline
            console.log(`📅 Timeline events:`);
            assignment.timeline.forEach(event => {
                console.log(`   ${event.timestamp.toISOString()}: ${event.event} (${event.organization || 'SYSTEM'})`);
            });

            console.log(`${'='.repeat(80)}`);
        }

        console.log('\n✅ Diagnosis complete');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

diagnoseDataIntegrity();
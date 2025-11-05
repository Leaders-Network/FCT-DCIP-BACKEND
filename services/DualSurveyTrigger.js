const SurveySubmission = require('../models/SurveySubmission');
const DualAssignment = require('../models/DualAssignment');
const AutoReportMerger = require('./AutoReportMerger');

class DualSurveyTrigger {
    /**
     * Check if both surveys are completed and trigger merging
     * Called when a survey is submitted
     */
    static async checkAndTriggerMerging(policyId, submittedOrganization) {
        try {
            console.log(`🔍 Checking dual survey completion for policy: ${policyId}`);
            console.log(`📋 Survey submitted by: ${submittedOrganization}`);

            // Find the dual assignment for this policy
            const dualAssignment = await DualAssignment.findOne({ policyId })
                .populate('ammcAssignmentId')
                .populate('niaAssignmentId');

            if (!dualAssignment) {
                console.log(`⚠️ No dual assignment found for policy: ${policyId}`);
                return { success: false, reason: 'No dual assignment found' };
            }

            // Check if both assignments exist
            if (!dualAssignment.ammcAssignmentId || !dualAssignment.niaAssignmentId) {
                console.log(`⚠️ Missing assignment IDs for policy: ${policyId}`);
                return { success: false, reason: 'Missing assignment IDs' };
            }

            // Get survey submissions for both organizations
            const [ammcSubmission, niaSubmission] = await Promise.all([
                SurveySubmission.findOne({
                    ammcId: policyId,
                    organization: 'AMMC',
                    status: 'submitted'
                }).sort({ submissionTime: -1 }),

                SurveySubmission.findOne({
                    ammcId: policyId,
                    organization: 'NIA',
                    status: 'submitted'
                }).sort({ submissionTime: -1 })
            ]);

            console.log(`📊 AMMC submission found: ${!!ammcSubmission}`);
            console.log(`📊 NIA submission found: ${!!niaSubmission}`);

            // Check if both surveys are completed
            if (!ammcSubmission || !niaSubmission) {
                console.log(`⏳ Waiting for ${!ammcSubmission ? 'AMMC' : 'NIA'} survey completion`);

                // Update dual assignment progress
                const completedCount = (ammcSubmission ? 1 : 0) + (niaSubmission ? 1 : 0);
                const completionStatus = (completedCount / 2) * 100;

                await DualAssignment.findByIdAndUpdate(dualAssignment._id, {
                    completionStatus,
                    [`${submittedOrganization.toLowerCase()}Completed`]: true,
                    [`${submittedOrganization.toLowerCase()}CompletedAt`]: new Date()
                });

                return {
                    success: false,
                    reason: 'Waiting for other survey',
                    completionStatus
                };
            }

            // Both surveys are completed - update dual assignment
            await DualAssignment.findByIdAndUpdate(dualAssignment._id, {
                completionStatus: 100,
                ammcCompleted: true,
                niaCompleted: true,
                ammcCompletedAt: ammcSubmission.submissionTime,
                niaCompletedAt: niaSubmission.submissionTime,
                processingStatus: 'ready_for_merging'
            });

            console.log(`✅ Both surveys completed for policy: ${policyId}`);
            console.log(`🚀 Triggering automatic report merging...`);

            // Trigger automatic merging
            const mergingResult = await AutoReportMerger.triggerMerging(policyId, {
                dualAssignmentId: dualAssignment._id,
                ammcReportId: ammcSubmission._id,
                niaReportId: niaSubmission._id
            });

            console.log(`✅ Automatic merging completed for policy: ${policyId}`);

            return {
                success: true,
                dualAssignmentId: dualAssignment._id,
                mergingResult
            };

        } catch (error) {
            console.error(`❌ Error in dual survey trigger for policy: ${policyId}`, error);

            // Update dual assignment with error status
            try {
                await DualAssignment.findOneAndUpdate(
                    { policyId },
                    {
                        processingStatus: 'error',
                        processingError: error.message
                    }
                );
            } catch (updateError) {
                console.error('Failed to update dual assignment error status:', updateError);
            }

            throw error;
        }
    }

    /**
     * Manually trigger merging for a specific dual assignment
     * Used by admins or for retry scenarios
     */
    static async manualTrigger(dualAssignmentId) {
        try {
            console.log(`🔧 Manual trigger for dual assignment: ${dualAssignmentId}`);

            const dualAssignment = await DualAssignment.findById(dualAssignmentId);
            if (!dualAssignment) {
                throw new Error('Dual assignment not found');
            }

            // Check if already processed
            if (dualAssignment.processingStatus === 'completed') {
                return {
                    success: false,
                    reason: 'Already processed',
                    mergedReportId: dualAssignment.mergedReportId
                };
            }

            // Trigger merging
            const mergingResult = await AutoReportMerger.triggerMerging(dualAssignment.policyId, {
                dualAssignmentId: dualAssignment._id
            });

            return {
                success: true,
                mergingResult
            };

        } catch (error) {
            console.error(`❌ Manual trigger failed for: ${dualAssignmentId}`, error);
            throw error;
        }
    }

    /**
     * Get dual survey completion status for a policy
     */
    static async getCompletionStatus(policyId) {
        try {
            const dualAssignment = await DualAssignment.findOne({ policyId });
            if (!dualAssignment) {
                return {
                    hasDualAssignment: false,
                    completionStatus: 0,
                    ammcCompleted: false,
                    niaCompleted: false
                };
            }

            const [ammcSubmission, niaSubmission] = await Promise.all([
                SurveySubmission.findOne({
                    ammcId: policyId,
                    organization: 'AMMC',
                    status: 'submitted'
                }),
                SurveySubmission.findOne({
                    ammcId: policyId,
                    organization: 'NIA',
                    status: 'submitted'
                })
            ]);

            return {
                hasDualAssignment: true,
                dualAssignmentId: dualAssignment._id,
                completionStatus: dualAssignment.completionStatus,
                ammcCompleted: !!ammcSubmission,
                niaCompleted: !!niaSubmission,
                processingStatus: dualAssignment.processingStatus,
                mergedReportId: dualAssignment.mergedReportId,
                ammcSubmissionId: ammcSubmission?._id,
                niaSubmissionId: niaSubmission?._id
            };

        } catch (error) {
            console.error(`Error getting completion status for policy: ${policyId}`, error);
            throw error;
        }
    }

    /**
     * Retry failed merging processes
     */
    static async retryFailedMerging() {
        try {
            console.log('🔄 Checking for failed merging processes to retry...');

            const failedAssignments = await DualAssignment.find({
                completionStatus: 100,
                processingStatus: { $in: ['error', 'failed'] },
                mergedReportId: { $exists: false }
            });

            console.log(`📋 Found ${failedAssignments.length} failed assignments to retry`);

            const results = [];
            for (const assignment of failedAssignments) {
                try {
                    console.log(`🔄 Retrying assignment: ${assignment._id}`);

                    const result = await this.manualTrigger(assignment._id);
                    results.push({
                        assignmentId: assignment._id,
                        policyId: assignment.policyId,
                        success: result.success,
                        result
                    });

                } catch (error) {
                    console.error(`❌ Retry failed for assignment: ${assignment._id}`, error);
                    results.push({
                        assignmentId: assignment._id,
                        policyId: assignment.policyId,
                        success: false,
                        error: error.message
                    });
                }
            }

            return {
                totalProcessed: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results
            };

        } catch (error) {
            console.error('❌ Error in retry failed merging:', error);
            throw error;
        }
    }
}

module.exports = DualSurveyTrigger;
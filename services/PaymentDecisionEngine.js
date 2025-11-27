const MergedReport = require('../models/MergedReport');
const AutomaticConflictFlag = require('../models/AutomaticConflictFlag');
const PolicyRequest = require('../models/PolicyRequest');
const { sendPaymentDecisionNotification, sendReportAvailableNotification } = require('../utils/emailService');

class PaymentDecisionEngine {
    constructor() {
        this.decisionRules = {
            // Conflict severity impact on payment decisions
            conflictSeverityWeights: {
                'critical': -50,
                'high': -30,
                'medium': -15,
                'low': -5
            },

            // Confidence score thresholds
            confidenceThresholds: {
                approve: 85,
                conditional: 70,
                reject: 50
            },

            // Conflict type impact
            conflictTypeWeights: {
                'recommendation_mismatch': -40,
                'value_discrepancy': -25,
                'risk_assessment_difference': -20,
                'structural_disagreement': -30,
                'timeline_discrepancy': -10,
                'photo_evidence_conflict': -15,
                'condition_assessment_mismatch': -20,
                'other': -10
            }
        };
    }

    /**
     * Analyze merged report and make payment decision
     * @param {string} mergedReportId - The merged report ID
     * @returns {Promise<Object>} - Payment decision result
     */
    async analyzePaymentDecision(mergedReportId) {
        try {
            console.log(`🔍 Analyzing payment decision for report: ${mergedReportId}`);

            // Get merged report with all related data
            const mergedReport = await MergedReport.findById(mergedReportId)
                .populate('policyId')
                .populate('dualAssignmentId')
                .populate('ammcSubmissionId')
                .populate('niaSubmissionId');

            if (!mergedReport) {
                throw new Error('Merged report not found');
            }

            // Get conflict flags for this report
            const conflictFlags = await AutomaticConflictFlag.find({
                mergedReportId: mergedReportId,
                flagStatus: 'active'
            });

            // Analyze the decision
            const analysis = this.performDecisionAnalysis(mergedReport, conflictFlags);

            // Make the final decision
            const decision = this.makeFinalDecision(analysis);

            // Update the merged report with payment decision
            await this.updateReportWithDecision(mergedReport, decision);

            // Send notifications
            await this.sendDecisionNotifications(mergedReport, decision);

            console.log(`✅ Payment decision completed: ${decision.decision} for report: ${mergedReportId}`);

            return {
                success: true,
                decision,
                analysis,
                reportId: mergedReportId
            };

        } catch (error) {
            console.error(`❌ Payment decision analysis failed for report: ${mergedReportId}`, error);
            throw error;
        }
    }

    /**
     * Perform detailed decision analysis
     */
    performDecisionAnalysis(mergedReport, conflictFlags) {
        const analysis = {
            baseRecommendation: mergedReport.finalRecommendation,
            confidenceScore: mergedReport.confidenceScore,
            conflictCount: conflictFlags.length,
            conflictSeverities: this.analyzeConflictSeverities(conflictFlags),
            conflictTypes: this.analyzeConflictTypes(conflictFlags),
            releaseStatus: mergedReport.releaseStatus,
            adjustedScore: mergedReport.confidenceScore,
            riskFactors: [],
            mitigatingFactors: []
        };

        // Apply conflict severity penalties
        let severityPenalty = 0;
        conflictFlags.forEach(flag => {
            const penalty = this.decisionRules.conflictSeverityWeights[flag.conflictSeverity] || 0;
            severityPenalty += penalty;

            if (penalty < -20) {
                analysis.riskFactors.push(`${flag.conflictSeverity} severity conflict in ${flag.conflictType}`);
            }
        });

        // Apply conflict type penalties
        let typePenalty = 0;
        conflictFlags.forEach(flag => {
            const penalty = this.decisionRules.conflictTypeWeights[flag.conflictType] || 0;
            typePenalty += penalty;
        });

        // Calculate adjusted score
        analysis.adjustedScore = Math.max(0, analysis.confidenceScore + severityPenalty + typePenalty);

        // Identify mitigating factors
        if (mergedReport.releaseStatus === 'approved') {
            analysis.mitigatingFactors.push('Report approved for release');
        }

        if (analysis.confidenceScore >= 90) {
            analysis.mitigatingFactors.push('High initial confidence score');
        }

        if (conflictFlags.length === 0) {
            analysis.mitigatingFactors.push('No conflicts detected');
        }

        // Add penalty details
        analysis.penalties = {
            severityPenalty,
            typePenalty,
            totalPenalty: severityPenalty + typePenalty
        };

        return analysis;
    }

    /**
     * Make the final payment decision based on analysis
     */
    makeFinalDecision(analysis) {
        const decision = {
            decision: 'approve', // approve, conditional, reject, request_more_info
            paymentEnabled: false,
            confidence: analysis.adjustedScore,
            reasoning: [],
            conditions: [],
            requiredActions: [],
            reviewRequired: false,
            escalationLevel: 'none' // none, supervisor, manager, director
        };

        // Decision logic based on adjusted score and conflicts
        if (analysis.adjustedScore >= this.decisionRules.confidenceThresholds.approve &&
            analysis.conflictSeverities.critical === 0) {

            decision.decision = 'approve';
            decision.paymentEnabled = true;
            decision.reasoning.push('High confidence score with no critical conflicts');

        } else if (analysis.adjustedScore >= this.decisionRules.confidenceThresholds.conditional) {

            decision.decision = 'conditional';
            decision.paymentEnabled = false;
            decision.reasoning.push('Moderate confidence score - conditional approval pending review');

            // Add conditions based on conflicts
            if (analysis.conflictSeverities.high > 0) {
                decision.conditions.push('Resolve high-severity conflicts');
                decision.reviewRequired = true;
                decision.escalationLevel = 'supervisor';
            }

            if (analysis.conflictSeverities.medium > 2) {
                decision.conditions.push('Review multiple medium-severity conflicts');
            }

        } else if (analysis.adjustedScore >= this.decisionRules.confidenceThresholds.reject) {

            decision.decision = 'request_more_info';
            decision.paymentEnabled = false;
            decision.reasoning.push('Insufficient confidence - additional information required');
            decision.requiredActions.push('Conduct additional property assessment');
            decision.reviewRequired = true;
            decision.escalationLevel = 'manager';

        } else {

            decision.decision = 'reject';
            decision.paymentEnabled = false;
            decision.reasoning.push('Low confidence score or critical conflicts detected');
            decision.reviewRequired = true;
            decision.escalationLevel = 'director';

        }

        // Override for critical conflicts
        if (analysis.conflictSeverities.critical > 0) {
            decision.decision = 'reject';
            decision.paymentEnabled = false;
            decision.reasoning.push('Critical conflicts require manual resolution');
            decision.escalationLevel = 'director';
        }

        // Override for recommendation mismatches
        const hasRecommendationMismatch = analysis.conflictTypes.recommendation_mismatch > 0;
        if (hasRecommendationMismatch && decision.decision === 'approve') {
            decision.decision = 'conditional';
            decision.paymentEnabled = false;
            decision.conditions.push('Resolve surveyor recommendation mismatch');
            decision.reviewRequired = true;
        }

        // Add specific reasoning based on conflict types
        Object.keys(analysis.conflictTypes).forEach(type => {
            if (analysis.conflictTypes[type] > 0) {
                decision.reasoning.push(`${analysis.conflictTypes[type]} ${type.replace('_', ' ')} conflict(s) detected`);
            }
        });

        return decision;
    }

    /**
     * Update merged report with payment decision
     */
    async updateReportWithDecision(mergedReport, decision) {
        mergedReport.paymentEnabled = decision.paymentEnabled;
        mergedReport.paymentDecision = {
            decision: decision.decision,
            confidence: decision.confidence,
            reasoning: decision.reasoning,
            conditions: decision.conditions,
            requiredActions: decision.requiredActions,
            reviewRequired: decision.reviewRequired,
            escalationLevel: decision.escalationLevel,
            decidedAt: new Date(),
            decidedBy: 'PaymentDecisionEngine'
        };

        await mergedReport.save();
    }

    /**
     * Send decision notifications to relevant parties
     */
    async sendDecisionNotifications(mergedReport, decision) {
        try {
            // Get policy holder information
            const policy = mergedReport.policyId;

            // Send notification to policy holder
            await sendPaymentDecisionNotification(
                policy.contactDetails.email,
                {
                    policyId: policy._id,
                    decision: decision.decision,
                    reasoning: decision.reasoning,
                    conditions: decision.conditions,
                    requiredActions: decision.requiredActions,
                    reportId: mergedReport._id
                }
            );

            // Send report available notification
            await sendReportAvailableNotification(
                policy.contactDetails.email,
                {
                    policyId: policy._id,
                    reportId: mergedReport._id,
                    paymentEnabled: decision.paymentEnabled,
                    decision: decision.decision
                }
            );

            // If escalation required, notify admins
            if (decision.reviewRequired) {
                // TODO: Implement admin notification for review required cases
                console.log(`📧 Admin notification required for escalation level: ${decision.escalationLevel}`);
            }

        } catch (error) {
            console.error('Failed to send decision notifications:', error);
            // Don't throw error - notification failure shouldn't break the decision process
        }
    }

    /**
     * Analyze conflict severities
     */
    analyzeConflictSeverities(conflictFlags) {
        const severities = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        };

        conflictFlags.forEach(flag => {
            if (severities.hasOwnProperty(flag.conflictSeverity)) {
                severities[flag.conflictSeverity]++;
            }
        });

        return severities;
    }

    /**
     * Analyze conflict types
     */
    analyzeConflictTypes(conflictFlags) {
        const types = {};

        conflictFlags.forEach(flag => {
            if (types[flag.conflictType]) {
                types[flag.conflictType]++;
            } else {
                types[flag.conflictType] = 1;
            }
        });

        return types;
    }

    /**
     * Process all pending merged reports for payment decisions
     */
    async processAllPendingDecisions() {
        try {
            console.log('🔄 Processing all pending payment decisions...');

            // Find merged reports that need payment decisions
            const pendingReports = await MergedReport.find({
                releaseStatus: 'approved',
                paymentDecision: { $exists: false }
            }).limit(50); // Process in batches

            console.log(`📋 Found ${pendingReports.length} reports pending payment decisions`);

            const results = [];
            for (const report of pendingReports) {
                try {
                    const result = await this.analyzePaymentDecision(report._id);
                    results.push(result);
                } catch (error) {
                    console.error(`Failed to process payment decision for report ${report._id}:`, error);
                    results.push({
                        success: false,
                        reportId: report._id,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                processed: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results
            };

        } catch (error) {
            console.error('Error processing pending payment decisions:', error);
            throw error;
        }
    }

    /**
     * Get payment decision statistics
     */
    async getDecisionStatistics(timeframe = '7d') {
        try {
            const now = new Date();
            let timeFilter;

            switch (timeframe) {
                case '24h':
                    timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }

            const stats = await MergedReport.aggregate([
                {
                    $match: {
                        'paymentDecision.decidedAt': { $gte: timeFilter },
                        paymentDecision: { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: '$paymentDecision.decision',
                        count: { $sum: 1 },
                        avgConfidence: { $avg: '$paymentDecision.confidence' },
                        paymentEnabledCount: {
                            $sum: { $cond: ['$paymentEnabled', 1, 0] }
                        }
                    }
                }
            ]);

            return {
                timeframe,
                statistics: stats,
                totalDecisions: stats.reduce((sum, stat) => sum + stat.count, 0)
            };

        } catch (error) {
            console.error('Error getting decision statistics:', error);
            throw error;
        }
    }
}

module.exports = PaymentDecisionEngine;
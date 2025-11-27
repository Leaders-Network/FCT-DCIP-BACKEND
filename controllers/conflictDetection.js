const AutomaticConflictFlag = require('../models/AutomaticConflictFlag');
const MergedReport = require('../models/MergedReport');
const DualAssignment = require('../models/DualAssignment');
const { sendAutomaticConflictAlert } = require('../utils/emailService');

/**
 * Automatic conflict detection service
 * This service analyzes merged reports and creates conflict flags when discrepancies are found
 */
class ConflictDetectionService {

    /**
     * Main conflict detection method
     * @param {Object} mergedReport - The merged report to analyze
     * @param {Object} ammcReport - AMMC survey submission
     * @param {Object} niaReport - NIA survey submission
     * @returns {Object} Detection results
     */
    static async detectConflicts(mergedReport, ammcReport, niaReport) {
        try {
            const startTime = Date.now();
            const conflicts = [];

            // 1. Check recommendation conflicts
            const recommendationConflict = this.checkRecommendationConflict(ammcReport, niaReport);
            if (recommendationConflict) {
                conflicts.push(recommendationConflict);
            }

            // 2. Check value discrepancies
            const valueConflict = this.checkValueDiscrepancy(ammcReport, niaReport);
            if (valueConflict) {
                conflicts.push(valueConflict);
            }

            // 3. Check structural assessment differences
            const structuralConflict = this.checkStructuralAssessmentConflict(ammcReport, niaReport);
            if (structuralConflict) {
                conflicts.push(structuralConflict);
            }

            // 4. Check risk assessment differences
            const riskConflict = this.checkRiskAssessmentConflict(ammcReport, niaReport);
            if (riskConflict) {
                conflicts.push(riskConflict);
            }

            const processingTime = Date.now() - startTime;

            // If conflicts found, create conflict flags
            if (conflicts.length > 0) {
                const conflictFlag = await this.createConflictFlag(
                    mergedReport,
                    ammcReport,
                    niaReport,
                    conflicts,
                    processingTime
                );

                // Notify administrators
                await this.notifyAdministrators(conflictFlag);

                return {
                    conflictDetected: true,
                    conflictFlag: conflictFlag,
                    conflictCount: conflicts.length,
                    processingTime: processingTime
                };
            }

            return {
                conflictDetected: false,
                conflictCount: 0,
                processingTime: processingTime
            };

        } catch (error) {
            console.error('Error in conflict detection:', error);
            throw error;
        }
    }

    /**
     * Check for recommendation conflicts between AMMC and NIA reports
     */
    static checkRecommendationConflict(ammcReport, niaReport) {
        const ammcRec = this.extractRecommendation(ammcReport.recommendations || ammcReport.finalRecommendation);
        const niaRec = this.extractRecommendation(niaReport.recommendations || niaReport.finalRecommendation);

        if (ammcRec && niaRec && ammcRec !== niaRec) {
            return {
                type: 'recommendation_mismatch',
                severity: 'high',
                ammcValue: ammcRec,
                niaValue: niaRec,
                description: `AMMC recommends "${ammcRec}" while NIA recommends "${niaRec}"`
            };
        }

        return null;
    }

    /**
     * Check for value discrepancies between reports
     */
    static checkValueDiscrepancy(ammcReport, niaReport) {
        const ammcValue = parseFloat(ammcReport.estimatedValue || ammcReport.propertyValue || 0);
        const niaValue = parseFloat(niaReport.estimatedValue || niaReport.propertyValue || 0);

        if (ammcValue > 0 && niaValue > 0) {
            const discrepancy = Math.abs(ammcValue - niaValue) / Math.max(ammcValue, niaValue) * 100;

            if (discrepancy > 20) { // More than 20% difference
                return {
                    type: 'value_discrepancy',
                    severity: discrepancy > 50 ? 'critical' : 'medium',
                    ammcValue: ammcValue,
                    niaValue: niaValue,
                    discrepancyPercentage: discrepancy,
                    description: `Property value discrepancy of ${discrepancy.toFixed(1)}% (AMMC: ${ammcValue}, NIA: ${niaValue})`
                };
            }
        }

        return null;
    }

    /**
     * Check for structural assessment conflicts
     */
    static checkStructuralAssessmentConflict(ammcReport, niaReport) {
        const ammcStructural = ammcReport.structuralAssessment || ammcReport.structuralCondition || '';
        const niaStructural = niaReport.structuralAssessment || niaReport.structuralCondition || '';

        if (ammcStructural && niaStructural) {
            const ammcCondition = this.extractConditionLevel(ammcStructural);
            const niaCondition = this.extractConditionLevel(niaStructural);

            if (ammcCondition && niaCondition && ammcCondition !== niaCondition) {
                const severityDiff = Math.abs(this.getConditionSeverity(ammcCondition) - this.getConditionSeverity(niaCondition));

                if (severityDiff >= 2) { // Significant difference in condition assessment
                    return {
                        type: 'structural_disagreement',
                        severity: severityDiff >= 3 ? 'high' : 'medium',
                        ammcValue: ammcCondition,
                        niaValue: niaCondition,
                        description: `Structural condition assessment differs: AMMC reports "${ammcCondition}" while NIA reports "${niaCondition}"`
                    };
                }
            }
        }

        return null;
    }

    /**
     * Check for risk assessment conflicts
     */
    static checkRiskAssessmentConflict(ammcReport, niaReport) {
        const ammcRisk = ammcReport.riskFactors || ammcReport.riskAssessment || '';
        const niaRisk = niaReport.riskFactors || niaReport.riskAssessment || '';

        if (ammcRisk && niaRisk) {
            const ammcRiskLevel = this.extractRiskLevel(ammcRisk);
            const niaRiskLevel = this.extractRiskLevel(niaRisk);

            if (ammcRiskLevel && niaRiskLevel && ammcRiskLevel !== niaRiskLevel) {
                const riskDiff = Math.abs(this.getRiskSeverity(ammcRiskLevel) - this.getRiskSeverity(niaRiskLevel));

                if (riskDiff >= 2) {
                    return {
                        type: 'risk_assessment_difference',
                        severity: riskDiff >= 3 ? 'high' : 'medium',
                        ammcValue: ammcRiskLevel,
                        niaValue: niaRiskLevel,
                        description: `Risk assessment differs: AMMC identifies "${ammcRiskLevel}" risk while NIA identifies "${niaRiskLevel}" risk`
                    };
                }
            }
        }

        return null;
    }

    /**
     * Create conflict flag in database
     */
    static async createConflictFlag(mergedReport, ammcReport, niaReport, conflicts, processingTime) {
        // Determine overall severity
        const overallSeverity = this.determineOverallSeverity(conflicts);

        // Get primary conflict (highest severity)
        const primaryConflict = conflicts.reduce((prev, current) =>
            this.getSeverityLevel(current.severity) > this.getSeverityLevel(prev.severity) ? current : prev
        );

        // Create flagged sections
        const flaggedSections = conflicts.map(conflict => ({
            sectionName: conflict.type,
            ammcContent: String(conflict.ammcValue || ''),
            niaContent: String(conflict.niaValue || ''),
            conflictDescription: conflict.description,
            severity: conflict.severity
        }));

        const conflictFlag = new AutomaticConflictFlag({
            mergedReportId: mergedReport._id,
            policyId: mergedReport.policyId,
            dualAssignmentId: mergedReport.dualAssignmentId,
            conflictType: primaryConflict.type,
            conflictSeverity: overallSeverity,
            ammcRecommendation: String(ammcReport.recommendations || ammcReport.finalRecommendation || ''),
            niaRecommendation: String(niaReport.recommendations || niaReport.finalRecommendation || ''),
            ammcValue: parseFloat(ammcReport.estimatedValue || ammcReport.propertyValue || 0),
            niaValue: parseFloat(niaReport.estimatedValue || niaReport.propertyValue || 0),
            discrepancyPercentage: primaryConflict.discrepancyPercentage || null,
            flaggedSections: flaggedSections,
            detectionMetadata: {
                detectionAlgorithm: 'v1.0',
                detectedAt: new Date(),
                confidenceScore: this.calculateConfidenceScore(conflicts),
                processingTime: processingTime
            },
            priority: overallSeverity === 'critical' ? 'urgent' :
                overallSeverity === 'high' ? 'high' : 'normal'
        });

        await conflictFlag.save();
        return conflictFlag;
    }

    /**
     * Notify administrators about detected conflicts
     */
    static async notifyAdministrators(conflictFlag) {
        try {
            // Get admin emails (in production, fetch from database)
            const adminEmails = [
                'admin@ammc.gov.ng',
                'admin@nia.org.ng'
            ];

            for (const email of adminEmails) {
                await sendAutomaticConflictAlert(email, conflictFlag);
            }

            conflictFlag.adminNotified = true;
            await conflictFlag.save();

        } catch (error) {
            console.error('Error notifying administrators:', error);
        }
    }

    // Helper methods
    static extractRecommendation(text) {
        if (!text) return null;
        const lowerText = text.toLowerCase();

        if (lowerText.includes('approve') || lowerText.includes('accept') || lowerText.includes('recommend')) {
            return 'approve';
        } else if (lowerText.includes('reject') || lowerText.includes('deny') || lowerText.includes('not recommend')) {
            return 'reject';
        } else if (lowerText.includes('more info') || lowerText.includes('additional') || lowerText.includes('clarification')) {
            return 'request_more_info';
        }

        return 'unknown';
    }

    static extractConditionLevel(text) {
        if (!text) return null;
        const lowerText = text.toLowerCase();

        if (lowerText.includes('excellent') || lowerText.includes('perfect')) return 'excellent';
        if (lowerText.includes('good') || lowerText.includes('well maintained')) return 'good';
        if (lowerText.includes('fair') || lowerText.includes('average')) return 'fair';
        if (lowerText.includes('poor') || lowerText.includes('deteriorating')) return 'poor';
        if (lowerText.includes('critical') || lowerText.includes('dangerous')) return 'critical';

        return null;
    }

    static extractRiskLevel(text) {
        if (!text) return null;
        const lowerText = text.toLowerCase();

        if (lowerText.includes('low risk') || lowerText.includes('minimal')) return 'low';
        if (lowerText.includes('medium risk') || lowerText.includes('moderate')) return 'medium';
        if (lowerText.includes('high risk') || lowerText.includes('significant')) return 'high';
        if (lowerText.includes('critical risk') || lowerText.includes('severe')) return 'critical';

        return null;
    }

    static getConditionSeverity(condition) {
        const severityMap = { 'excellent': 1, 'good': 2, 'fair': 3, 'poor': 4, 'critical': 5 };
        return severityMap[condition] || 3;
    }

    static getRiskSeverity(risk) {
        const severityMap = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
        return severityMap[risk] || 2;
    }

    static getSeverityLevel(severity) {
        const levelMap = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4 };
        return levelMap[severity] || 2;
    }

    static determineOverallSeverity(conflicts) {
        const maxSeverity = Math.max(...conflicts.map(c => this.getSeverityLevel(c.severity)));
        const severityMap = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };
        return severityMap[maxSeverity] || 'medium';
    }

    static calculateConfidenceScore(conflicts) {
        // Base confidence score
        let score = 70;

        // Add points for each conflict type
        score += conflicts.length * 10;

        // Add points for high severity conflicts
        const highSeverityCount = conflicts.filter(c => ['high', 'critical'].includes(c.severity)).length;
        score += highSeverityCount * 15;

        // Cap at 100
        return Math.min(score, 100);
    }
}

module.exports = ConflictDetectionService;
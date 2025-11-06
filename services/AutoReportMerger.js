const MergedReport = require('../models/MergedReport');
const DualAssignment = require('../models/DualAssignment');
const SurveySubmission = require('../models/SurveySubmission');
const Assignment = require('../models/Assignment');
const AutomaticConflictFlag = require('../models/AutomaticConflictFlag');
const { sendAutomaticConflictAlert } = require('../utils/emailService');
const { Employee } = require('../models/Employee');
const ReportReleaseService = require('./ReportReleaseService');
const UserNotificationService = require('./UserNotificationService');

class AutoReportMerger {
    constructor() {
        this.processingQueue = [];
        this.isProcessing = false;
        this.reportReleaseService = new ReportReleaseService();
        this.conflictThresholds = {
            propertyValue: 0.15, // 15% difference threshold
            area: 0.10, // 10% difference threshold
            coordinates: 0.001, // GPS coordinate difference threshold
            recommendation: 'exact' // Must match exactly
        };
    }

    /**
     * Main entry point for automatic report merging
     */
    async processDualAssignment(dualAssignmentId) {
        try {
            console.log(`🔄 Starting automatic report merging for assignment: ${dualAssignmentId}`);

            const startTime = Date.now();

            // Get the dual assignment with populated data
            const dualAssignment = await DualAssignment.findById(dualAssignmentId)
                .populate('policyId')
                .populate('ammcAssignmentId')
                .populate('niaAssignmentId');

            if (!dualAssignment) {
                throw new Error('Dual assignment not found');
            }

            // Check if both surveys are completed
            if (dualAssignment.completionStatus !== 100) {
                throw new Error('Both surveys must be completed before merging');
            }

            // Get surveyor IDs from the assignments
            const ammcSurveyorId = dualAssignment.ammcAssignmentId?.surveyorId;
            const niaSurveyorId = dualAssignment.niaAssignmentId?.surveyorId;

            if (!ammcSurveyorId || !niaSurveyorId) {
                throw new Error('Surveyor IDs not found in assignments');
            }

            // Get survey submissions for both surveyors
            const [ammcSubmission, niaSubmission] = await Promise.all([
                this.getSurveySubmission(ammcSurveyorId, dualAssignment.policyId._id),
                this.getSurveySubmission(niaSurveyorId, dualAssignment.policyId._id)
            ]);

            if (!ammcSubmission || !niaSubmission) {
                throw new Error('Survey submissions not found for both surveyors');
            }

            // Perform the merging process
            const mergeResult = await this.mergeReports(dualAssignment, ammcSubmission, niaSubmission);

            // Calculate processing time
            const processingTime = Date.now() - startTime;

            // Create merged report
            const mergedReport = await this.createMergedReport({
                dualAssignment,
                ammcSubmission,
                niaSubmission,
                mergeResult,
                processingTime
            });

            // Update dual assignment status
            await DualAssignment.findByIdAndUpdate(dualAssignmentId, {
                mergedReportId: mergedReport._id,
                processingStatus: 'completed',
                completedAt: new Date()
            });

            console.log(`✅ Report merging completed for assignment: ${dualAssignmentId}`);

            return {
                success: true,
                mergedReportId: mergedReport._id,
                conflictsDetected: mergeResult.conflicts.length,
                processingTime,
                recommendation: mergeResult.finalRecommendation
            };

        } catch (error) {
            console.error(`❌ Report merging failed for assignment: ${dualAssignmentId}`, error);

            // Update dual assignment with error status
            await DualAssignment.findByIdAndUpdate(dualAssignmentId, {
                processingStatus: 'failed',
                processingError: error.message
            });

            throw error;
        }
    }

    /**
     * Get survey submission for a specific surveyor and policy
     */
    async getSurveySubmission(surveyorId, policyId) {
        return await SurveySubmission.findOne({
            surveyorId,
            ammcId: policyId, // Note: the field is called ammcId, not policyId
            status: { $in: ['submitted', 'approved'] } // Look for submitted or approved submissions
        }).sort({ submissionTime: -1 }); // Sort by submissionTime, not submittedAt
    }

    /**
     * Core merging logic
     */
    async mergeReports(dualAssignment, ammcSubmission, niaSubmission) {
        const conflicts = [];
        const mergedData = {};

        // 1. Merge property details (using surveyDetails instead of surveyData)
        const propertyMerge = this.mergePropertyDetails(
            ammcSubmission.surveyDetails,
            niaSubmission.surveyDetails
        );
        mergedData.propertyDetails = propertyMerge.merged;
        conflicts.push(...propertyMerge.conflicts);

        // 2. Merge measurements (create from available data)
        const measurementMerge = this.mergeMeasurements(
            { estimatedValue: ammcSubmission.surveyDetails.estimatedValue },
            { estimatedValue: niaSubmission.surveyDetails.estimatedValue }
        );
        mergedData.measurements = measurementMerge.merged;
        conflicts.push(...measurementMerge.conflicts);

        // 3. Merge valuations (create from available data)
        const valuationMerge = this.mergeValuations(
            { estimatedValue: ammcSubmission.surveyDetails.estimatedValue },
            { estimatedValue: niaSubmission.surveyDetails.estimatedValue }
        );
        mergedData.valuation = valuationMerge.merged;
        conflicts.push(...valuationMerge.conflicts);

        // 4. Merge recommendations
        const recommendationMerge = this.mergeRecommendations(
            ammcSubmission.recommendedAction,
            niaSubmission.recommendedAction
        );
        mergedData.finalRecommendation = recommendationMerge.merged;
        conflicts.push(...recommendationMerge.conflicts);

        // 5. Determine overall confidence and release status
        const overallAssessment = this.assessOverallQuality(conflicts, mergedData);

        return {
            mergedData,
            conflicts,
            finalRecommendation: mergedData.finalRecommendation,
            confidenceScore: overallAssessment.confidenceScore,
            releaseStatus: overallAssessment.releaseStatus,
            qualityMetrics: overallAssessment.qualityMetrics
        };
    }

    /**
     * Merge property details from both surveys
     */
    mergePropertyDetails(ammcData, niaData) {
        const merged = {};
        const conflicts = [];

        // Property condition comparison
        if (ammcData.propertyCondition !== niaData.propertyCondition) {
            conflicts.push({
                field: 'propertyCondition',
                type: 'mismatch',
                severity: 'medium',
                ammcValue: ammcData.propertyCondition,
                niaValue: niaData.propertyCondition,
                description: 'Property condition assessment differs between surveyors'
            });
        }

        // Structural assessment comparison
        if (ammcData.structuralAssessment !== niaData.structuralAssessment) {
            conflicts.push({
                field: 'structuralAssessment',
                type: 'mismatch',
                severity: 'high',
                ammcValue: ammcData.structuralAssessment,
                niaValue: niaData.structuralAssessment,
                description: 'Structural assessment differs between surveyors'
            });
        }

        // Risk factors comparison
        if (ammcData.riskFactors !== niaData.riskFactors) {
            conflicts.push({
                field: 'riskFactors',
                type: 'mismatch',
                severity: 'medium',
                ammcValue: ammcData.riskFactors,
                niaValue: niaData.riskFactors,
                description: 'Risk factors assessment differs between surveyors'
            });
        }

        // Use the more detailed assessment or combine them
        merged.propertyCondition = ammcData.propertyCondition?.length > niaData.propertyCondition?.length ?
            ammcData.propertyCondition : niaData.propertyCondition;
        merged.structuralAssessment = ammcData.structuralAssessment?.length > niaData.structuralAssessment?.length ?
            ammcData.structuralAssessment : niaData.structuralAssessment;
        merged.riskFactors = ammcData.riskFactors?.length > niaData.riskFactors?.length ?
            ammcData.riskFactors : niaData.riskFactors;

        return { merged, conflicts };
    }

    /**
     * Merge measurements from both surveys
     */
    mergeMeasurements(ammcData, niaData) {
        const merged = {};
        const conflicts = [];

        // For now, we don't have specific measurement data in the current schema
        // This is a placeholder for future enhancement
        merged.notes = 'Measurements data not available in current survey format';

        return { merged, conflicts };
    }

    /**
     * Merge valuations from both surveys
     */
    mergeValuations(ammcData, niaData) {
        const merged = {};
        const conflicts = [];

        // Property value
        if (ammcData.estimatedValue && niaData.estimatedValue) {
            const valueDiff = Math.abs(ammcData.estimatedValue - niaData.estimatedValue) /
                Math.max(ammcData.estimatedValue, niaData.estimatedValue);

            if (valueDiff > this.conflictThresholds.propertyValue) {
                conflicts.push({
                    field: 'estimatedValue',
                    type: 'significant_difference',
                    severity: valueDiff > 0.30 ? 'high' : 'medium',
                    ammcValue: ammcData.estimatedValue,
                    niaValue: niaData.estimatedValue,
                    difference: `${(valueDiff * 100).toFixed(1)}%`,
                    description: 'Significant difference in property valuation'
                });
            }

            merged.estimatedValue = (ammcData.estimatedValue + niaData.estimatedValue) / 2;
        } else {
            merged.estimatedValue = ammcData.estimatedValue || niaData.estimatedValue;
        }

        // Market value
        merged.marketValue = this.averageIfBothExist(ammcData.marketValue, niaData.marketValue);

        // Valuation method - prefer more detailed one
        merged.valuationMethod = ammcData.valuationMethod || niaData.valuationMethod;

        return { merged, conflicts };
    }

    /**
     * Merge recommendations from both surveys
     */
    mergeRecommendations(ammcRecommendation, niaRecommendation) {
        const conflicts = [];
        let merged;

        if (ammcRecommendation !== niaRecommendation) {
            conflicts.push({
                field: 'recommendation',
                type: 'mismatch',
                severity: 'critical',
                ammcValue: ammcRecommendation,
                niaValue: niaRecommendation,
                description: 'Surveyors have different recommendations'
            });

            // Default to more conservative recommendation
            if (ammcRecommendation === 'reject' || niaRecommendation === 'reject') {
                merged = 'reject';
            } else if (ammcRecommendation === 'conditional' || niaRecommendation === 'conditional') {
                merged = 'conditional';
            } else {
                merged = 'approve';
            }
        } else {
            merged = ammcRecommendation;
        }

        return { merged, conflicts };
    }

    /**
     * Assess overall quality and determine release status
     */
    assessOverallQuality(conflicts, mergedData) {
        let confidenceScore = 100;
        let releaseStatus = 'approved';

        const criticalConflicts = conflicts.filter(c => c.severity === 'critical').length;
        const highConflicts = conflicts.filter(c => c.severity === 'high').length;
        const mediumConflicts = conflicts.filter(c => c.severity === 'medium').length;

        // Reduce confidence based on conflicts
        confidenceScore -= (criticalConflicts * 30);
        confidenceScore -= (highConflicts * 15);
        confidenceScore -= (mediumConflicts * 5);

        // Determine release status
        if (criticalConflicts > 0) {
            releaseStatus = 'withheld';
        } else if (highConflicts > 2 || confidenceScore < 70) {
            releaseStatus = 'pending';
        } else {
            releaseStatus = 'released';
        }

        return {
            confidenceScore: Math.max(0, confidenceScore),
            releaseStatus,
            qualityMetrics: {
                totalConflicts: conflicts.length,
                criticalConflicts,
                highConflicts,
                mediumConflicts,
                dataCompleteness: this.calculateDataCompleteness(mergedData)
            }
        };
    }

    /**
     * Create the merged report in database
     */
    async createMergedReport({ dualAssignment, ammcSubmission, niaSubmission, mergeResult, processingTime }) {
        // Extract report sections from submissions
        const reportSections = {
            ammc: {
                propertyCondition: ammcSubmission.surveyDetails?.propertyCondition || 'Not specified',
                structuralAssessment: ammcSubmission.surveyDetails?.structuralAssessment || 'Assessment completed',
                riskFactors: ammcSubmission.surveyDetails?.riskFactors || 'Standard risk factors assessed',
                recommendations: ammcSubmission.recommendedAction || 'No specific recommendation',
                estimatedValue: ammcSubmission.surveyDetails?.estimatedValue || 0,
                surveyorName: 'AMMC Surveyor', // We'll need to populate this from the surveyor data
                surveyorLicense: 'Licensed',
                submissionDate: ammcSubmission.submissionTime || new Date(),
                photos: ammcSubmission.surveyDetails?.photos || []
            },
            nia: {
                propertyCondition: niaSubmission.surveyDetails?.propertyCondition || 'Not specified',
                structuralAssessment: niaSubmission.surveyDetails?.structuralAssessment || 'Assessment completed',
                riskFactors: niaSubmission.surveyDetails?.riskFactors || 'Standard risk factors assessed',
                recommendations: niaSubmission.recommendedAction || 'No specific recommendation',
                estimatedValue: niaSubmission.surveyDetails?.estimatedValue || 0,
                surveyorName: 'NIA Surveyor', // We'll need to populate this from the surveyor data
                surveyorLicense: 'Licensed',
                submissionDate: niaSubmission.submissionTime || new Date(),
                photos: niaSubmission.surveyDetails?.photos || []
            }
        };

        // Determine conflict details if conflicts exist
        let conflictDetails = {};
        if (mergeResult.conflicts.length > 0) {
            const criticalConflict = mergeResult.conflicts.find(c => c.severity === 'critical');
            const highConflict = mergeResult.conflicts.find(c => c.severity === 'high');
            const primaryConflict = criticalConflict || highConflict || mergeResult.conflicts[0];

            conflictDetails = {
                conflictType: this.mapConflictType(primaryConflict.field),
                ammcRecommendation: primaryConflict.ammcValue,
                niaRecommendation: primaryConflict.niaValue,
                ammcValue: primaryConflict.field === 'estimatedValue' ? primaryConflict.ammcValue : (reportSections.ammc.estimatedValue || 0),
                niaValue: primaryConflict.field === 'estimatedValue' ? primaryConflict.niaValue : (reportSections.nia.estimatedValue || 0),
                discrepancyPercentage: primaryConflict.difference ? parseFloat(primaryConflict.difference.replace('%', '')) : 0,
                conflictSeverity: primaryConflict.severity
            };
        }

        const mergedReport = new MergedReport({
            policyId: dualAssignment.policyId._id,
            dualAssignmentId: dualAssignment._id,
            ammcReportId: ammcSubmission._id,
            niaReportId: niaSubmission._id,

            // Report sections
            reportSections,

            // Conflict information
            conflictDetected: mergeResult.conflicts.length > 0,
            conflictResolved: false,
            conflictDetails: mergeResult.conflicts.length > 0 ? conflictDetails : undefined,

            // Final recommendation
            finalRecommendation: mergeResult.finalRecommendation,

            // Release status
            releaseStatus: mergeResult.releaseStatus,

            // Processing metadata
            mergingMetadata: {
                mergedBy: 'SYSTEM',
                mergedAt: new Date(),
                mergingAlgorithmVersion: '1.0.0',
                processingTime,
                qualityScore: mergeResult.confidenceScore
            },

            // Payment status
            paymentEnabled: mergeResult.releaseStatus === 'released' &&
                mergeResult.finalRecommendation === 'approve' &&
                mergeResult.conflicts.length === 0,

            // Notification status
            notifications: {
                userNotified: false,
                adminNotified: false,
                conflictNotificationSent: false,
                releaseNotificationSent: false
            }
        });

        await mergedReport.save();

        // If conflicts detected, create automatic conflict flags
        if (mergeResult.conflicts.length > 0) {
            await this.createConflictFlags(mergedReport, mergeResult.conflicts);
        }

        // Trigger automatic report release and payment decision processing
        setImmediate(async () => {
            try {
                // First, attempt automatic report release
                const releaseResult = await this.reportReleaseService.autoReleaseReport(mergedReport._id);

                if (releaseResult.success) {
                    console.log(`🚀 Report ${mergedReport._id} automatically released`);

                    // Notify user that report is ready
                    await UserNotificationService.notifyReportReady(mergedReport._id);

                    // If released, process payment decision
                    const PaymentDecisionEngine = require('./PaymentDecisionEngine');
                    const paymentEngine = new PaymentDecisionEngine();
                    await paymentEngine.analyzePaymentDecision(mergedReport._id);
                    console.log(`💰 Payment decision processed for report: ${mergedReport._id}`);
                } else {
                    console.log(`⏸️ Report ${mergedReport._id} requires manual review: ${releaseResult.reason}`);
                }
            } catch (error) {
                console.error(`❌ Post-processing failed for report: ${mergedReport._id}`, error);
            }
        });

        return mergedReport;
    }

    /**
     * Create automatic conflict flags for detected conflicts
     */
    async createConflictFlags(mergedReport, conflicts) {
        for (const conflict of conflicts) {
            if (conflict.severity === 'critical' || conflict.severity === 'high') {
                const conflictFlag = new AutomaticConflictFlag({
                    mergedReportId: mergedReport._id,
                    policyId: mergedReport.policyId,
                    dualAssignmentId: mergedReport.dualAssignmentId,
                    conflictType: conflict.field,
                    conflictSeverity: conflict.severity,
                    ammcRecommendation: conflict.ammcValue,
                    niaRecommendation: conflict.niaValue,
                    conflictDescription: conflict.description,
                    detectionMetadata: {
                        detectedAt: new Date(),
                        detectionMethod: 'automatic',
                        algorithmVersion: '1.0.0',
                        confidenceLevel: 'high'
                    }
                });

                await conflictFlag.save();

                // Send notification to admins
                await this.notifyAdminsOfConflict(conflictFlag);
            }
        }
    }

    /**
     * Notify admins of detected conflicts
     */
    async notifyAdminsOfConflict(conflictFlag) {
        try {
            // Get all admin emails
            const admins = await Employee.find({
                'employeeRole.role': { $in: ['Admin', 'Super-admin'] },
                'employeeStatus.status': 'Active'
            }).populate('employeeRole employeeStatus');

            const adminEmails = admins.map(admin => admin.email);

            // Send notifications
            for (const email of adminEmails) {
                await sendAutomaticConflictAlert(email, conflictFlag);
            }
        } catch (error) {
            console.error('Failed to send conflict notifications:', error);
        }
    }

    /**
     * Utility functions
     */
    averageIfBothExist(val1, val2) {
        if (val1 && val2) return (val1 + val2) / 2;
        return val1 || val2;
    }

    calculateDataCompleteness(mergedData) {
        const requiredFields = [
            'propertyDetails.propertyType',
            'propertyDetails.address',
            'measurements.totalArea',
            'valuation.estimatedValue'
        ];

        let completedFields = 0;
        requiredFields.forEach(field => {
            const value = this.getNestedValue(mergedData, field);
            if (value !== null && value !== undefined && value !== '') {
                completedFields++;
            }
        });

        return (completedFields / requiredFields.length) * 100;
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Map conflict field names to model enum values
     */
    mapConflictType(conflictField) {
        const mapping = {
            'recommendation': 'recommendation_mismatch',
            'estimatedValue': 'value_discrepancy',
            'propertyType': 'structural_disagreement',
            'propertyCondition': 'structural_disagreement',
            'structuralAssessment': 'structural_disagreement',
            'riskFactors': 'risk_assessment_difference',
            'totalArea': 'structural_disagreement',
            'coordinates': 'other'
        };
        return mapping[conflictField] || 'other';
    }

    /**
     * Process all pending dual assignments
     */
    async processAllPending() {
        try {
            const pendingAssignments = await DualAssignment.find({
                completionStatus: 100,
                processingStatus: { $ne: 'completed' },
                mergedReportId: { $exists: false }
            });

            console.log(`📋 Found ${pendingAssignments.length} pending assignments to process`);

            for (const assignment of pendingAssignments) {
                try {
                    await this.processDualAssignment(assignment._id);
                } catch (error) {
                    console.error(`Failed to process assignment ${assignment._id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error processing pending assignments:', error);
        }
    }

    /**
     * Static method to trigger merging process
     * Called from surveyor controller when both reports are submitted
     */
    static async triggerMerging(policyId, options = {}) {
        try {
            console.log(`🚀 Triggering automatic report merging for policy: ${policyId}`);

            const { dualAssignmentId, ammcReportId, niaReportId } = options;

            if (!dualAssignmentId) {
                throw new Error('Dual assignment ID is required for merging');
            }

            // Create an instance of the merger
            const merger = new AutoReportMerger();

            // Process the dual assignment
            const result = await merger.processDualAssignment(dualAssignmentId);

            console.log(`✅ Automatic merging completed for policy: ${policyId}`);

            return result;
        } catch (error) {
            console.error(`❌ Failed to trigger automatic merging for policy: ${policyId}`, error);
            throw error;
        }
    }
}

module.exports = AutoReportMerger;
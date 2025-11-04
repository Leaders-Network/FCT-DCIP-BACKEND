const MergedReport = require('../models/MergedReport');
const DualAssignment = require('../models/DualAssignment');
const SurveySubmission = require('../models/SurveySubmission');
const AutomaticConflictFlag = require('../models/AutomaticConflictFlag');
const { sendAutomaticConflictAlert } = require('../utils/emailService');
const { Employee } = require('../models/Employee');
const ReportReleaseService = require('./ReportReleaseService');

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
            policyId,
            status: 'completed'
        }).sort({ submittedAt: -1 });
    }

    /**
     * Core merging logic
     */
    async mergeReports(dualAssignment, ammcSubmission, niaSubmission) {
        const conflicts = [];
        const mergedData = {};

        // 1. Merge property details
        const propertyMerge = this.mergePropertyDetails(
            ammcSubmission.surveyData.propertyDetails,
            niaSubmission.surveyData.propertyDetails
        );
        mergedData.propertyDetails = propertyMerge.merged;
        conflicts.push(...propertyMerge.conflicts);

        // 2. Merge measurements
        const measurementMerge = this.mergeMeasurements(
            ammcSubmission.surveyData.measurements,
            niaSubmission.surveyData.measurements
        );
        mergedData.measurements = measurementMerge.merged;
        conflicts.push(...measurementMerge.conflicts);

        // 3. Merge valuations
        const valuationMerge = this.mergeValuations(
            ammcSubmission.surveyData.valuation,
            niaSubmission.surveyData.valuation
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

        // Property type - must match
        if (ammcData.propertyType !== niaData.propertyType) {
            conflicts.push({
                field: 'propertyType',
                type: 'mismatch',
                severity: 'high',
                ammcValue: ammcData.propertyType,
                niaValue: niaData.propertyType,
                description: 'Property type mismatch between surveyors'
            });
            merged.propertyType = ammcData.propertyType; // Default to AMMC
        } else {
            merged.propertyType = ammcData.propertyType;
        }

        // Address - use most complete
        merged.address = ammcData.address?.length > niaData.address?.length ?
            ammcData.address : niaData.address;

        // Coordinates - average if close, flag if far apart
        if (ammcData.coordinates && niaData.coordinates) {
            const latDiff = Math.abs(ammcData.coordinates.latitude - niaData.coordinates.latitude);
            const lngDiff = Math.abs(ammcData.coordinates.longitude - niaData.coordinates.longitude);

            if (latDiff > this.conflictThresholds.coordinates || lngDiff > this.conflictThresholds.coordinates) {
                conflicts.push({
                    field: 'coordinates',
                    type: 'significant_difference',
                    severity: 'medium',
                    ammcValue: ammcData.coordinates,
                    niaValue: niaData.coordinates,
                    description: 'Significant difference in GPS coordinates'
                });
            }

            merged.coordinates = {
                latitude: (ammcData.coordinates.latitude + niaData.coordinates.latitude) / 2,
                longitude: (ammcData.coordinates.longitude + niaData.coordinates.longitude) / 2
            };
        } else {
            merged.coordinates = ammcData.coordinates || niaData.coordinates;
        }

        return { merged, conflicts };
    }

    /**
     * Merge measurements from both surveys
     */
    mergeMeasurements(ammcData, niaData) {
        const merged = {};
        const conflicts = [];

        // Area measurements
        if (ammcData.totalArea && niaData.totalArea) {
            const areaDiff = Math.abs(ammcData.totalArea - niaData.totalArea) /
                Math.max(ammcData.totalArea, niaData.totalArea);

            if (areaDiff > this.conflictThresholds.area) {
                conflicts.push({
                    field: 'totalArea',
                    type: 'significant_difference',
                    severity: areaDiff > 0.25 ? 'high' : 'medium',
                    ammcValue: ammcData.totalArea,
                    niaValue: niaData.totalArea,
                    difference: `${(areaDiff * 100).toFixed(1)}%`,
                    description: 'Significant difference in area measurements'
                });
            }

            merged.totalArea = (ammcData.totalArea + niaData.totalArea) / 2;
        } else {
            merged.totalArea = ammcData.totalArea || niaData.totalArea;
        }

        // Dimensions - average if both exist
        merged.dimensions = {
            length: this.averageIfBothExist(ammcData.dimensions?.length, niaData.dimensions?.length),
            width: this.averageIfBothExist(ammcData.dimensions?.width, niaData.dimensions?.width),
            height: this.averageIfBothExist(ammcData.dimensions?.height, niaData.dimensions?.height)
        };

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
            releaseStatus = 'approved';
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
        const mergedReport = new MergedReport({
            policyId: dualAssignment.policyId._id,
            dualAssignmentId: dualAssignment._id,
            ammcSubmissionId: ammcSubmission._id,
            niaSubmissionId: niaSubmission._id,

            // Merged data
            mergedSurveyData: mergeResult.mergedData,
            finalRecommendation: mergeResult.finalRecommendation,

            // Quality metrics
            confidenceScore: mergeResult.confidenceScore,
            releaseStatus: mergeResult.releaseStatus,
            conflictDetected: mergeResult.conflicts.length > 0,

            // Processing metadata
            mergingMetadata: {
                processingTime,
                algorithmVersion: '1.0.0',
                conflictThresholds: this.conflictThresholds,
                processingDate: new Date(),
                qualityMetrics: mergeResult.qualityMetrics
            },

            // Payment status
            paymentEnabled: mergeResult.releaseStatus === 'approved' &&
                mergeResult.finalRecommendation === 'approve'
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
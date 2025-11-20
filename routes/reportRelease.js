const express = require('express');
const router = express.Router();
const { protect, restrictTo, allowUserOrAdmin } = require('../middlewares/authentication');
const MergedReport = require('../models/MergedReport');
const PolicyRequest = require('../models/PolicyRequest');
const { StatusCodes } = require('http-status-codes');

// Apply authentication to all routes
router.use(protect);

// Get policy details for user (user-accessible)
router.get('/policy/:policyId', allowUserOrAdmin, async (req, res) => {
    try {
        const { policyId } = req.params;
        const { userId } = req.user;

        console.log('🔍 Fetching policy:', { policyId, userId, userModel: req.user.model });

        // Check if user owns this policy (unless admin)
        const policy = await PolicyRequest.findById(policyId);
        if (!policy) {
            console.error('❌ Policy not found:', policyId);
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Policy not found'
            });
        }

        console.log('✅ Policy found:', { policyUserId: policy.userId, requestUserId: userId });

        // Check ownership for non-admin users
        // Convert both to strings for comparison to handle ObjectId vs string
        if (req.user.model === 'User' && policy.userId.toString() !== userId.toString()) {
            console.error('❌ Access denied - user does not own this policy');
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied'
            });
        }

        console.log('✅ Access granted, returning policy data');
        res.status(StatusCodes.OK).json({
            success: true,
            data: policy
        });
    } catch (error) {
        console.error('Get policy error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get policy details',
            error: error.message
        });
    }
});

// Get user's report summary/statistics
router.get('/user/reports/summary', allowUserOrAdmin, async (req, res) => {
    try {
        const { userId } = req.user;

        // Find policies belonging to the user
        const policies = await PolicyRequest.find({ userId }).select('_id');
        const policyIds = policies.map(p => p._id);

        // Count reports by status
        const [totalReports, releasedReports, pendingReports, withheldReports, completedReports] = await Promise.all([
            MergedReport.countDocuments({ policyId: { $in: policyIds } }),
            MergedReport.countDocuments({ policyId: { $in: policyIds }, releaseStatus: 'released' }),
            MergedReport.countDocuments({ policyId: { $in: policyIds }, releaseStatus: 'pending' }),
            MergedReport.countDocuments({ policyId: { $in: policyIds }, releaseStatus: 'withheld' }),
            // Completed reports are those that have merged reports (regardless of release status)
            MergedReport.countDocuments({ policyId: { $in: policyIds } })
        ]);

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                totalReports,
                releasedReports,
                pendingReports,
                withheldReports,
                completedReports // All merged reports are considered completed
            }
        });
    } catch (error) {
        console.error('Get report summary error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get report summary',
            error: error.message
        });
    }
});

// Get user's reports
router.get('/user/reports', allowUserOrAdmin, async (req, res) => {
    try {
        const { userId } = req.user;
        const { page = 1, limit = 10 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Find policies belonging to the user that have merged reports
        const policies = await PolicyRequest.find({ userId })
            .select('_id propertyDetails contactDetails status createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const policyIds = policies.map(p => p._id);

        // Find merged reports for these policies (show all statuses)
        const mergedReports = await MergedReport.find({
            policyId: { $in: policyIds }
        }).populate('policyId', 'propertyDetails contactDetails status');

        // Format response
        const reports = mergedReports.map(report => ({
            reportId: report._id,
            policyId: report.policyId._id,
            propertyAddress: report.policyId.propertyDetails.address,
            propertyType: report.policyId.propertyDetails.propertyType,
            status: report.releaseStatus,
            createdAt: report.createdAt,
            downloadCount: report.downloadCount || 0,
            canDownload: report.releaseStatus === 'released',
            isMerged: true,
            finalRecommendation: report.finalRecommendation,
            conflictDetected: report.conflictDetected || false,
            conflictResolved: report.conflictResolved || false
        }));

        const total = await MergedReport.countDocuments({
            policyId: { $in: policyIds }
        });

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                reports,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get user reports error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get user reports',
            error: error.message
        });
    }
});

// Get report processing status
router.get('/status/:policyId', allowUserOrAdmin, async (req, res) => {
    try {
        const { policyId } = req.params;
        const { userId } = req.user;

        // Check if user owns this policy (unless admin)
        const policy = await PolicyRequest.findById(policyId);
        if (!policy) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Policy not found'
            });
        }

        // Check ownership for non-admin users
        if (req.user.model === 'User' && policy.userId !== userId) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Check for merged report
        const mergedReport = await MergedReport.findOne({ policyId })
            .populate('policyId', 'propertyDetails status');

        if (!mergedReport) {
            // Check if dual assignment exists to determine processing stage
            const DualAssignment = require('../models/DualAssignment');
            const dualAssignment = await DualAssignment.findOne({ policyId })
                .populate('ammcAssignmentId', 'status')
                .populate('niaAssignmentId', 'status');

            if (!dualAssignment) {
                return res.status(StatusCodes.OK).json({
                    success: true,
                    data: {
                        status: 'not_started',
                        message: 'Surveys have not been assigned yet',
                        stage: 'awaiting_assignment',
                        progress: 0
                    }
                });
            }

            // Calculate survey progress
            let progress = 0;
            let message = 'Waiting for surveyors to complete their assessments';

            const ammcCompleted = dualAssignment.ammcAssignmentId?.status === 'completed';
            const niaCompleted = dualAssignment.niaAssignmentId?.status === 'completed';

            if (ammcCompleted && niaCompleted) {
                progress = 100;
                message = 'Both surveys completed. Processing merged report...';
            } else if (ammcCompleted || niaCompleted) {
                progress = 50;
                message = 'One survey completed. Waiting for the other surveyor...';
            }

            return res.status(StatusCodes.OK).json({
                success: true,
                data: {
                    status: 'awaiting_surveys',
                    message,
                    stage: 'survey_in_progress',
                    progress,
                    dualAssignmentId: dualAssignment._id,
                    surveyStatus: {
                        ammc: dualAssignment.ammcAssignmentId?.status || 'not_assigned',
                        nia: dualAssignment.niaAssignmentId?.status || 'not_assigned'
                    }
                }
            });
        }

        // Determine status based on merged report
        let status = 'processing';
        let message = 'Report is being processed';
        let stage = 'processing';

        switch (mergedReport.releaseStatus) {
            case 'released':
                status = 'completed';
                message = 'Report is ready for download';
                stage = 'completed';
                break;
            case 'pending':
                status = 'under_review';
                message = 'Report is under administrative review';
                stage = 'under_review';
                break;
            case 'withheld':
                status = 'processing_delayed';
                message = 'Report processing has been delayed due to conflicts';
                stage = 'conflict_resolution';
                break;
            default:
                status = 'processing';
                message = 'Report is being processed';
                stage = 'processing';
        }

        res.status(StatusCodes.OK).json({
            success: true,
            data: {
                status,
                message,
                stage,
                reportId: mergedReport._id,
                createdAt: mergedReport.createdAt,
                releasedAt: mergedReport.releasedAt,
                conflictDetected: mergedReport.conflictDetected,
                conflictResolved: mergedReport.conflictResolved,
                processingProgress: 100, // Merged report is fully processed
                estimatedCompletion: mergedReport.releaseStatus === 'released' ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours if not released
                conflictDetails: mergedReport.conflictDetected ? {
                    type: mergedReport.conflictDetails?.conflictType || 'unknown',
                    severity: mergedReport.conflictDetails?.conflictSeverity || 'medium'
                } : undefined
            }
        });
    } catch (error) {
        console.error('Get report status error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get report status',
            error: error.message
        });
    }
});

// Get specific report details
router.get('/report/:reportId', allowUserOrAdmin, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { userId } = req.user;

        let reportData = null;
        let isMerged = false;

        // Try to find a merged report first
        let mergedReport = await MergedReport.findById(reportId)
            .populate('policyId', 'propertyDetails contactDetails userId');

        if (mergedReport) {
            // Check ownership for non-admin users
            if (req.user.model === 'User' && mergedReport.policyId.userId !== userId) {
                return res.status(StatusCodes.FORBIDDEN).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            // Log access
            mergedReport.logAccess(
                req.user.userId,
                'view',
                req.ip,
                req.get('User-Agent')
            );
            await mergedReport.save();

            // Get dual assignment data for surveyor contacts and individual reports
            const DualAssignment = require('../models/DualAssignment');
            const SurveySubmission = require('../models/SurveySubmission');

            const dualAssignment = await DualAssignment.findOne({ policyId: mergedReport.policyId._id })
                .populate('ammcAssignmentId', 'surveyorId status submittedAt')
                .populate('niaAssignmentId', 'surveyorId status submittedAt');

            // Get surveyor information
            const { Employee } = require('../models/Employee');
            let ammcSurveyor = null;
            let niaSurveyor = null;

            try {
                if (dualAssignment?.ammcAssignmentId?.surveyorId) {
                    ammcSurveyor = await Employee.findById(dualAssignment.ammcAssignmentId.surveyorId);
                }
                if (dualAssignment?.niaAssignmentId?.surveyorId) {
                    niaSurveyor = await Employee.findById(dualAssignment.niaAssignmentId.surveyorId);
                }
            } catch (employeeError) {
                console.error('Error fetching surveyor information:', employeeError);
                // Continue without surveyor info if there's an error
            }

            // Get individual survey submissions for detailed report data
            let ammcSubmission = null;
            let niaSubmission = null;

            try {
                if (dualAssignment?.ammcAssignmentId?.surveyorId) {
                    ammcSubmission = await SurveySubmission.findOne({
                        surveyorId: dualAssignment.ammcAssignmentId.surveyorId,
                        ammcId: mergedReport.policyId._id // Use ammcId instead of policyId
                    });
                }
                if (dualAssignment?.niaAssignmentId?.surveyorId) {
                    niaSubmission = await SurveySubmission.findOne({
                        surveyorId: dualAssignment.niaAssignmentId.surveyorId,
                        ammcId: mergedReport.policyId._id // Use ammcId instead of policyId
                    });
                }
            } catch (submissionError) {
                console.error('Error fetching survey submissions:', submissionError);
                // Continue without submission data if there's an error
            }

            reportData = {
                reportId: mergedReport._id,
                policyId: mergedReport.policyId._id,
                propertyDetails: mergedReport.policyId.propertyDetails,
                status: mergedReport.releaseStatus,
                finalRecommendation: mergedReport.finalRecommendation,
                paymentEnabled: mergedReport.paymentEnabled,
                conflictDetected: mergedReport.conflictDetected,
                conflictResolved: mergedReport.conflictResolved,
                conflictDetails: mergedReport.conflictDetails,
                reportSections: mergedReport.reportSections,
                mergingMetadata: mergedReport.mergingMetadata,
                createdAt: mergedReport.createdAt,
                releasedAt: mergedReport.releasedAt,
                downloadCount: mergedReport.downloadCount || 0,
                canDownload: mergedReport.releaseStatus === 'released',
                // Add surveyor information
                surveyorContacts: {
                    ammc: ammcSurveyor ? {
                        name: `${ammcSurveyor.firstname || ''} ${ammcSurveyor.lastname || ''}`.trim() || 'AMMC Surveyor',
                        email: ammcSurveyor.email || 'N/A',
                        phone: ammcSurveyor.phonenumber || 'N/A',
                        licenseNumber: ammcSurveyor.licenseNumber || 'N/A',
                        organization: 'AMMC'
                    } : {
                        name: 'AMMC Surveyor',
                        email: 'N/A',
                        phone: 'N/A',
                        licenseNumber: 'N/A',
                        organization: 'AMMC'
                    },
                    nia: niaSurveyor ? {
                        name: `${niaSurveyor.firstname || ''} ${niaSurveyor.lastname || ''}`.trim() || 'NIA Surveyor',
                        email: niaSurveyor.email || 'N/A',
                        phone: niaSurveyor.phonenumber || 'N/A',
                        licenseNumber: niaSurveyor.licenseNumber || 'N/A',
                        organization: 'NIA'
                    } : {
                        name: 'NIA Surveyor',
                        email: 'N/A',
                        phone: 'N/A',
                        licenseNumber: 'N/A',
                        organization: 'NIA'
                    }
                },
                // Add individual report documents
                individualReports: {
                    ammcReportId: dualAssignment?.ammcAssignmentId?._id || null,
                    niaReportId: dualAssignment?.niaAssignmentId?._id || null,
                    ammcSubmission: ammcSubmission ? {
                        submissionId: ammcSubmission._id,
                        surveyData: ammcSubmission.surveyDetails, // Use surveyDetails instead of surveyData
                        submittedAt: ammcSubmission.submissionTime, // Use submissionTime instead of submittedAt
                        surveyorNotes: ammcSubmission.surveyNotes // Use surveyNotes instead of surveyorNotes
                    } : null,
                    niaSubmission: niaSubmission ? {
                        submissionId: niaSubmission._id,
                        surveyData: niaSubmission.surveyDetails, // Use surveyDetails instead of surveyData
                        submittedAt: niaSubmission.submissionTime, // Use submissionTime instead of submittedAt
                        surveyorNotes: niaSubmission.surveyNotes // Use surveyNotes instead of surveyorNotes
                    } : null
                }
            };
            isMerged = true;

        } else {
            // If no merged report, try to find a completed policy request
            const policyRequest = await PolicyRequest.findOne({
                _id: reportId,
                userId: req.user.model === 'User' ? userId : undefined,
                status: 'completed'
            });

            if (!policyRequest) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    success: false,
                    message: 'Report not found'
                });
            }

            reportData = {
                reportId: policyRequest._id,
                policyId: policyRequest._id,
                propertyDetails: policyRequest.propertyDetails,
                status: policyRequest.status,
                createdAt: policyRequest.createdAt,
                isMerged: false
            };
        }

        res.status(StatusCodes.OK).json({
            success: true,
            data: { ...reportData, isMerged }
        });
    } catch (error) {
        console.error('Get report error:', error);
        console.error('Error stack:', error.stack);
        console.error('Report ID:', req.params.reportId);
        console.error('User ID:', req.user?.userId);

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get report',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Download individual AMMC report
router.post('/download/ammc/:assignmentId', allowUserOrAdmin, async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { userId } = req.user;

        // Find the AMMC survey submission
        const SurveySubmission = require('../models/SurveySubmission');
        const submission = await SurveySubmission.findOne({
            assignmentId: assignmentId,
            organization: 'AMMC'
        }).populate('ammcId', 'userId propertyDetails');

        if (!submission) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'AMMC report not found'
            });
        }

        // Check ownership for non-admin users
        if (req.user.model === 'User' && submission.ammcId.userId !== userId) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Return the survey document or documents
        let downloadUrl = null;
        let documents = [];

        if (submission.documents && submission.documents.length > 0) {
            // Find the main report document
            const mainReport = submission.documents.find(doc => doc.isMainReport) || submission.documents[0];
            downloadUrl = mainReport.cloudinaryUrl;
            documents = submission.documents;
        } else if (submission.surveyDocument) {
            // Legacy survey document
            downloadUrl = typeof submission.surveyDocument === 'string' ?
                submission.surveyDocument : submission.surveyDocument.url;
        }

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'AMMC report downloaded successfully',
            data: {
                submissionId: submission._id,
                organization: 'AMMC',
                downloadUrl: downloadUrl,
                documents: documents,
                surveyData: submission.surveyDetails,
                submittedAt: submission.submissionTime,
                surveyorNotes: submission.surveyNotes
            }
        });
    } catch (error) {
        console.error('Download AMMC report error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to download AMMC report',
            error: error.message
        });
    }
});

// Download individual NIA report
router.post('/download/nia/:assignmentId', allowUserOrAdmin, async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { userId } = req.user;

        // Find the NIA survey submission
        const SurveySubmission = require('../models/SurveySubmission');
        const submission = await SurveySubmission.findOne({
            assignmentId: assignmentId,
            organization: 'NIA'
        }).populate('ammcId', 'userId propertyDetails');

        if (!submission) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'NIA report not found'
            });
        }

        // Check ownership for non-admin users
        if (req.user.model === 'User' && submission.ammcId.userId !== userId) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Return the survey document or documents
        let downloadUrl = null;
        let documents = [];

        if (submission.documents && submission.documents.length > 0) {
            // Find the main report document
            const mainReport = submission.documents.find(doc => doc.isMainReport) || submission.documents[0];
            downloadUrl = mainReport.cloudinaryUrl;
            documents = submission.documents;
        } else if (submission.surveyDocument) {
            // Legacy survey document
            downloadUrl = typeof submission.surveyDocument === 'string' ?
                submission.surveyDocument : submission.surveyDocument.url;
        }

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'NIA report downloaded successfully',
            data: {
                submissionId: submission._id,
                organization: 'NIA',
                downloadUrl: downloadUrl,
                documents: documents,
                surveyData: submission.surveyDetails,
                submittedAt: submission.submissionTime,
                surveyorNotes: submission.surveyNotes
            }
        });
    } catch (error) {
        console.error('Download NIA report error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to download NIA report',
            error: error.message
        });
    }
});

// Download merged report
router.post('/download/:reportId', allowUserOrAdmin, async (req, res) => {
    try {
        const { reportId } = req.params;
        const { userId } = req.user;

        const mergedReport = await MergedReport.findById(reportId)
            .populate('policyId', 'propertyDetails contactDetails userId');

        if (!mergedReport) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Check ownership for non-admin users
        if (req.user.model === 'User' && mergedReport.policyId.userId !== userId) {
            return res.status(StatusCodes.FORBIDDEN).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (mergedReport.releaseStatus !== 'released') {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Report is not yet available for download'
            });
        }

        // Log access and increment download count
        mergedReport.logAccess(
            req.user.userId,
            'download',
            req.ip,
            req.get('User-Agent')
        );
        mergedReport.downloadCount = (mergedReport.downloadCount || 0) + 1;
        mergedReport.lastDownloadedAt = new Date();
        await mergedReport.save();

        // Generate and return a downloadable report
        const reportContent = {
            reportId: mergedReport._id,
            policyId: mergedReport.policyId._id,
            propertyDetails: mergedReport.policyId.propertyDetails,
            finalRecommendation: mergedReport.finalRecommendation,
            paymentEnabled: mergedReport.paymentEnabled,
            conflictDetected: mergedReport.conflictDetected,
            reportSections: mergedReport.reportSections,
            mergingMetadata: mergedReport.mergingMetadata,
            releasedAt: mergedReport.releasedAt,
            downloadedAt: new Date(),
            downloadCount: mergedReport.downloadCount
        };

        // Set headers for file download
        const fileName = `merged-report-${mergedReport.policyId._id}-${Date.now()}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Report downloaded successfully',
            data: reportContent
        });
    } catch (error) {
        console.error('Download report error:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to download report',
            error: error.message
        });
    }
});

module.exports = router;
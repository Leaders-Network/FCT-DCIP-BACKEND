const { StatusCodes } = require('http-status-codes');
const SurveySubmission = require('../models/SurveySubmission');
const Assignment = require('../models/Assignment');
const PolicyRequest = require('../models/PolicyRequest');
const { BadRequestError, NotFoundError } = require('../errors');
const { uploadToCloudinary } = require('../utils/cloudinary');

// Create survey submission
const createSurveySubmission = async (req, res) => {
  try {
    const { userId } = req.user;
    const submissionData = { ...req.body, surveyorId: userId };

    // Get surveyor's organization from Employee model
    const { Employee } = require('../models/Employee');
    const surveyor = await Employee.findById(userId);
    if (surveyor && surveyor.organization) {
      submissionData.organization = surveyor.organization;
    }

    // Validate assignment exists and belongs to surveyor
    if (submissionData.assignmentId) {
      const assignment = await Assignment.findOne({
        _id: submissionData.assignmentId,
        surveyorId: userId
      });

      if (!assignment) {
        throw new NotFoundError('Assignment not found or access denied');
      }

      submissionData.ammcId = assignment.ammcId;
    }

    // Check if submission already exists for this assignment
    const existingSubmission = await SurveySubmission.findOne({
      assignmentId: submissionData.assignmentId,
      surveyorId: userId
    });

    if (existingSubmission) {
      throw new BadRequestError('Submission already exists for this assignment');
    }

    // Handle file upload if present
    if (req.file) {
      const { originalname, buffer, mimetype, size } = req.file;
      const folder = submissionData.assignmentId
        ? `survey-documents/${submissionData.assignmentId}`
        : `survey-documents/${submissionData.ammcId || 'general'}`;

      try {
        const uploadResult = await uploadToCloudinary(buffer, originalname, folder);

        // Add document to submission's documents array
        if (!submissionData.documents) {
          submissionData.documents = [];
        }

        const documentData = {
          fileName: originalname,
          fileType: mimetype,
          fileSize: size,
          cloudinaryUrl: uploadResult.url,
          cloudinaryPublicId: uploadResult.publicId,
          category: 'survey_report',
          documentType: 'main_report',
          uploadedBy: userId,
          uploadedAt: new Date(),
          isMainReport: true
        };

        submissionData.documents.push(documentData);

        // Also set legacy surveyDocument field for backward compatibility
        submissionData.surveyDocument = {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          name: originalname
        };
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        throw new BadRequestError(`Failed to upload file: ${uploadError.message}`);
      }
    }

    const submission = new SurveySubmission(submissionData);
    await submission.save();

    const populatedSubmission = await SurveySubmission.findById(submission._id)
      .populate('ammcId', 'policyNumber contactDetails')
      .populate('assignmentId', 'deadline priority');

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Survey submission created successfully',
      data: populatedSubmission
    });
  } catch (error) {
    console.error('Create survey submission error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create survey submission',
      error: error.message
    });
  }
};

// Get surveyor's submissions
const getSurveyorSubmissions = async (req, res) => {
  try {
    const { userId } = req.user;
    const {
      status,
      page = 1,
      limit = 10,
      sortBy = 'submissionTime',
      sortOrder = 'desc',
      assignmentId
    } = req.query;

    const query = { surveyorId: userId };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (assignmentId) {
      query.assignmentId = assignmentId;
    }

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const submissions = await SurveySubmission.find(query)
      .populate('ammcId', 'policyNumber contactDetails propertyDetails status')
      .populate('assignmentId', 'deadline priority status')
      .populate('reviewedBy', 'firstname lastname')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SurveySubmission.countDocuments(query);

    // Get summary statistics
    const statusStats = await SurveySubmission.aggregate([
      { $match: { surveyorId: userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        submissions,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: submissions.length,
          totalRecords: total
        },
        statistics: {
          statusBreakdown: statusStats
        }
      }
    });
  } catch (error) {
    console.error('Get surveyor submissions error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get submissions',
      error: error.message
    });
  }
};

// Get submission by ID
const getSubmissionById = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { userId } = req.user;

    const submission = await SurveySubmission.findOne({
      _id: submissionId,
      surveyorId: userId
    })
      .populate('ammcId')
      .populate('assignmentId')
      .populate('reviewedBy', 'firstname lastname email');

    if (!submission) {
      throw new NotFoundError('Submission not found or access denied');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: submission
    });
  } catch (error) {
    console.error('Get submission by ID error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get submission',
      error: error.message
    });
  }
};

// Update survey submission
const updateSurveySubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { userId } = req.user;
    const updates = req.body;

    const submission = await SurveySubmission.findOne({
      _id: submissionId,
      surveyorId: userId,
      status: { $in: ['draft', 'revision_required'] }
    });

    if (!submission) {
      throw new NotFoundError('Submission not found, access denied, or cannot be updated');
    }

    // Handle file upload if present
    if (req.file) {
      const { originalname, buffer, mimetype, size } = req.file;
      const folder = submission.assignmentId
        ? `survey-documents/${submission.assignmentId}`
        : `survey-documents/${submission.ammcId || 'general'}`;

      try {
        const uploadResult = await uploadToCloudinary(buffer, originalname, folder);

        // Initialize documents array if it doesn't exist
        if (!submission.documents) {
          submission.documents = [];
        }

        // Check if this should be the main report (default to true if no main report exists)
        const hasMainReport = submission.documents.some(doc => doc.isMainReport);
        const isMainReport = !hasMainReport || updates.isMainReport !== false;

        // If setting as main report, unset others
        if (isMainReport) {
          submission.documents.forEach(doc => {
            if (doc.isMainReport) {
              doc.isMainReport = false;
            }
          });
        }

        const documentData = {
          fileName: originalname,
          fileType: mimetype,
          fileSize: size,
          cloudinaryUrl: uploadResult.url,
          cloudinaryPublicId: uploadResult.publicId,
          category: updates.documentCategory || 'survey_report',
          documentType: isMainReport ? 'main_report' : 'other',
          uploadedBy: userId,
          uploadedAt: new Date(),
          isMainReport: isMainReport
        };

        submission.documents.push(documentData);

        // Also set legacy surveyDocument field if this is the main report
        if (isMainReport) {
          submission.surveyDocument = {
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            name: originalname
          };
        }
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        throw new BadRequestError(`Failed to upload file: ${uploadError.message}`);
      }
    }

    // Track revision if this is an update after review
    if (submission.status === 'revision_required' && updates.status === 'submitted') {
      const revisionNumber = (submission.revisionHistory?.length || 0) + 1;
      submission.revisionHistory.push({
        version: revisionNumber,
        changes: updates.revisionNotes || 'Updated submission based on review feedback',
        revisedBy: userId,
        revisedAt: new Date()
      });
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== 'revisionHistory' && key !== 'revisionNotes' && key !== 'isMainReport' && key !== 'documentCategory') {
        if (key === 'surveyDetails' || key === 'qualityCheck') {
          submission[key] = { ...submission[key], ...updates[key] };
        } else {
          submission[key] = updates[key];
        }
      }
    });

    // Update submission time if status changed to submitted
    if (updates.status === 'submitted') {
      submission.submissionTime = new Date();
    }

    await submission.save();

    const updatedSubmission = await SurveySubmission.findById(submissionId)
      .populate('ammcId', 'policyNumber contactDetails')
      .populate('assignmentId', 'deadline priority');

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Submission updated successfully',
      data: updatedSubmission
    });
  } catch (error) {
    console.error('Update survey submission error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update submission',
      error: error.message
    });
  }
};

// Submit survey (change status from draft to submitted)
const submitSurvey = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { userId } = req.user;
    const { finalNotes = '' } = req.body;

    const submission = await SurveySubmission.findOne({
      _id: submissionId,
      surveyorId: userId,
      status: { $in: ['draft', 'revision_required'] }
    });

    if (!submission) {
      throw new NotFoundError('Submission not found, access denied, or cannot be submitted');
    }

    // Check if documents are passed in request body (from separate upload)
    if (req.body.documentUrl || req.body.documentUrls) {
      const documentUrls = req.body.documentUrls || [req.body.documentUrl].filter(Boolean);

      if (!submission.documents) {
        submission.documents = [];
      }

      // Add documents from URLs passed in request
      for (const docUrl of documentUrls) {
        const docData = typeof docUrl === 'string'
          ? {
            fileName: req.body.documentName || 'survey-document.pdf',
            cloudinaryUrl: docUrl,
            cloudinaryPublicId: req.body.documentPublicId || null,
            category: 'survey_report',
            documentType: 'main_report',
            uploadedBy: userId,
            uploadedAt: new Date(),
            isMainReport: !submission.documents.some(doc => doc.isMainReport)
          }
          : {
            fileName: docUrl.fileName || docUrl.name || 'survey-document.pdf',
            fileType: docUrl.fileType || 'application/pdf',
            fileSize: docUrl.fileSize || 0,
            cloudinaryUrl: docUrl.url || docUrl.cloudinaryUrl,
            cloudinaryPublicId: docUrl.publicId || docUrl.cloudinaryPublicId,
            category: docUrl.category || 'survey_report',
            documentType: docUrl.documentType || 'main_report',
            uploadedBy: userId,
            uploadedAt: new Date(),
            isMainReport: !submission.documents.some(doc => doc.isMainReport)
          };

        submission.documents.push(docData);
      }

      // Set legacy surveyDocument field if main report exists
      const mainReport = submission.documents.find(doc => doc.isMainReport) || submission.documents[0];
      if (mainReport) {
        submission.surveyDocument = {
          url: mainReport.cloudinaryUrl,
          publicId: mainReport.cloudinaryPublicId,
          name: mainReport.fileName
        };
      }
    }

    // Also check Assignment for documents if submission doesn't have any
    if ((!submission.documents || submission.documents.length === 0) && submission.assignmentId) {
      const assignment = await Assignment.findById(submission.assignmentId);
      if (assignment && assignment.documents && assignment.documents.length > 0) {
        // Copy documents from assignment to submission
        if (!submission.documents) {
          submission.documents = [];
        }

        // Copy all documents from assignment
        assignment.documents.forEach(assignmentDoc => {
          const docData = {
            fileName: assignmentDoc.fileName,
            fileType: assignmentDoc.fileType,
            fileSize: assignmentDoc.fileSize,
            cloudinaryUrl: assignmentDoc.cloudinaryUrl,
            cloudinaryPublicId: assignmentDoc.cloudinaryPublicId,
            category: assignmentDoc.category || 'survey_report',
            documentType: assignmentDoc.documentType || 'main_report',
            uploadedBy: assignmentDoc.uploadedBy || userId,
            uploadedAt: assignmentDoc.uploadedAt || new Date(),
            isMainReport: assignmentDoc.isMainReport || (submission.documents.length === 0)
          };
          submission.documents.push(docData);
        });

        // Set legacy surveyDocument field
        const mainReport = submission.documents.find(doc => doc.isMainReport) || submission.documents[0];
        if (mainReport) {
          submission.surveyDocument = {
            url: mainReport.cloudinaryUrl,
            publicId: mainReport.cloudinaryPublicId,
            name: mainReport.fileName
          };
        }
      }
    }

    // Handle file upload if present (allows adding document during submission)
    if (req.file) {
      const { originalname, buffer, mimetype, size } = req.file;
      const folder = submission.assignmentId
        ? `survey-documents/${submission.assignmentId}`
        : `survey-documents/${submission.ammcId || 'general'}`;

      try {
        const uploadResult = await uploadToCloudinary(buffer, originalname, folder);

        // Initialize documents array if it doesn't exist
        if (!submission.documents) {
          submission.documents = [];
        }

        // Mark existing main reports as not main if we're adding a new one
        submission.documents.forEach(doc => {
          if (doc.isMainReport) {
            doc.isMainReport = false;
          }
        });

        const documentData = {
          fileName: originalname,
          fileType: mimetype,
          fileSize: size,
          cloudinaryUrl: uploadResult.url,
          cloudinaryPublicId: uploadResult.publicId,
          category: 'survey_report',
          documentType: 'main_report',
          uploadedBy: userId,
          uploadedAt: new Date(),
          isMainReport: true
        };

        submission.documents.push(documentData);

        // Also set legacy surveyDocument field for backward compatibility
        submission.surveyDocument = {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          name: originalname
        };
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        throw new BadRequestError(`Failed to upload file: ${uploadError.message}`);
      }
    }

    // Validate submission completeness
    const completionPercentage = submission.getCompletionPercentage();
    if (completionPercentage < 100) {
      throw new BadRequestError(`Submission is not complete. Current completion: ${completionPercentage}%`);
    }

    // Check if main survey document is present
    const hasMainReport = submission.getMainReport();
    if (!hasMainReport) {
      throw new BadRequestError('Main survey document is required');
    }

    // Ensure organization is set based on surveyor's organization
    if (!submission.organization) {
      const { Employee } = require('../models/Employee');
      const surveyor = await Employee.findById(userId);
      if (surveyor && surveyor.organization) {
        submission.organization = surveyor.organization;
      }
    }

    submission.status = 'submitted';
    submission.submissionTime = new Date();

    if (finalNotes) {
      submission.surveyNotes = submission.surveyNotes + '\n\nFinal Notes: ' + finalNotes;
    }

    await submission.save();

    const submittedSubmission = await SurveySubmission.findById(submissionId)
      .populate('ammcId', 'policyNumber contactDetails')
      .populate('assignmentId', 'deadline priority');

    // Trigger dual survey completion check and potential merging
    try {
      const DualSurveyTrigger = require('../services/DualSurveyTrigger');
      const triggerResult = await DualSurveyTrigger.checkAndTriggerMerging(
        submission.ammcId,
        submission.organization
      );

      console.log(`🔄 Dual survey trigger result:`, triggerResult);

      // Add trigger result to response for debugging
      submittedSubmission._doc.dualSurveyTrigger = triggerResult;
    } catch (triggerError) {
      console.error('❌ Dual survey trigger failed:', triggerError);
      // Don't fail the submission if trigger fails
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Survey submitted successfully',
      data: submittedSubmission
    });
  } catch (error) {
    console.error('Submit survey error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to submit survey',
      error: error.message
    });
  }
};

// Add contact log entry
const addContactLogEntry = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { userId } = req.user;
    const { date, method, notes, successful = true, duration } = req.body;

    if (!method || !notes) {
      throw new BadRequestError('Contact method and notes are required');
    }

    const submission = await SurveySubmission.findOne({
      _id: submissionId,
      surveyorId: userId
    });

    if (!submission) {
      throw new NotFoundError('Submission not found or access denied');
    }

    submission.addContactEntry({
      date: date || new Date(),
      method,
      notes,
      successful,
      duration
    });

    await submission.save();

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Contact log entry added successfully',
      data: {
        contactLog: submission.contactLog
      }
    });
  } catch (error) {
    console.error('Add contact log entry error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to add contact log entry',
      error: error.message
    });
  }
};

// Get submission by assignment ID
const getSubmissionByAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { userId, role } = req.user;

    console.log('getSubmissionByAssignment - User:', { userId, role });
    console.log('getSubmissionByAssignment - Assignment ID:', assignmentId);

    // Verify assignment exists and user has access (surveyor or admin)
    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      console.log('Assignment not found:', assignmentId);
      throw new NotFoundError('Assignment not found');
    }

    console.log('Assignment found:', {
      assignmentId: assignment._id,
      surveyorId: assignment.surveyorId
    });

    // Check if user is the assigned surveyor, an admin, or the policy owner
    const isAssignedSurveyor = assignment.surveyorId && assignment.surveyorId.toString() === userId.toString();
    const isAdmin = role === 'Admin' || role === 'Super-admin';

    let isPolicyOwner = false;
    if (role === 'user') {
      // For regular users, check if they own the policy
      const User = require('../models/User');
      const user = await User.findById(userId);

      if (user && assignment.ammcId) {
        // Populate the assignment's ammcId to get policy details
        await assignment.populate('ammcId', 'contactDetails');
        isPolicyOwner = user.email === assignment.ammcId?.contactDetails?.email;
        console.log('Policy ownership check:', {
          userEmail: user.email,
          policyEmail: assignment.ammcId?.contactDetails?.email,
          isPolicyOwner
        });
      }
    }

    console.log('Access check:', {
      isAssignedSurveyor,
      isAdmin,
      isPolicyOwner,
      userRole: role,
      surveyorIdMatch: assignment.surveyorId?.toString() === userId.toString()
    });

    if (!isAssignedSurveyor && !isAdmin && !isPolicyOwner) {
      console.log('Access denied for user:', { userId, role });
      throw new NotFoundError('Access denied');
    }

    const submission = await SurveySubmission.findOne({
      assignmentId: assignmentId
    })
      .populate('ammcId', 'policyNumber contactDetails propertyDetails')
      .populate('reviewedBy', 'firstname lastname email');

    console.log('Submission found:', submission ? 'Yes' : 'No');

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        submission,
        assignment: {
          _id: assignment._id,
          deadline: assignment.deadline,
          priority: assignment.priority,
          status: assignment.status,
          instructions: assignment.instructions
        }
      }
    });
  } catch (error) {
    console.error('Get submission by assignment error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get submission',
      error: error.message
    });
  }
};

// Delete draft submission
const deleteDraftSubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { userId } = req.user;

    const submission = await SurveySubmission.findOne({
      _id: submissionId,
      surveyorId: userId,
      status: 'draft'
    });

    if (!submission) {
      throw new NotFoundError('Draft submission not found or access denied');
    }

    await SurveySubmission.findByIdAndDelete(submissionId);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Draft submission deleted successfully'
    });
  } catch (error) {
    console.error('Delete draft submission error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete draft submission',
      error: error.message
    });
  }
};

module.exports = {
  createSurveySubmission,
  getSurveyorSubmissions,
  getSubmissionById,
  updateSurveySubmission,
  submitSurvey,
  addContactLogEntry,
  getSubmissionByAssignment,
  deleteDraftSubmission
};
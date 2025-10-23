const { StatusCodes } = require('http-status-codes');
const SurveySubmission = require('../models/SurveySubmission');
const Assignment = require('../models/Assignment');
const PolicyRequest = require('../models/PolicyRequest');
const { BadRequestError, NotFoundError } = require('../errors');

// Create survey submission
const createSurveySubmission = async (req, res) => {
  try {
    const { userId } = req.user;
    const submissionData = { ...req.body, surveyorId: userId };

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
      if (key !== 'revisionHistory' && key !== 'revisionNotes') {
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

    submission.status = 'submitted';
    submission.submissionTime = new Date();

    if (finalNotes) {
      submission.surveyNotes = submission.surveyNotes + '\n\nFinal Notes: ' + finalNotes;
    }

    await submission.save();

    const submittedSubmission = await SurveySubmission.findById(submissionId)
      .populate('ammcId', 'policyNumber contactDetails')
      .populate('assignmentId', 'deadline priority');

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

    // Check if user is the assigned surveyor or an admin
    const isAssignedSurveyor = assignment.surveyorId && assignment.surveyorId.toString() === userId.toString();
    const isAdmin = role === 'Admin' || role === 'Super-admin';

    console.log('Access check:', {
      isAssignedSurveyor,
      isAdmin,
      userRole: role,
      surveyorIdMatch: assignment.surveyorId?.toString() === userId.toString()
    });

    if (!isAssignedSurveyor && !isAdmin) {
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
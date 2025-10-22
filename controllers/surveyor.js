const { StatusCodes } = require('http-status-codes');
const Surveyor = require('../models/Surveyor');
const Assignment = require('../models/Assignment');
const SurveySubmission = require('../models/SurveySubmission');
const PolicyRequest = require('../models/PolicyRequest');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');

// Get surveyor dashboard data
const getSurveyorDashboard = async (req, res) => {
  try {
    const surveyorUserId = req.user.userId;

    // Get or create surveyor profile
    let surveyor = await Surveyor.findOne({ userId: surveyorUserId });
    if (!surveyor) {
      surveyor = await Surveyor.create({
        userId: surveyorUserId,
        profile: { specialization: ['residential'] }
      });
    }

    // Get assignments
    const assignments = await Assignment.find({
      surveyorId: surveyorUserId
    })
      .populate('ammcId', 'propertyDetails contactDetails requestDetails status priority deadline')
      .sort({ assignedAt: -1, deadline: 1 })
      .limit(10);

    // Get recent submissions
    const recentSubmissions = await SurveySubmission.find({
      surveyorId: surveyorUserId
    })
      .populate('ammcId', 'propertyDetails status')
      .sort({ submissionTime: -1 })
      .limit(5);

    // Calculate statistics
    const totalAssignments = await Assignment.countDocuments({ surveyorId: surveyorUserId });
    const pendingAssignments = await Assignment.countDocuments({
      surveyorId: surveyorUserId,
      status: { $in: ['assigned', 'accepted', 'in-progress'] }
    });
    const inProgressAssignments = await Assignment.countDocuments({
      surveyorId: surveyorUserId,
      status: 'in-progress'
    });
    const completedSurveys = await Assignment.countDocuments({
      surveyorId: surveyorUserId,
      status: 'completed'
    });
    const overdueAssignments = await Assignment.countDocuments({
      surveyorId: surveyorUserId,
      deadline: { $lt: new Date() },
      status: { $in: ['assigned', 'accepted', 'in-progress'] }
    });

    // Update surveyor statistics
    surveyor.statistics.totalAssignments = totalAssignments;
    surveyor.statistics.pendingAssignments = pendingAssignments;
    surveyor.statistics.completedSurveys = completedSurveys;
    await surveyor.save();

    const dashboardData = {
      profile: surveyor,
      statistics: {
        total: totalAssignments,
        pending: pendingAssignments,
        inProgress: inProgressAssignments,
        completed: completedSurveys,
        overdue: overdueAssignments
      },
      recentAssignments: assignments,
      recentSubmissions
    };

    res.status(StatusCodes.OK).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Get surveyor dashboard error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get dashboard data',
      error: error.message
    });
  }
};

// Get surveyor assignments
const getSurveyorAssignments = async (req, res) => {
  try {
    const surveyorUserId = req.user.userId;
    const { status, priority, page = 1, limit = 10 } = req.query;

    const query = { surveyorId: surveyorUserId };
    if (status && status !== 'all') {
      // Map frontend filter values to backend statuses
      if (status === 'pending') {
        query.status = { $in: ['assigned', 'accepted'] };
      } else if (status === 'completed') {
        query.status = 'completed';
      } else {
        query.status = status;
      }
    }
    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    const skip = (page - 1) * limit;

    const assignments = await Assignment.find(query)
      .populate('ammcId', 'propertyDetails contactDetails requestDetails status priority deadline')
      .populate('assignedBy', 'firstname lastname email')
      .sort({ assignedAt: -1, deadline: 1, priority: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Assignment.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        assignments,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: assignments.length,
          totalRecords: total
        }
      }
    });
  } catch (error) {
    console.error('Get surveyor assignments error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get assignments',
      error: error.message
    });
  }
};

// Get assignment by ID
const getAssignmentById = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const surveyorUserId = req.user.userId;
    console.log(`Getting assignment ${assignmentId} for surveyor ${surveyorUserId}`);

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      surveyorId: surveyorUserId
    })
      .populate({
        path: 'ammcId',
        populate: {
          path: 'assignedSurveyors',
          select: 'firstname lastname email'
        }
      })
      .populate('assignedBy', 'firstname lastname email');

    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('Get assignment by ID error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get assignment',
      error: error.message
    });
  }
};

// Update assignment status
const updateAssignmentStatus = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { status, notes } = req.body;
    const surveyorUserId = req.user.userId;

    const assignment = await Assignment.findOne({
      _id: assignmentId,
      surveyorId: surveyorUserId
    });

    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }

    // Validate status transition
    const validTransitions = {
      'assigned': ['accepted', 'rejected'],
      'accepted': ['in-progress'],
      'in-progress': ['completed'],
      'completed': [], // Cannot change from completed
      'rejected': [], // Cannot change from rejected
      'cancelled': [] // Cannot change from cancelled
    };

    if (!validTransitions[assignment.status].includes(status)) {
      throw new BadRequestError(`Invalid status transition from ${assignment.status} to ${status}`);
    }

    assignment.status = status;

    // Update progress tracking based on status
    if (status === 'in-progress' && !assignment.progressTracking.startedAt) {
      assignment.progressTracking.startedAt = new Date();
    } else if (status === 'completed') {
      assignment.progressTracking.completedAt = new Date();
      assignment.actualDuration = assignment.duration;
    }

    // Add message if notes provided
    if (notes) {
      assignment.addMessage(surveyorUserId, notes, 'status_update');
    }

    await assignment.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Assignment status updated successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Update assignment status error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update assignment status',
      error: error.message
    });
  }
};

// Submit survey
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

const submitSurvey = async (req, res) => {
  try {
    const surveyorUserId = req.user.userId;
    const {
      ammcId,
      assignmentId,
      surveyNotes,
      recommendedAction
    } = req.body;

    const surveyDetails = JSON.parse(req.body.surveyDetails);
    const contactLog = req.body.contactLog ? JSON.parse(req.body.contactLog) : [];
    const expenses = req.body.expenses ? JSON.parse(req.body.expenses) : null;

    // Validate policy exists and is assigned to this surveyor
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      surveyorId: surveyorUserId,
      status: { $nin: ['rejected', 'cancelled'] }
    });

    if (!assignment) {
      throw new NotFoundError('Assignment not found or not in progress');
    }

    let surveyDocumentUrl = '';
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        use_filename: true,
        folder: 'survey-documents'
      });
      surveyDocumentUrl = result.secure_url;
      fs.unlinkSync(req.file.path);
    }

    // Create survey submission
    const submission = new SurveySubmission({
      ammcId,
      surveyorId: surveyorUserId,
      assignmentId,
      surveyDetails,
      surveyDocument: surveyDocumentUrl,
      surveyNotes,
      contactLog: contactLog || [],
      recommendedAction,
      status: 'submitted'
    });

    await submission.save();

    // Update assignment status and expenses
    assignment.status = 'completed';
    assignment.progressTracking.completedAt = new Date();

    // Update expenses if provided
    if (expenses) {
      assignment.expenses = {
        ...assignment.expenses,
        transportation: expenses.transportation || 0,
        accommodation: expenses.accommodation || 0,
        meals: expenses.meals || 0,
        equipment: expenses.equipment || 0,
        other: expenses.other || 0
      };
    }

    await assignment.save();

    // Update policy request status
    await PolicyRequest.findByIdAndUpdate(ammcId, {
      status: 'surveyed',
      surveyDocument: surveyDocumentUrl,
      surveyNotes
    });

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Survey submitted successfully',
      data: submission
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

// Get surveyor submissions
const getSurveyorSubmissions = async (req, res) => {
  try {
    const surveyorUserId = req.user.userId;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { surveyorId: surveyorUserId };
    if (status && status !== 'all') {
      query.status = { $in: status.split(',') };
    }

    const skip = (page - 1) * limit;

    const submissions = await SurveySubmission.find(query)
      .populate('ammcId', 'propertyDetails contactDetails status requestDetails')
      .populate('reviewedBy', 'firstname lastname')
      .sort({ submissionTime: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await SurveySubmission.countDocuments(query);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        submissions,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: submissions.length,
          totalRecords: total
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

// Get surveyor profile
const getSurveyorProfile = async (req, res) => {
  try {
    const surveyorUserId = req.user.userId;

    let surveyor = await Surveyor.findOne({ userId: surveyorUserId })
      .populate('userId', 'firstname lastname email phonenumber');

    if (!surveyor) {
      surveyor = await Surveyor.create({
        userId: surveyorUserId,
        profile: { specialization: ['residential'] }
      });
      await surveyor.populate('userId', 'firstname lastname email phonenumber');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: surveyor
    });
  } catch (error) {
    console.error('Get surveyor profile error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
};

// Update surveyor profile
const updateSurveyorProfile = async (req, res) => {
  try {
    const surveyorUserId = req.user.userId;
    const updates = req.body;

    let surveyor = await Surveyor.findOne({ userId: surveyorUserId });

    if (!surveyor) {
      throw new NotFoundError('Surveyor profile not found');
    }

    // Update allowed fields
    const allowedUpdates = ['profile', 'settings'];
    allowedUpdates.forEach(field => {
      if (updates[field]) {
        surveyor[field] = { ...surveyor[field], ...updates[field] };
      }
    });

    await surveyor.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Profile updated successfully',
      data: surveyor
    });
  } catch (error) {
    console.error('Update surveyor profile error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

module.exports = {
  getSurveyorDashboard,
  getSurveyorAssignments,
  getAssignmentById,
  updateAssignmentStatus,
  submitSurvey,
  getSurveyorSubmissions,
  getSurveyorProfile,
  updateSurveyorProfile
};
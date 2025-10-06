// Create a new assignment (admin only)
const createAssignment = async (req, res) => {
  try {
    const { policyId, surveyorId, assignedBy, status, priority, deadline } = req.body;
    if (!policyId || !surveyorId) {
      throw new BadRequestError('policyId and surveyorId are required');
    }
    const assignment = await Assignment.create({
      policyId,
      surveyorId,
      assignedBy,
      status: status || 'assigned',
      priority: priority || 'normal',
      deadline
    });
    res.status(StatusCodes.CREATED).json({ success: true, data: assignment });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};
const { StatusCodes } = require('http-status-codes');
const Assignment = require('../models/Assignment');
const PolicyRequest = require('../models/PolicyRequest');
const Surveyor = require('../models/Surveyor');
const SurveySubmission = require('../models/SurveySubmission');
const { BadRequestError, NotFoundError } = require('../errors');

// Get assignments for the authenticated surveyor
const getSurveyorAssignments = async (req, res) => {
  try {
    const { userId } = req.user;
    const { status, page = 1, limit = 10, sortBy = 'assignedAt', sortOrder = 'desc' } = req.query;
    
    const query = { surveyorId: userId };
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const assignments = await Assignment.find(query)
      .populate('policyId', 'policyNumber contactDetails propertyDetails status priority')
      .populate('assignedBy', 'firstname lastname email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Assignment.countDocuments(query);
    
    // Get summary statistics
    const statusStats = await Assignment.aggregate([
      { $match: { surveyorId: userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        assignments,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: assignments.length,
          totalRecords: total
        },
        statistics: {
          statusBreakdown: statusStats
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

// Get assignment by ID (for surveyor)
const getAssignmentById = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { userId } = req.user;
    
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      surveyorId: userId
    })
    .populate({
      path: 'policyId',
      populate: {
        path: 'assignedSurveyors',
        select: 'firstname lastname email'
      }
    })
    .populate('assignedBy', 'firstname lastname email');
    
    if (!assignment) {
      throw new NotFoundError('Assignment not found or access denied');
    }
    
    // Get related submissions
    const submissions = await SurveySubmission.find({ 
      assignmentId: assignmentId,
      surveyorId: userId 
    }).sort({ submissionTime: -1 });
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        assignment,
        submissions
      }
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

// Accept assignment
const acceptAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { userId } = req.user;
    const { notes = '' } = req.body;
    
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      surveyorId: userId,
      status: 'assigned'
    });
    
    if (!assignment) {
      throw new NotFoundError('Assignment not found or cannot be accepted');
    }
    
    assignment.status = 'accepted';
    assignment.timeline.push({
      action: 'assignment_accepted',
      timestamp: new Date(),
      performedBy: userId,
      details: 'Assignment accepted by surveyor',
      notes: notes
    });
    
    await assignment.save();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Assignment accepted successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Accept assignment error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to accept assignment',
      error: error.message
    });
  }
};

// Start assignment
const startAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { userId } = req.user;
    const { location, notes = '' } = req.body;
    
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      surveyorId: userId,
      status: { $in: ['assigned', 'accepted'] }
    });
    
    if (!assignment) {
      throw new NotFoundError('Assignment not found or cannot be started');
    }
    
    assignment.status = 'in_progress';
    assignment.progressTracking.startedAt = new Date();
    
    if (location) {
      assignment.addCheckpoint(location, 'Started assignment', []);
    }
    
    assignment.timeline.push({
      action: 'assignment_started',
      timestamp: new Date(),
      performedBy: userId,
      details: 'Assignment work started',
      notes: notes
    });
    
    await assignment.save();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Assignment started successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Start assignment error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to start assignment',
      error: error.message
    });
  }
};

// Update assignment progress
const updateAssignmentProgress = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { userId } = req.user;
    const { milestone, notes, location, photos = [] } = req.body;
    
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      surveyorId: userId,
      status: 'in_progress'
    });
    
    if (!assignment) {
      throw new NotFoundError('Assignment not found or not in progress');
    }
    
    if (milestone) {
      assignment.updateProgress(milestone, notes);
    }
    
    if (location) {
      assignment.addCheckpoint(location, notes || 'Progress update', photos);
    }
    
    assignment.timeline.push({
      action: 'progress_updated',
      timestamp: new Date(),
      performedBy: userId,
      details: milestone || 'Progress checkpoint added',
      notes: notes
    });
    
    await assignment.save();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Progress updated successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Update assignment progress error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update progress',
      error: error.message
    });
  }
};

// Complete assignment
const completeAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { userId } = req.user;
    const { notes = '', finalLocation } = req.body;
    
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      surveyorId: userId,
      status: 'in_progress'
    });
    
    if (!assignment) {
      throw new NotFoundError('Assignment not found or not in progress');
    }
    
    // Check if there's a survey submission
    const submission = await SurveySubmission.findOne({
      assignmentId: assignmentId,
      surveyorId: userId
    });
    
    if (!submission) {
      throw new BadRequestError('Cannot complete assignment without submitting survey');
    }
    
    assignment.status = 'completed';
    assignment.progressTracking.completedAt = new Date();
    
    if (finalLocation) {
      assignment.addCheckpoint(finalLocation, 'Assignment completed', []);
    }
    
    assignment.timeline.push({
      action: 'assignment_completed',
      timestamp: new Date(),
      performedBy: userId,
      details: 'Assignment work completed',
      notes: notes
    });
    
    // Calculate actual duration
    if (assignment.progressTracking.startedAt) {
      const duration = (new Date() - assignment.progressTracking.startedAt) / (1000 * 60 * 60); // in hours
      assignment.actualDuration = Math.round(duration * 100) / 100;
    }
    
    await assignment.save();
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Assignment completed successfully',
      data: assignment
    });
  } catch (error) {
    console.error('Complete assignment error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to complete assignment',
      error: error.message
    });
  }
};

// Add message to assignment
const addAssignmentMessage = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { userId } = req.user;
    const { message, type = 'message' } = req.body;
    
    if (!message || message.trim().length === 0) {
      throw new BadRequestError('Message is required');
    }
    
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      surveyorId: userId
    });
    
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    
    assignment.addMessage(userId, message.trim(), type);
    await assignment.save();
    
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Message added successfully',
      data: {
        messageId: assignment.communication.messages[assignment.communication.messages.length - 1]._id
      }
    });
  } catch (error) {
    console.error('Add assignment message error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to add message',
      error: error.message
    });
  }
};

// Get assignment messages
const getAssignmentMessages = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { userId } = req.user;
    
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      surveyorId: userId
    })
    .populate('communication.messages.from', 'firstname lastname email')
    .select('communication');
    
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        messages: assignment.communication.messages.sort((a, b) => b.timestamp - a.timestamp),
        lastContact: assignment.communication.lastContact
      }
    });
  } catch (error) {
    console.error('Get assignment messages error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get messages',
      error: error.message
    });
  }
};

module.exports = {
  getSurveyorAssignments,
  getAssignmentById,
  acceptAssignment,
  startAssignment,
  updateAssignmentProgress,
  completeAssignment,
  addAssignmentMessage,
  getAssignmentMessages,
  createAssignment
};
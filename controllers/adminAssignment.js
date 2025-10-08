const { StatusCodes } = require('http-status-codes');
const Assignment = require('../models/Assignment');
const PolicyRequest = require('../models/PolicyRequest');
const Surveyor = require('../models/Surveyor');
const SurveySubmission = require('../models/SurveySubmission');
const { BadRequestError, NotFoundError } = require('../errors');

// Get all assignments with comprehensive filters for admin dashboard
const getAllAssignments = async (req, res) => {
  try {
    const { 
      status, 
      priority, 
      surveyorId, 
      policyId,
      dateRange,
      page = 1, 
      limit = 20, 
      search,
      sortBy = 'assignedAt',
      sortOrder = 'desc'
    } = req.query;
    
    const query = {};
    
    // Apply filters
    if (status && status !== 'all') {
      query.status = status;
    }
    if (priority && priority !== 'all') {
      query.priority = priority;
    }
    if (surveyorId) {
      query.surveyorId = surveyorId;
    }
    if (policyId) {
      query.policyId = policyId;
    }
    
    // Date range filter
    if (dateRange) {
      const { start, end } = JSON.parse(dateRange);
      if (start && end) {
        query.assignedAt = {
          $gte: new Date(start),
          $lte: new Date(end)
        };
      }
    }
    
    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // If search is provided, we need to populate and filter
    let assignments;
    if (search) {
      assignments = await Assignment.find(query)
        .populate({
          path: 'policyId',
          match: {
            $or: [
              { 'contactDetails.fullName': { $regex: search, $options: 'i' } },
              { 'contactDetails.email': { $regex: search, $options: 'i' } },
              { 'propertyDetails.address': { $regex: search, $options: 'i' } }
            ]
          }
        })
        .populate('surveyorId', 'userid firstname lastname email phonenumber profile')
        .populate('assignedBy', 'firstname lastname')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));
      
      // Filter out null populated fields
      assignments = assignments.filter(assignment => assignment.policyId);
    } else {
      assignments = await Assignment.find(query)
        .populate('policyId', 'policyNumber contactDetails propertyDetails status priority')
        .populate('surveyorId', 'userid firstname lastname email phonenumber profile')
        .populate('assignedBy', 'firstname lastname')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));
    }
    
    const total = await Assignment.countDocuments(query);
    
    // Get assignment statistics
    const statusStats = await Assignment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const priorityStats = await Assignment.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);
    
    const overdueCount = await Assignment.countDocuments({
      status: { $in: ['assigned', 'in_progress'] },
      deadline: { $lt: new Date() }
    });
    
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
          statusBreakdown: statusStats,
          priorityBreakdown: priorityStats,
          overdueAssignments: overdueCount
        }
      }
    });
  } catch (error) {
    console.error('Get all assignments error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get assignments',
      error: error.message
    });
  }
};

// Get assignment by ID with full details
const getAssignmentById = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    
    const assignment = await Assignment.findById(assignmentId)
      .populate({
        path: 'policyId',
        populate: {
          path: 'assignedSurveyors',
          select: 'firstname lastname email'
        }
      })
      .populate('surveyorId', 'userid firstname lastname email phonenumber profile statistics')
      .populate('assignedBy', 'firstname lastname email');
    
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    
    // Get related submissions
    const submissions = await SurveySubmission.find({ 
      assignmentId: assignmentId 
    }).sort({ submissionTime: -1 });
    
    // Get surveyor's recent assignments for context
    const recentAssignments = await Assignment.find({
      surveyorId: assignment.surveyorId._id,
      _id: { $ne: assignmentId }
    })
    .populate('policyId', 'policyNumber status')
    .sort({ assignedAt: -1 })
    .limit(5);
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        assignment,
        submissions,
        surveyor: {
          ...assignment.surveyorId.toObject(),
          recentAssignments
        }
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

// Update assignment (deadline, priority, instructions, etc.)
const updateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const updates = req.body;
    const adminId = req.user.userId;
    
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    
    // Track significant changes
    const significantChanges = [];
    if (updates.deadline && new Date(updates.deadline).getTime() !== assignment.deadline.getTime()) {
      significantChanges.push(`Deadline changed from ${assignment.deadline} to ${updates.deadline}`);
    }
    if (updates.priority && updates.priority !== assignment.priority) {
      significantChanges.push(`Priority changed from ${assignment.priority} to ${updates.priority}`);
    }
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== 'timeline') {
        assignment[key] = updates[key];
      }
    });
    
    // Add timeline entry for significant changes
    if (significantChanges.length > 0) {
      assignment.timeline.push({
        action: 'assignment_updated',
        timestamp: new Date(),
        performedBy: adminId,
        details: significantChanges.join('; '),
        notes: updates.updateReason || 'Assignment updated by admin'
      });
    }
    
    await assignment.save();
    
    const updatedAssignment = await Assignment.findById(assignmentId)
      .populate('policyId', 'policyNumber contactDetails')
      .populate('surveyorId', 'firstname lastname email')
      .populate('assignedBy', 'firstname lastname');
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Assignment updated successfully',
      data: updatedAssignment
    });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update assignment',
      error: error.message
    });
  }
};

// Reassign assignment to different surveyor
const reassignAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { newSurveyorId, reason, deadline, priority } = req.body;
    const adminId = req.user.userId;
    
    const assignment = await Assignment.findById(assignmentId)
      .populate('surveyorId', 'firstname lastname')
      .populate('policyId', 'policyNumber');
    
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    
    // Validate new surveyor
    const newSurveyor = await Surveyor.findOne({
      userId: newSurveyorId,
      status: 'active'
    }).populate('userId', 'firstname lastname');
    
    if (!newSurveyor) {
      throw new BadRequestError('New surveyor not found or inactive');
    }
    
    const oldSurveyor = assignment.surveyorId;
    
    // Update assignment
    assignment.surveyorId = newSurveyorId;
    assignment.status = 'assigned'; // Reset status
    if (deadline) assignment.deadline = deadline;
    if (priority) assignment.priority = priority;
    
    // Add timeline entry
    assignment.timeline.push({
      action: 'assignment_reassigned',
      timestamp: new Date(),
      performedBy: adminId,
      details: `Reassigned from ${oldSurveyor.firstname} ${oldSurveyor.lastname} to ${newSurveyor.userId.firstname} ${newSurveyor.userId.lastname}`,
      notes: reason || 'Assignment reassigned by admin'
    });
    
    await assignment.save();
    
    const updatedAssignment = await Assignment.findById(assignmentId)
      .populate('policyId', 'policyNumber contactDetails')
      .populate('surveyorId', 'firstname lastname email')
      .populate('assignedBy', 'firstname lastname');
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Assignment reassigned successfully',
      data: updatedAssignment
    });
  } catch (error) {
    console.error('Reassign assignment error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to reassign assignment',
      error: error.message
    });
  }
};

// Cancel assignment
const cancelAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.userId;
    
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }
    
    if (assignment.status === 'completed' || assignment.status === 'cancelled') {
      throw new BadRequestError(`Cannot cancel assignment with status: ${assignment.status}`);
    }
    
    assignment.status = 'cancelled';
    assignment.timeline.push({
      action: 'assignment_cancelled',
      timestamp: new Date(),
      performedBy: adminId,
      details: 'Assignment cancelled by admin',
      notes: reason || 'Assignment cancelled'
    });
    
    await assignment.save();
    
    // Update policy request status if needed
    const policyRequest = await PolicyRequest.findById(assignment.policyId);
    if (policyRequest) {
      // Check if this was the last active assignment
      const activeAssignments = await Assignment.countDocuments({
        policyId: assignment.policyId,
        status: { $in: ['assigned', 'in_progress'] }
      });
      
      if (activeAssignments === 0) {
        policyRequest.status = 'pending'; // Back to pending for reassignment
        policyRequest.statusHistory.push({
          status: 'pending',
          changedBy: adminId,
          changedAt: new Date(),
          reason: 'All assignments cancelled - returned to pending'
        });
        await policyRequest.save();
      }
    }
    
    const updatedAssignment = await Assignment.findById(assignmentId)
      .populate('policyId', 'policyNumber contactDetails')
      .populate('surveyorId', 'firstname lastname email')
      .populate('assignedBy', 'firstname lastname');
    
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Assignment cancelled successfully',
      data: updatedAssignment
    });
  } catch (error) {
    console.error('Cancel assignment error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to cancel assignment',
      error: error.message
    });
  }
};

// Get assignment analytics/dashboard data
const getAssignmentAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    // Assignment metrics
    const totalAssignments = await Assignment.countDocuments({
      assignedAt: { $gte: startDate }
    });
    
    const completedAssignments = await Assignment.countDocuments({
      status: 'completed',
      assignedAt: { $gte: startDate }
    });
    
    const overdueAssignments = await Assignment.countDocuments({
      status: { $in: ['assigned', 'in_progress'] },
      deadline: { $lt: now }
    });
    
    const avgCompletionTime = await Assignment.aggregate([
      {
        $match: {
          status: 'completed',
          assignedAt: { $gte: startDate }
        }
      },
      {
        $addFields: {
          completionTime: {
            $subtract: ['$completedAt', '$assignedAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$completionTime' }
        }
      }
    ]);
    
    // Performance by surveyor
    const surveyorPerformance = await Assignment.aggregate([
      {
        $match: {
          assignedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$surveyorId',
          totalAssignments: { $sum: 1 },
          completedAssignments: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          overdueAssignments: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['assigned', 'in_progress']] },
                    { $lt: ['$deadline', now] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'surveyors',
          localField: '_id',
          foreignField: 'userId',
          as: 'surveyor'
        }
      },
      {
        $unwind: '$surveyor'
      },
      {
        $lookup: {
          from: 'employees',
          localField: 'surveyor.userId',
          foreignField: '_id',
          as: 'employee'
        }
      },
      {
        $unwind: '$employee'
      },
      {
        $addFields: {
          completionRate: {
            $cond: [
              { $gt: ['$totalAssignments', 0] },
              { $divide: ['$completedAssignments', '$totalAssignments'] },
              0
            ]
          }
        }
      },
      {
        $sort: { completionRate: -1 }
      },
      {
        $limit: 10
      }
    ]);
    
    // Assignment timeline data
    const timelineData = await Assignment.aggregate([
      {
        $match: {
          assignedAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$assignedAt' } }
          },
          assigned: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        metrics: {
          totalAssignments,
          completedAssignments,
          overdueAssignments,
          completionRate: totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0,
          avgCompletionTime: avgCompletionTime[0]?.avgTime || 0
        },
        surveyorPerformance,
        timelineData
      }
    });
  } catch (error) {
    console.error('Get assignment analytics error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get assignment analytics',
      error: error.message
    });
  }
};

const createAssignment = async (req, res) => {
  try {
    const { policyId, surveyorIds, assignedBy, priority, instructions, deadline } = req.body;

    if (!policyId || !surveyorIds || surveyorIds.length === 0 || !priority || !deadline) {
      throw new BadRequestError('Missing required assignment fields');
    }

    // Check if policy exists and is in a state to be assigned
    const policy = await PolicyRequest.findById(policyId);
    if (!policy) {
      throw new NotFoundError('Policy not found');
    }
    if (policy.status !== 'submitted' && policy.status !== 'pending') {
      throw new BadRequestError(`Policy status is ${policy.status}, cannot assign surveyor.`);
    }

    // Check if surveyors exist and are active
    const validSurveyors = await Surveyor.find({
      _id: { $in: surveyorIds },
      status: 'active'
    });

    if (validSurveyors.length !== surveyorIds.length) {
      throw new BadRequestError('One or more surveyors not found or inactive');
    }

    const newAssignment = await Assignment.create({
      policyId,
      surveyorId: surveyorIds[0], // Assigning to the first selected surveyor for now
      assignedBy: req.user.userId, // Admin who assigned it
      assignedAt: new Date(),
      deadline: new Date(deadline),
      priority,
      instructions,
      specialRequirements: policy.requestDetails.specialRequests ? [policy.requestDetails.specialRequests] : [],
      location: policy.propertyDetails.address, // Simplified for now
      contactPerson: policy.contactDetails, // Simplified for now
      status: 'assigned',
      timeline: [{
        action: 'assignment_created',
        timestamp: new Date(),
        performedBy: req.user.userId,
        details: `Assignment created for policy ${policy.policyNumber || policyId}`
      }]
    });

    // Update policy status and assigned surveyors
    policy.status = 'assigned';
    policy.assignedSurveyors = surveyorIds;
    policy.statusHistory.push({
      status: 'assigned',
      changedBy: req.user.userId,
      changedAt: new Date(),
      reason: 'Surveyor assigned'
    });
    await policy.save();

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Assignment created successfully',
      data: newAssignment
    });

  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create assignment',
      error: error.message
    });
  }
};

module.exports = {
  getAllAssignments,
  getAssignmentById,
  updateAssignment,
  reassignAssignment,
  cancelAssignment,
  getAssignmentAnalytics,
  createAssignment
};
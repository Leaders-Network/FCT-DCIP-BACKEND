const { StatusCodes } = require('http-status-codes');
const Assignment = require('../models/Assignment');
const PolicyRequest = require('../models/PolicyRequest');
const Surveyor = require('../models/Surveyor');
const SurveySubmission = require('../models/SurveySubmission');
const { BadRequestError, NotFoundError } = require('../errors');
const EnhancedNotificationService = require('../services/EnhancedNotificationService');

// Get all assignments with comprehensive filters for admin dashboard
const getAllAssignments = async (req, res) => {
  try {
    const {
      status,
      priority,
      surveyorId,
      ammcId,
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
    if (ammcId) {
      query.ammcId = ammcId;
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
          path: 'ammcId',
          match: {
            $or: [
              { 'contactDetails.fullName': { $regex: search, $options: 'i' } },
              { 'contactDetails.email': { $regex: search, $options: 'i' } },
              { 'propertyDetails.address': { $regex: search, $options: 'i' } }
            ]
          }
        })
        .populate('surveyorId', 'firstname lastname email phonenumber')
        .populate('assignedBy', 'firstname lastname')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      // Filter out null populated fields
      assignments = assignments.filter(assignment => assignment.ammcId);
    } else {
      assignments = await Assignment.find(query)
        .populate('ammcId', 'policyNumber contactDetails propertyDetails status priority')
        .populate('surveyorId', 'firstname lastname email phonenumber')
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
        path: 'ammcId',
        populate: {
          path: 'assignedSurveyors',
          select: 'firstname lastname email'
        }
      })
      .populate('surveyorId', 'firstname lastname email phonenumber')
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
      .populate('ammcId', 'policyNumber status')
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
      .populate('ammcId', 'policyNumber contactDetails')
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
      .populate('ammcId', 'policyNumber');

    if (!assignment) {
      throw new NotFoundError('Assignment not found');
    }

    // Validate new surveyor
    const newSurveyor = await Surveyor.findOne({
      _id: newSurveyorId,
      status: 'active'
    }).populate('userId', 'firstname lastname');

    if (!newSurveyor) {
      throw new BadRequestError('New surveyor not found or inactive');
    }

    if (!newSurveyor.userId) {
      throw new BadRequestError('The selected surveyor does not have a valid employee record.');
    }

    const oldSurveyor = assignment.surveyorId;

    // Get new surveyor organization
    const newSurveyorOrganization = newSurveyor.organization || 'AMMC';

    // Get complete surveyor contact information using the AssignmentContactService
    const AssignmentContactService = require('../services/AssignmentContactService');
    let newSurveyorContactInfo = null;

    try {
      newSurveyorContactInfo = await AssignmentContactService.getSurveyorContactInfo(
        newSurveyor.userId._id,
        newSurveyorOrganization
      );
    } catch (contactError) {
      console.error('Failed to get new surveyor contact info:', contactError);
      // Create basic contact info as fallback
      newSurveyorContactInfo = {
        surveyorId: newSurveyor.userId._id,
        name: `${newSurveyor.userId.firstname} ${newSurveyor.userId.lastname}`,
        email: newSurveyor.userId.email,
        phone: newSurveyor.userId.phonenumber,
        licenseNumber: newSurveyor.licenseNumber || 'Not provided',
        address: newSurveyor.address || 'Not provided',
        emergencyContact: newSurveyor.emergencyContact || 'Not provided',
        specialization: newSurveyor.profile?.specialization || [],
        experience: newSurveyor.profile?.experience || 0,
        rating: newSurveyor.rating || 0,
        organization: newSurveyorOrganization,
        assignedAt: new Date()
      };
    }

    // Update assignment
    assignment.surveyorId = newSurveyor.userId._id; // use the Employee ID
    assignment.status = 'assigned'; // Reset status
    assignment.organization = newSurveyorOrganization;
    assignment.partnerSurveyorContact = newSurveyorContactInfo; // Update contact details
    if (deadline) assignment.deadline = deadline;
    if (priority) assignment.priority = priority;

    // Add timeline entry
    const details = oldSurveyor
      ? `Reassigned from ${oldSurveyor.firstname} ${oldSurveyor.lastname} to ${newSurveyor.userId.firstname} ${newSurveyor.userId.lastname} (${newSurveyorOrganization})`
      : `Assigned to ${newSurveyor.userId.firstname} ${newSurveyor.userId.lastname} (${newSurveyorOrganization})`;

    assignment.timeline.push({
      action: 'assignment_reassigned',
      timestamp: new Date(),
      performedBy: adminId,
      details: details,
      notes: reason || 'Assignment reassigned by admin'
    });

    await assignment.save();

    const updatedAssignment = await Assignment.findById(assignmentId)
      .populate('ammcId', 'policyNumber contactDetails')
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
    const policyRequest = await PolicyRequest.findById(assignment.ammcId);
    if (policyRequest) {
      // Check if this was the last active assignment
      const activeAssignments = await Assignment.countDocuments({
        ammcId: assignment.ammcId,
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
      .populate('ammcId', 'policyNumber contactDetails')
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
    const { ammcId, surveyorId, priority, instructions, deadline } = req.body;

    if (!ammcId || !surveyorId || !priority || !deadline) {
      throw new BadRequestError('Missing required assignment fields');
    }

    // Check if policy exists and is in a state to be assigned
    const policy = await PolicyRequest.findById(ammcId);
    if (!policy) {
      throw new NotFoundError('AMMC not found');
    }
    if (policy.status !== 'submitted' && policy.status !== 'pending') {
      throw new BadRequestError(`Policy status is ${policy.status}, cannot assign surveyor.`);
    }

    // Check if surveyor exists and is active
    const validSurveyor = await Surveyor.findOne({
      _id: surveyorId,
      status: 'active'
    }).populate('userId', 'firstname lastname email phonenumber employeeStatus');

    if (!validSurveyor) {
      throw new BadRequestError('Surveyor not found or inactive');
    }

    if (!validSurveyor.userId) {
      throw new BadRequestError('The selected surveyor does not have a valid employee record.');
    }

    // Get surveyor organization (default to AMMC if not specified)
    const surveyorOrganization = validSurveyor.organization || 'AMMC';

    // Get complete surveyor contact information using the AssignmentContactService
    const AssignmentContactService = require('../services/AssignmentContactService');
    let surveyorContactInfo = null;

    try {
      surveyorContactInfo = await AssignmentContactService.getSurveyorContactInfo(
        validSurveyor.userId._id,
        surveyorOrganization
      );
    } catch (contactError) {
      console.error('Failed to get surveyor contact info:', contactError);
      // Create basic contact info as fallback
      surveyorContactInfo = {
        surveyorId: validSurveyor.userId._id,
        name: `${validSurveyor.userId.firstname} ${validSurveyor.userId.lastname}`,
        email: validSurveyor.userId.email,
        phone: validSurveyor.userId.phonenumber,
        licenseNumber: validSurveyor.licenseNumber || 'Not provided',
        address: validSurveyor.address || 'Not provided',
        emergencyContact: validSurveyor.emergencyContact || 'Not provided',
        specialization: validSurveyor.profile?.specialization || [],
        experience: validSurveyor.profile?.experience || 0,
        rating: validSurveyor.rating || 0,
        organization: surveyorOrganization,
        assignedAt: new Date()
      };
    }

    const newAssignment = await Assignment.create({
      ammcId,
      surveyorId: validSurveyor.userId._id, // Use the Employee ID here
      assignedBy: req.user.userId, // Admin who assigned it
      assignedAt: new Date(),
      deadline: new Date(deadline),
      priority,
      instructions,
      organization: surveyorOrganization,
      location: {
        address: policy.propertyDetails.address,
        contactPerson: {
          name: policy.contactDetails.fullName,
          phone: policy.contactDetails.phoneNumber,
          email: policy.contactDetails.email,
        },
      },
      // Add surveyor contact information to the assignment
      partnerSurveyorContact: surveyorContactInfo,
      status: 'assigned',
      timeline: [{
        action: 'assignment_created',
        timestamp: new Date(),
        performedBy: req.user.userId,
        details: `Assignment created for policy ${policy.policyNumber || ammcId}`,
        notes: `Assigned to ${surveyorContactInfo.name} (${surveyorOrganization})`
      }]
    });

    // Update policy status and assigned surveyors
    policy.status = 'assigned';
    policy.assignedSurveyors = [validSurveyor._id];
    policy.statusHistory.push({
      status: 'assigned',
      changedBy: req.user.userId,
      changedAt: new Date(),
      reason: `Surveyor assigned: ${surveyorContactInfo.name} (${surveyorOrganization})`
    });
    await policy.save();

    // Populate the response with full assignment details
    const populatedAssignment = await Assignment.findById(newAssignment._id)
      .populate('ammcId', 'policyNumber contactDetails propertyDetails')
      .populate('surveyorId', 'firstname lastname email phonenumber')
      .populate('assignedBy', 'firstname lastname');

    // Send notifications about assignment creation
    try {
      // Notify surveyor about new assignment
      await EnhancedNotificationService.notifyPolicyAssigned(
        ammcId,
        surveyorId,
        surveyorContactInfo.email,
        newAssignment._id
      );

      // Notify user about assignment
      const policy = await PolicyRequest.findById(ammcId);
      if (policy && policy.userId) {
        const { User } = require('../models/User');
        const user = await User.findById(policy.userId);
        if (user) {
          await EnhancedNotificationService.create({
            recipientId: policy.userId.toString(),
            recipientType: 'user',
            type: 'policy_assigned',
            title: 'Surveyor Assigned',
            message: `A surveyor has been assigned to assess your property. They will contact you soon to schedule the survey.`,
            priority: 'medium',
            actionUrl: `/dashboard/policies/${ammcId}`,
            actionLabel: 'View Details',
            metadata: {
              policyId: ammcId.toString(),
              assignmentId: newAssignment._id.toString(),
              icon: 'UserCheck',
              color: 'blue'
            },
            sendEmail: true,
            recipientEmail: user.email
          });
        }
      }

      console.log(`Notifications sent for assignment creation: ${newAssignment._id}`);
    } catch (notificationError) {
      console.error('Failed to send assignment notifications:', notificationError);
      // Don't fail the process if notification fails
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Assignment created successfully with surveyor contact details',
      data: {
        assignment: populatedAssignment,
        surveyorContact: surveyorContactInfo,
        organization: surveyorOrganization
      }
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

const getAssignmentByAmmcId = async (req, res) => {
  try {
    const { ammcId } = req.params;
    const { userId, role } = req.user;

    console.log('getAssignmentByAmmcId - User:', { userId, role });
    console.log('getAssignmentByAmmcId - AMMC ID:', ammcId);

    const assignment = await Assignment.findOne({ ammcId: ammcId })
      .populate('ammcId', 'policyNumber contactDetails propertyDetails status priority')
      .populate('surveyorId', 'firstname lastname email phonenumber')
      .populate('assignedBy', 'firstname lastname');

    if (!assignment) {
      console.log('Assignment not found for AMMC ID:', ammcId);
      throw new NotFoundError('Assignment not found for this policy');
    }

    console.log('Assignment found:', {
      assignmentId: assignment._id,
      ammcId: assignment.ammcId?._id,
      policyOwner: assignment.ammcId?.contactDetails?.email
    });

    // For non-admin users, verify they own the policy
    if (role !== 'Admin' && role !== 'Super-admin') {
      // Get the user's email from their profile to match with policy
      const User = require('../models/User');
      const user = await User.findById(userId);

      if (!user) {
        console.log('User not found:', userId);
        throw new NotFoundError('User not found');
      }

      console.log('User email:', user.email);
      console.log('Policy email:', assignment.ammcId?.contactDetails?.email);

      // Check if the user owns this policy by comparing emails
      if (user.email !== assignment.ammcId?.contactDetails?.email) {
        console.log('Access denied - user does not own this policy');
        throw new NotFoundError('Access denied - you can only view your own policies');
      }
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('Get assignment by AMMC ID error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get assignment',
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
  createAssignment,
  getAssignmentByAmmcId
};
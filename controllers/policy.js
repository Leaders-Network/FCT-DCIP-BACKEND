const { StatusCodes } = require('http-status-codes');
const PolicyRequest = require('../models/PolicyRequest');
const Assignment = require('../models/Assignment');
const SurveySubmission = require('../models/SurveySubmission');
const Surveyor = require('../models/Surveyor');
const { Property } = require('../models/Property');
const { BadRequestError, NotFoundError } = require('../errors');
const { validatePolicy, searchUserPolicies } = require('../services/policyValidationService');

// Create policy request (for users)
const createPolicyRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const { propertyId, ...rest } = req.body;
    const policyData = { ...rest, userId };

    if (propertyId) {
      const property = await Property.findById(propertyId);
      if (!property) {
        throw new NotFoundError('Property not found');
      }
      policyData.propertyId = propertyId;
    }

    // Set initial status to 'submitted' to trigger dual assignment creation
    policyData.status = 'submitted';

    const policyRequest = new PolicyRequest(policyData);
    await policyRequest.save();

    // Create dual assignment automatically for submitted policies
    try {
      const DualAssignment = require('../models/DualAssignment');

      // Check if dual assignment already exists
      const existingDualAssignment = await DualAssignment.findOne({ policyId: policyRequest._id });

      if (!existingDualAssignment) {
        // Calculate deadline (7 days from now)
        const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const dualAssignment = new DualAssignment({
          policyId: policyRequest._id,
          priority: policyData.priority || 'medium',
          estimatedCompletion: {
            overallDeadline: deadline,
            ammcDeadline: deadline,
            niaDeadline: deadline
          }
        });

        // Add creation timeline event
        dualAssignment.timeline.push({
          event: 'created',
          timestamp: new Date(),
          performedBy: userId,
          organization: 'SYSTEM',
          details: 'Dual assignment created automatically upon policy submission',
          metadata: {
            policyId: policyRequest._id,
            priority: policyData.priority || 'medium',
            deadline: deadline
          }
        });

        await dualAssignment.save();

        // Keep policy status as 'submitted' until admins manually assign surveyors
        // Do not change to 'assigned' automatically
        policyRequest.statusHistory.push({
          status: 'submitted',
          changedBy: userId,
          changedAt: new Date(),
          reason: 'Dual assignment created - awaiting admin assignment of surveyors'
        });
        await policyRequest.save();

        // Notify both AMMC and NIA admins about new policy requiring assignment
        try {
          const NotificationService = require('../services/NotificationService');
          await NotificationService.notifyAdminsOfNewPolicy(policyRequest, dualAssignment);
          console.log(`Admins notified of new policy ${policyRequest._id}`);
        } catch (notificationError) {
          console.error('Failed to notify admins:', notificationError);
          // Don't fail the process if notification fails
        }

        console.log(`Dual assignment created for policy ${policyRequest._id}`);
      }
    } catch (dualAssignmentError) {
      console.error('Failed to create dual assignment:', dualAssignmentError);
      // Don't fail the policy creation if dual assignment fails
    }

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Policy request created successfully and dual assignment initiated',
      data: policyRequest
    });
  } catch (error) {
    console.error('Create policy request error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to create policy request',
      error: error.message
    });
  }
};

// Get all policy requests (for admin)
const getAllPolicyRequests = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 10, search } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (priority && priority !== 'all') {
      query.priority = priority;
    }
    if (search) {
      query.$or = [
        { 'contactDetails.fullName': { $regex: search, $options: 'i' } },
        { 'contactDetails.email': { $regex: search, $options: 'i' } },
        { 'contactDetails.rcNumber': { $regex: search, $options: 'i' } },
        { 'propertyDetails.address': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const policyRequests = await PolicyRequest.find(query)
      .populate('assignedSurveyors', 'firstname lastname email')
      .sort({ createdAt: -1, priority: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PolicyRequest.countDocuments(query);

    // Get summary statistics
    const statusStats = await PolicyRequest.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const priorityStats = await PolicyRequest.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        policyRequests,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: policyRequests.length,
          totalRecords: total
        },
        statistics: {
          statusBreakdown: statusStats,
          priorityBreakdown: priorityStats
        }
      }
    });
  } catch (error) {
    console.error('Get all policy requests error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get policy requests',
      error: error.message
    });
  }
};

// Get policy request by ID
const getPolicyRequestById = async (req, res) => {
  try {
    const { ammcId } = req.params;

    const policyRequest = await PolicyRequest.findById(ammcId)
      .populate('assignedSurveyors', 'firstname lastname email phonenumber')
      .populate('statusHistory.changedBy', 'firstname lastname');

    if (!policyRequest) {
      throw new NotFoundError('AMMC request not found');
    }

    // Get associated assignments and submissions
    const assignments = await Assignment.find({ ammcId })
      .populate('surveyorId', 'firstname lastname email')
      .sort({ assignedAt: -1 });

    const submissions = await SurveySubmission.find({ ammcId })
      .populate('surveyorId', 'firstname lastname')
      .sort({ submissionTime: -1 });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        policyRequest,
        assignments,
        submissions
      }
    });
  } catch (error) {
    console.error('Get policy request by ID error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get policy request',
      error: error.message
    });
  }
};

// Update policy request
const updatePolicyRequest = async (req, res) => {
  try {
    const { ammcId } = req.params;
    const updates = req.body;
    const { userId } = req.user;

    const policyRequest = await PolicyRequest.findById(ammcId);
    if (!policyRequest) {
      throw new NotFoundError('AMMC request not found');
    }

    // Track status changes
    const oldStatus = policyRequest.status;

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== 'statusHistory') {
        policyRequest[key] = updates[key];
      }
    });

    // Add status history entry if status changed
    if (updates.status && updates.status !== oldStatus) {
      policyRequest.statusHistory.push({
        status: updates.status,
        changedBy: userId,
        changedAt: new Date(),
        reason: updates.statusReason || 'Status updated by admin'
      });
    }

    await policyRequest.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Policy request updated successfully',
      data: policyRequest
    });
  } catch (error) {
    console.error('Update policy request error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to update policy request',
      error: error.message
    });
  }
};

// Assign surveyor to policy
const assignSurveyor = async (req, res) => {
  try {
    const { ammcId } = req.params;
    const { surveyorIds, deadline, priority, instructions, specialRequirements, organization = 'AMMC' } = req.body;
    const adminId = req.user.userId;

    const policyRequest = await PolicyRequest.findById(ammcId);
    if (!policyRequest) {
      throw new NotFoundError('Policy request not found');
    }

    // Check if this is a dual assignment system policy
    const DualAssignment = require('../models/DualAssignment');
    let dualAssignment = await DualAssignment.findOne({ policyId: ammcId });

    // If no dual assignment exists, create one
    if (!dualAssignment) {
      const assignmentDeadline = deadline ? new Date(deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      dualAssignment = new DualAssignment({
        policyId: ammcId,
        priority: priority || policyRequest.priority || 'medium',
        estimatedCompletion: {
          overallDeadline: assignmentDeadline,
          ammcDeadline: assignmentDeadline,
          niaDeadline: assignmentDeadline
        }
      });

      dualAssignment.timeline.push({
        event: 'created',
        timestamp: new Date(),
        performedBy: adminId,
        organization: 'AMMC',
        details: 'Dual assignment created during AMMC surveyor assignment',
        metadata: {
          policyId: ammcId,
          priority: priority || policyRequest.priority || 'medium',
          deadline: assignmentDeadline
        }
      });

      await dualAssignment.save();
    }

    // Validate surveyors exist and are available for the specified organization
    const surveyors = await Surveyor.find({
      userId: { $in: surveyorIds },
      organization: organization,
      status: 'active',
      'profile.availability': 'available'
    }).populate('userId', 'firstname lastname email phonenumber');

    if (surveyors.length !== surveyorIds.length) {
      throw new BadRequestError(`Some ${organization} surveyors are not available or do not exist`);
    }

    // For dual assignment system, only assign one surveyor per organization
    if (surveyorIds.length > 1) {
      throw new BadRequestError(`Only one ${organization} surveyor can be assigned per policy in dual assignment system`);
    }

    const surveyorId = surveyorIds[0];
    const surveyor = surveyors[0];

    // Check if surveyor already assigned for this organization
    if (organization === 'AMMC' && dualAssignment.ammcAssignmentId) {
      throw new BadRequestError('AMMC surveyor already assigned to this policy');
    }
    if (organization === 'NIA' && dualAssignment.niaAssignmentId) {
      throw new BadRequestError('NIA surveyor already assigned to this policy');
    }

    // Get complete surveyor contact information
    const AssignmentContactService = require('../services/AssignmentContactService');
    const surveyorContactInfo = await AssignmentContactService.getSurveyorContactInfo(surveyorId, organization);

    // Create assignment
    const assignment = new Assignment({
      ammcId,
      surveyorId,
      assignedBy: adminId,
      deadline: deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      priority: priority || policyRequest.priority || 'medium',
      instructions: instructions || '',
      organization: organization,
      dualAssignmentId: dualAssignment._id,
      specialRequirements: specialRequirements || [],
      partnerSurveyorContact: surveyorContactInfo,
      location: {
        address: policyRequest.propertyDetails.address,
        contactPerson: {
          name: policyRequest.contactDetails.fullName,
          phone: policyRequest.contactDetails.phoneNumber,
          email: policyRequest.contactDetails.email,
          rcNumber: policyRequest.contactDetails.rcNumber
        }
      }
    });

    await assignment.save();

    // Update dual assignment with surveyor contact details
    const updatedDualAssignment = await AssignmentContactService.updateDualAssignmentContacts(
      dualAssignment._id,
      organization,
      surveyorId,
      assignment._id,
      adminId
    );

    // Update policy request status
    if (!policyRequest.assignedSurveyors) {
      policyRequest.assignedSurveyors = [];
    }
    if (!policyRequest.assignedSurveyors.includes(surveyorId)) {
      policyRequest.assignedSurveyors.push(surveyorId);
    }

    policyRequest.status = 'assigned';
    policyRequest.statusHistory.push({
      status: 'assigned',
      changedBy: adminId,
      changedAt: new Date(),
      reason: `${organization} surveyor assigned: ${surveyor.userId.firstname} ${surveyor.userId.lastname}`
    });

    await policyRequest.save();

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: `${organization} surveyor assigned successfully`,
      data: {
        policyRequest,
        assignment,
        dualAssignment: updatedDualAssignment,
        bothAssigned: updatedDualAssignment.isBothAssigned()
      }
    });
  } catch (error) {
    console.error('Assign surveyor error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to assign surveyors',
      error: error.message
    });
  }
};

// Get available surveyors
const getAvailableSurveyors = async (req, res) => {
  try {
    const { specialization, location, limit = 20 } = req.query;

    const query = {
      status: 'active',
      'profile.availability': 'available'
    };

    if (specialization) {
      query['profile.specialization'] = specialization;
    }

    if (location) {
      query['profile.location.state'] = { $regex: location, $options: 'i' };
    }

    const surveyors = await Surveyor.find(query)
      .populate('userId', 'firstname lastname email phonenumber')
      .sort({ 'statistics.averageRating': -1, 'statistics.completedSurveys': -1 })
      .limit(parseInt(limit));

    res.status(StatusCodes.OK).json({
      success: true,
      data: surveyors
    });
  } catch (error) {
    console.error('Get available surveyors error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get available surveyors',
      error: error.message
    });
  }
};

// Review survey submission
const reviewSurveySubmission = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { decision, reviewNotes, qualityCheck } = req.body;
    const reviewerId = req.user.userId;

    const submission = await SurveySubmission.findById(submissionId)
      .populate('ammcId');

    if (!submission) {
      throw new NotFoundError('Survey submission not found');
    }

    console.log('Before update:', submission);

    // Update submission
    submission.status = decision === 'approved' ? 'approved' : 'revision_required';
    submission.reviewedBy = reviewerId;
    submission.reviewedAt = new Date();
    submission.reviewNotes = reviewNotes;

    console.log('After update:', submission);


    if (qualityCheck) {
      submission.qualityCheck = {
        ...submission.qualityCheck,
        ...qualityCheck,
        reviewedBy: reviewerId,
        reviewedAt: new Date()
      };
    }

    await submission.save();

    // Update policy request status based on decision
    const policyRequest = submission.ammcId;
    if (decision === 'approved') {
      policyRequest.status = 'approved';
      policyRequest.adminNotes = reviewNotes;
    } else if (decision === 'rejected') {
      policyRequest.status = 'rejected';
      policyRequest.adminNotes = reviewNotes;
    } else {
      policyRequest.status = 'requires_more_info'; // Requires more information
      policyRequest.adminNotes = reviewNotes;
      submission.revisionHistory.push({
        version: submission.revisionHistory.length + 1,
        changes: reviewNotes,
        revisedBy: reviewerId,
        revisedAt: new Date()
      });
    }

    policyRequest.statusHistory.push({
      status: policyRequest.status,
      changedBy: reviewerId,
      changedAt: new Date(),
      reason: `Survey ${decision}: ${reviewNotes}`
    });

    await policyRequest.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Survey ${decision} successfully`,
      data: {
        submission,
        policyRequest
      }
    });
  } catch (error) {
    console.error('Review survey submission error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to review survey submission',
      error: error.message
    });
  }
};

const sendPolicyToUser = async (req, res) => {
  try {
    const { ammcId } = req.params;
    const { userId } = req.user;

    const policyRequest = await PolicyRequest.findById(ammcId);
    if (!policyRequest) {
      throw new NotFoundError('AMMC request not found');
    }

    if (policyRequest.status !== 'approved') {
      throw new BadRequestError('Policy must be approved before sending to the user.');
    }

    policyRequest.status = 'sent_to_user';
    policyRequest.statusHistory.push({
      status: 'sent_to_user',
      changedBy: userId,
      changedAt: new Date(),
      reason: 'Policy sent to user by admin'
    });

    await policyRequest.save();

    // TODO: Send email to user with link to download documents

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Policy sent to user successfully',
      data: policyRequest
    });
  } catch (error) {
    console.error('Send policy to user error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to send policy to user',
      error: error.message
    });
  }
};

// Get user's policy requests
const getUserPolicyRequests = async (req, res) => {
  try {
    const { userId, model, role } = req.user;
    const { status, page = 1, limit = 10 } = req.query;

    console.log('getUserPolicyRequests - User info:', { userId, model, role });

    let query = {};

    // If it's a regular user, filter by their userId
    // If it's an admin, they can see all policies or specify a userId in query params
    if (model === 'User') {
      query.userId = userId;
      console.log('Filtering policies for User with userId:', userId);
    } else if (model === 'Employee' && ['Admin', 'Super-admin'].includes(role)) {
      // Admins can optionally filter by userId, otherwise see all
      if (req.query.userId) {
        query.userId = req.query.userId;
        console.log('Admin filtering by specific userId:', req.query.userId);
      } else {
        console.log('Admin viewing all policies (no userId filter)');
      }
      // If no userId specified, admins see all policies (no userId filter)
    } else {
      query.userId = userId; // Fallback to user's own policies
      console.log('Fallback: filtering by userId:', userId);
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    console.log('Final query for policies:', query);

    const policyRequests = await PolicyRequest.find(query)
      .populate('assignedSurveyors', 'firstname lastname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PolicyRequest.countDocuments(query);

    console.log(`Found ${policyRequests.length} policies for user, total: ${total}`);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        policyRequests,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          count: policyRequests.length,
          totalRecords: total
        }
      }
    });
  } catch (error) {
    console.error('Get user policy requests error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get policy requests',
      error: error.message
    });
  }
};

// Delete policy request (for admin and user)
const deletePolicyRequest = async (req, res) => {
  try {
    const { ammcId } = req.params;
    const { userId, role } = req.user;

    const policyRequest = await PolicyRequest.findById(ammcId);
    if (!policyRequest) {
      throw new NotFoundError('AMMC request not found');
    }

    // Check permissions - users can only delete their own policies
    if (role === 'User' && policyRequest.userId !== userId) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You can only delete your own policy requests'
      });
    }

    // Check if policy can be deleted based on status
    const undeletableStatuses = ['approved', 'completed', 'sent_to_user'];
    if (undeletableStatuses.includes(policyRequest.status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Cannot delete policy request with status: ${policyRequest.status}`
      });
    }

    // Delete related assignments and submissions
    await Assignment.deleteMany({ ammcId });
    await SurveySubmission.deleteMany({ ammcId });

    // Delete the policy request
    await PolicyRequest.findByIdAndDelete(ammcId);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Policy request deleted successfully'
    });
  } catch (error) {
    console.error('Delete policy request error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to delete policy request',
      error: error.message
    });
  }
};

// Search user's policies (for autocomplete in claim submission)
const searchPolicies = async (req, res) => {
  try {
    const { userId, query } = req.query;

    // Verify user can only search their own policies (unless admin)
    if (req.user.model === 'User' && req.user.userId.toString() !== userId) {
      throw new BadRequestError('You can only search your own policies');
    }

    if (!userId || !query) {
      throw new BadRequestError('userId and query parameters are required');
    }

    const policies = await searchUserPolicies(userId, query);

    res.status(StatusCodes.OK).json({
      success: true,
      count: policies.length,
      policies
    });
  } catch (error) {
    console.error('Search policies error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to search policies',
      error: error.message
    });
  }
};

// Validate policy number (for claim submission)
const validatePolicyNumber = async (req, res) => {
  try {
    const { policyNumber } = req.params;
    const userId = req.query.userId || req.user.userId;

    // Verify user can only validate their own policies (unless admin)
    if (req.user.model === 'User' && req.user.userId.toString() !== userId) {
      throw new BadRequestError('You can only validate your own policies');
    }

    const result = await validatePolicy(policyNumber, userId);

    if (!result.isValid) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        error: result.error
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      policy: result.policy
    });
  } catch (error) {
    console.error('Validate policy error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to validate policy',
      error: error.message
    });
  }
};

module.exports = {
  createPolicyRequest,
  getAllPolicyRequests,
  getPolicyRequestById,
  updatePolicyRequest,
  assignSurveyor,
  getAvailableSurveyors,
  reviewSurveySubmission,
  getUserPolicyRequests,
  sendPolicyToUser,
  deletePolicyRequest,
  searchPolicies,
  validatePolicyNumber
};
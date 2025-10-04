const { StatusCodes } = require('http-status-codes');
const PolicyRequest = require('../models/PolicyRequest');
const Assignment = require('../models/Assignment');
const SurveySubmission = require('../models/SurveySubmission');
const Surveyor = require('../models/Surveyor');
const { BadRequestError, NotFoundError } = require('../errors');

// Create policy request (for users)
const createPolicyRequest = async (req, res) => {
  try {
    const { userId } = req.user;
    const policyData = { ...req.body, userId };
    
    const policyRequest = new PolicyRequest(policyData);
    await policyRequest.save();
    
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Policy request created successfully',
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
    const { policyId } = req.params;
    
    const policyRequest = await PolicyRequest.findById(policyId)
      .populate('assignedSurveyors', 'firstname lastname email phonenumber')
      .populate('statusHistory.changedBy', 'firstname lastname');
    
    if (!policyRequest) {
      throw new NotFoundError('Policy request not found');
    }
    
    // Get associated assignments and submissions
    const assignments = await Assignment.find({ policyId })
      .populate('surveyorId', 'firstname lastname email')
      .sort({ assignedAt: -1 });
    
    const submissions = await SurveySubmission.find({ policyId })
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
    const { policyId } = req.params;
    const updates = req.body;
    const { userId } = req.user;
    
    const policyRequest = await PolicyRequest.findById(policyId);
    if (!policyRequest) {
      throw new NotFoundError('Policy request not found');
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
    const { policyId } = req.params;
    const { surveyorIds, deadline, priority, instructions, specialRequirements } = req.body;
    const adminId = req.user.userId;
    
    const policyRequest = await PolicyRequest.findById(policyId);
    if (!policyRequest) {
      throw new NotFoundError('Policy request not found');
    }
    
    // Validate surveyors exist and are available
    const surveyors = await Surveyor.find({
      userId: { $in: surveyorIds },
      status: 'active',
      'profile.availability': 'available'
    });
    
    if (surveyors.length !== surveyorIds.length) {
      throw new BadRequestError('Some surveyors are not available or do not exist');
    }
    
    // Create assignments
    const assignments = [];
    for (const surveyorId of surveyorIds) {
      const assignment = new Assignment({
        policyId,
        surveyorId,
        assignedBy: adminId,
        deadline: deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
        priority: priority || policyRequest.priority,
        instructions: instructions || '',
        specialRequirements: specialRequirements || [],
        location: {
          address: policyRequest.propertyDetails.address,
          contactPerson: {
            name: policyRequest.contactDetails.fullName,
            phone: policyRequest.contactDetails.phoneNumber,
            email: policyRequest.contactDetails.email
          }
        }
      });
      
      await assignment.save();
      assignments.push(assignment);
    }
    
    // Update policy request
    policyRequest.assignedSurveyors = surveyorIds;
    policyRequest.status = 'assigned';
    policyRequest.statusHistory.push({
      status: 'assigned',
      changedBy: adminId,
      changedAt: new Date(),
      reason: `Assigned to ${surveyorIds.length} surveyor(s)`
    });
    
    await policyRequest.save();
    
    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Surveyors assigned successfully',
      data: {
        policyRequest,
        assignments
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
      .populate('policyId');
    
    if (!submission) {
      throw new NotFoundError('Survey submission not found');
    }
    
    // Update submission
    submission.status = decision === 'approved' ? 'approved' : 'revision_required';
    submission.reviewedBy = reviewerId;
    submission.reviewedAt = new Date();
    submission.reviewNotes = reviewNotes;
    
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
    const policyRequest = submission.policyId;
    if (decision === 'approved') {
      policyRequest.status = 'approved';
      policyRequest.adminNotes = reviewNotes;
    } else {
      policyRequest.status = 'assigned'; // Back to assigned for revision
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

// Get user's policy requests
const getUserPolicyRequests = async (req, res) => {
  try {
    const { userId } = req.user;
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { userId: userId };
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;
    
    const policyRequests = await PolicyRequest.find(query)
      .populate('assignedSurveyors', 'firstname lastname')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await PolicyRequest.countDocuments(query);
    
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

module.exports = {
  createPolicyRequest,
  getAllPolicyRequests,
  getPolicyRequestById,
  updatePolicyRequest,
  assignSurveyor,
  getAvailableSurveyors,
  reviewSurveySubmission,
  getUserPolicyRequests
};
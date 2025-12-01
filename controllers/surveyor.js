const { StatusCodes } = require('http-status-codes');
const Surveyor = require('../models/Surveyor');
const Assignment = require('../models/Assignment');
const SurveySubmission = require('../models/SurveySubmission');
const PolicyRequest = require('../models/PolicyRequest');
const DualAssignment = require('../models/DualAssignment');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');

// Get surveyor dashboard data
const getSurveyorDashboard = async (req, res) => {
  try {
    console.log('Dashboard - req.user:', req.user);
    const surveyorUserId = req.user.userId;
    console.log('Dashboard - surveyorUserId:', surveyorUserId);

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

    // Get dual assignments count and recent ones
    const dualAssignmentIds = assignments
      .filter(a => a.dualAssignmentId)
      .map(a => a.dualAssignmentId);

    let dualAssignments = [];
    let dualAssignmentStats = {
      total: 0,
      conflicts: 0
    };

    if (dualAssignmentIds.length > 0) {
      dualAssignments = await DualAssignment.find({
        _id: { $in: dualAssignmentIds }
      })
        .populate('policyId', 'propertyDetails contactDetails')
        .sort({ createdAt: -1 })
        .limit(5);

      // Count conflicts
      const conflictsCount = await DualAssignment.countDocuments({
        _id: { $in: dualAssignmentIds },
        'timeline.event': 'conflict_detected'
      });

      dualAssignmentStats = {
        total: dualAssignments.length,
        conflicts: conflictsCount
      };
    }

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
        overdue: overdueAssignments,
        dualAssignments: dualAssignmentStats.total,
        conflictsDetected: dualAssignmentStats.conflicts
      },
      recentAssignments: assignments,
      recentSubmissions,
      recentDualAssignments: dualAssignments
    };

    res.status(StatusCodes.OK).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Get surveyor dashboard error:', error);
    console.error('Error stack:', error.stack);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get dashboard data',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get surveyor assignments
const getSurveyorAssignments = async (req, res) => {
  try {
    const surveyorUserId = req.user.userId;
    const { status, priority, page = 1, limit = 10 } = req.query;

    console.log('📋 ========== GET SURVEYOR ASSIGNMENTS ==========');
    console.log('📋 User ID:', surveyorUserId);
    console.log('📋 User organization:', req.user.organization);
    console.log('📋 User tokenType:', req.user.tokenType);
    console.log('📋 User role:', req.user.role);
    console.log('📋 Filters - Status:', status, 'Priority:', priority);
    console.log('📋 Surveyor object:', req.surveyor ? 'Present' : 'Missing');

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

    console.log('📋 Query:', JSON.stringify(query));

    const skip = (page - 1) * limit;

    const assignments = await Assignment.find(query)
      .populate('ammcId', 'propertyDetails contactDetails requestDetails status priority deadline')
      .populate('assignedBy', 'firstname lastname email')
      .sort({ assignedAt: -1, deadline: 1, priority: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Assignment.countDocuments(query);

    console.log('📋 Found assignments:', assignments.length, 'Total:', total);

    // If no assignments found, check if any assignments exist at all
    if (assignments.length === 0) {
      const allAssignments = await Assignment.countDocuments({});
      console.log('📋 Total assignments in database:', allAssignments);

      // Check if there are assignments for this organization
      const orgAssignments = await Assignment.countDocuments({ organization: req.user.organization });
      console.log(`📋 Total ${req.user.organization} assignments:`, orgAssignments);
    }

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
    console.error('❌ Get surveyor assignments error:', error);
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

    // If this is a dual assignment, get the dual assignment info with full contact details
    let dualAssignmentInfo = null;
    if (assignment.dualAssignmentId) {
      const dualAssignment = await DualAssignment.findById(assignment.dualAssignmentId)
        .populate('policyId', 'propertyDetails contactDetails');

      if (dualAssignment) {
        // Get the other surveyor's contact information
        const currentSurveyorOrganization = assignment.organization || req.user.organization || 'AMMC';
        const otherSurveyorContact = currentSurveyorOrganization === 'AMMC'
          ? dualAssignment.niaSurveyorContact
          : dualAssignment.ammcSurveyorContact;

        dualAssignmentInfo = {
          _id: dualAssignment._id,
          assignmentStatus: dualAssignment.assignmentStatus,
          completionStatus: dualAssignment.completionStatus,
          otherSurveyor: otherSurveyorContact ? {
            surveyorId: otherSurveyorContact.surveyorId,
            name: otherSurveyorContact.name,
            email: otherSurveyorContact.email,
            phone: otherSurveyorContact.phone,
            licenseNumber: otherSurveyorContact.licenseNumber,
            address: otherSurveyorContact.address,
            emergencyContact: otherSurveyorContact.emergencyContact,
            specialization: otherSurveyorContact.specialization,
            experience: otherSurveyorContact.experience,
            rating: otherSurveyorContact.rating,
            assignedAt: otherSurveyorContact.assignedAt,
            organization: currentSurveyorOrganization === 'AMMC' ? 'NIA' : 'AMMC'
          } : null,
          timeline: dualAssignment.timeline,
          priority: dualAssignment.priority
        };
      }
    }

    // Add dual assignment info to the response
    const responseData = {
      ...assignment.toObject(),
      dualAssignmentInfo
    };

    res.status(StatusCodes.OK).json({
      success: true,
      data: responseData
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
    }).populate('surveyorId', 'firstname lastname email phonenumber');

    if (!assignment) {
      throw new NotFoundError('Assignment not found or not in progress');
    }

    // Get surveyor organization from assignment or user context
    const surveyorOrganization = assignment.organization || req.user.organization || 'AMMC';

    // --- Start New File Handling Logic ---
    let documents = [];
    let surveyDocumentUrl = '';
    const { uploadToCloudinary } = require('../utils/cloudinary');

    if (req.files && req.files.documents && req.files.documents.length > 0) {
      const folder = assignmentId
        ? `survey-documents/${assignmentId}`
        : `survey-documents/${ammcId || 'general'}`;

      for (const file of req.files.documents) {
        try {
          const uploadResult = await uploadToCloudinary(
            file.buffer,
            file.originalname,
            folder
          );

          const documentData = {
            fileName: file.originalname,
            fileType: file.mimetype,
            fileSize: file.size,
            cloudinaryUrl: uploadResult.url,
            cloudinaryPublicId: uploadResult.publicId,
            category: 'survey_report', // Or derive from request if available
            documentType: 'supporting_document', // Default type
            uploadedBy: surveyorUserId,
            uploadedAt: new Date(),
            isMainReport: documents.length === 0, // First document is the main one
          };

          documents.push(documentData);

        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          // Decide if you want to stop or continue if one file fails
          throw new BadRequestError(`Failed to upload file ${file.originalname}: ${uploadError.message}`);
        }
      }

      if (documents.length > 0) {
        // Set the legacy surveyDocumentUrl from the first uploaded document
        surveyDocumentUrl = documents[0].cloudinaryUrl;
        // Mark the first document as the main report
        documents[0].documentType = 'main_report';
      }
    }
    // --- End New File Handling Logic ---

    // Validate required survey details
    if (!surveyDetails.propertyCondition || !surveyDetails.propertyCondition.trim()) {
      throw new BadRequestError('Property condition assessment is required');
    }
    if (!surveyDetails.structuralAssessment || !surveyDetails.structuralAssessment.trim()) {
      throw new BadRequestError('Structural assessment is required');
    }
    if (!surveyDetails.riskFactors || !surveyDetails.riskFactors.trim()) {
      throw new BadRequestError('Risk factors assessment is required');
    }
    if (!surveyDetails.recommendations || !surveyDetails.recommendations.trim()) {
      throw new BadRequestError('Recommendations are required');
    }

    // Create survey submission with organization identification
    const submission = new SurveySubmission({
      ammcId,
      surveyorId: surveyorUserId,
      assignmentId,
      surveyDetails,
      documents: documents, // New format - array of documents
      surveyDocument: surveyDocumentUrl ? {
        url: surveyDocumentUrl,
        publicId: documents.length > 0 ? documents[0].cloudinaryPublicId : null,
        name: documents.length > 0 ? documents[0].fileName : 'survey-document.pdf'
      } : '', // Legacy format for backward compatibility
      surveyNotes,
      contactLog: contactLog || [],
      recommendedAction,
      organization: surveyorOrganization,
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

    // Handle dual-surveyor workflow
    let dualAssignmentUpdate = null;
    let otherSurveyorNotification = null;

    try {
      if (assignment.dualAssignmentId) {
        console.log('Processing dual assignment:', assignment.dualAssignmentId);
        const DualAssignment = require('../models/DualAssignment');
        const dualAssignment = await DualAssignment.findById(assignment.dualAssignmentId);

        if (dualAssignment) {
          console.log('Found dual assignment, updating progress...');
          // Update dual assignment progress
          dualAssignment.reportSubmitted(surveyorOrganization, submission._id, surveyorUserId);
          await dualAssignment.save();

          dualAssignmentUpdate = {
            completionStatus: dualAssignment.completionStatus,
            assignmentStatus: dualAssignment.assignmentStatus,
            isDualSurveyor: true
          };

          console.log('Dual assignment updated:', dualAssignmentUpdate);

          // Get other surveyor's contact information for notification
          const otherOrganization = surveyorOrganization === 'AMMC' ? 'NIA' : 'AMMC';
          const otherSurveyorContact = surveyorOrganization === 'AMMC'
            ? dualAssignment.niaSurveyorContact
            : dualAssignment.ammcSurveyorContact;

          // Send notification to other surveyor
          if (otherSurveyorContact) {
            const DualSurveyorNotificationService = require('../services/DualSurveyorNotificationService');
            try {
              const notificationService = new DualSurveyorNotificationService();
              const notificationResult = await notificationService.notifyOtherSurveyor(
                dualAssignment._id,
                surveyorOrganization,
                {
                  submissionId: submission._id,
                  recommendedAction,
                  submittedAt: new Date()
                }
              );

              otherSurveyorNotification = notificationResult;
              console.log('Other surveyor notified successfully');
            } catch (notificationError) {
              console.error('Failed to send notification to other surveyor:', notificationError);
              // Don't fail the submission if notification fails
              otherSurveyorNotification = {
                success: false,
                error: notificationError.message
              };
            }
          }

          // Check if both reports are submitted and trigger automatic merging
          if (dualAssignment.isBothReportsSubmitted()) {
            console.log('Both reports submitted, triggering automatic merging...');
            // Trigger automatic report merging process
            const AutoReportMerger = require('../services/AutoReportMerger');
            try {
              await AutoReportMerger.triggerMerging(dualAssignment.policyId, {
                ammcReportId: surveyorOrganization === 'AMMC' ? submission._id : null,
                niaReportId: surveyorOrganization === 'NIA' ? submission._id : null,
                dualAssignmentId: dualAssignment._id
              });
              console.log('Automatic merging triggered successfully');
            } catch (mergingError) {
              console.error('Failed to trigger automatic report merging:', mergingError);
              // Don't fail the submission if merging fails
            }
          }
        } else {
          console.log('Dual assignment not found:', assignment.dualAssignmentId);
        }
      }
    } catch (dualAssignmentError) {
      console.error('Error processing dual assignment workflow:', dualAssignmentError);
      // Don't fail the submission if dual assignment processing fails
      dualAssignmentUpdate = {
        completionStatus: 0,
        assignmentStatus: 'error',
        isDualSurveyor: true,
        error: dualAssignmentError.message
      };
    }

    // Update policy request status with dual-surveyor context
    const policyUpdateData = {
      surveyDocument: surveyDocumentUrl || (documents.length > 0 ? documents[0].cloudinaryUrl : ''),
      surveyNotes
    };

    // Set status based on dual-surveyor context
    if (dualAssignmentUpdate && dualAssignmentUpdate.completionStatus === 100) {
      policyUpdateData.status = 'surveyed'; // Both reports submitted
    } else if (dualAssignmentUpdate && dualAssignmentUpdate.completionStatus === 50) {
      policyUpdateData.status = 'partially_surveyed'; // One report submitted
    } else {
      policyUpdateData.status = 'surveyed'; // Single surveyor or fallback
    }

    await PolicyRequest.findByIdAndUpdate(ammcId, policyUpdateData);

    // Fetch the submission again to ensure all fields are included in response
    const savedSubmission = await SurveySubmission.findById(submission._id)
      .populate('ammcId', 'policyNumber contactDetails')
      .populate('assignmentId', 'deadline priority')
      .select('+documents'); // Explicitly select documents to ensure it's returned

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Survey submitted successfully',
      data: {
        submission: savedSubmission, // Use the fetched submission to ensure documents are included
        dualAssignmentInfo: dualAssignmentUpdate,
        otherSurveyorNotified: !!otherSurveyorNotification,
        organization: surveyorOrganization
      }
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

// Get surveyor's dual assignments
const getSurveyorDualAssignments = async (req, res) => {
  try {
    const surveyorUserId = req.user.userId;
    const { status, page = 1, limit = 10 } = req.query;

    console.log('📋 Get Surveyor Dual Assignments - Surveyor:', surveyorUserId);
    console.log('📋 User organization from req.user:', req.user.organization);

    // Get surveyor info to determine organization
    const surveyor = await Surveyor.findOne({ userId: surveyorUserId });
    const surveyorOrganization = surveyor?.organization || req.user.organization || 'AMMC';

    console.log('📋 Determined surveyor organization:', surveyorOrganization);

    // Find assignments for this surveyor that have dual assignment IDs
    const surveyorAssignments = await Assignment.find({
      surveyorId: surveyorUserId,
      dualAssignmentId: { $exists: true, $ne: null }
    }).select('dualAssignmentId organization');

    console.log('📋 Found surveyor assignments with dual assignment IDs:', surveyorAssignments.length);

    // Log assignment details for debugging
    surveyorAssignments.forEach((assignment, index) => {
      console.log(`📋 Assignment ${index + 1}: ID=${assignment._id}, DualID=${assignment.dualAssignmentId}, Org=${assignment.organization}`);
    });

    if (surveyorAssignments.length === 0) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: {
          dualAssignments: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    }

    // Get the dual assignment IDs
    const dualAssignmentIds = surveyorAssignments.map(a => a.dualAssignmentId);

    // Build filter for dual assignments
    const filter = {
      _id: { $in: dualAssignmentIds }
    };

    // Apply status filter if provided
    if (status && status !== 'all') {
      if (status === 'active') {
        filter.completionStatus = { $lt: 100 };
      } else if (status === 'completed') {
        filter.completionStatus = 100;
      } else if (status === 'conflicts') {
        // Look for conflicts in timeline
        filter['timeline.event'] = 'conflict_detected';
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch dual assignments with populated data
    const dualAssignments = await DualAssignment.find(filter)
      .populate('policyId', 'propertyDetails contactDetails status priority')
      .populate('ammcAssignmentId', 'status deadline priority surveyorId')
      .populate('niaAssignmentId', 'status deadline priority surveyorId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    console.log('📋 Found dual assignments:', dualAssignments.length);

    // Enhance dual assignments with surveyor context
    const enhancedDualAssignments = dualAssignments.map(dualAssignment => {
      // Determine current surveyor's organization
      const surveyorAssignment = surveyorAssignments.find(
        a => a.dualAssignmentId.toString() === dualAssignment._id.toString()
      );
      const currentSurveyorOrg = surveyorAssignment?.organization || surveyorOrganization;

      // Get partner surveyor info
      const partnerSurveyorContact = currentSurveyorOrg === 'AMMC'
        ? dualAssignment.niaSurveyorContact
        : dualAssignment.ammcSurveyorContact;

      // Check for conflicts
      const conflictDetected = dualAssignment.timeline.some(
        event => event.event === 'conflict_detected'
      );

      return {
        ...dualAssignment.toObject(),
        currentSurveyorOrganization: currentSurveyorOrg,
        partnerSurveyor: partnerSurveyorContact,
        conflictDetected,
        // Add convenience fields for frontend
        policyDetails: {
          propertyType: dualAssignment.policyId?.propertyDetails?.propertyType || 'Unknown',
          address: dualAssignment.policyId?.propertyDetails?.address || 'Address not available',
          buildingValue: dualAssignment.policyId?.propertyDetails?.buildingValue || 0
        },
        currentSurveyorInfo: {
          assignmentId: currentSurveyorOrg === 'AMMC' ? dualAssignment.ammcAssignmentId : dualAssignment.niaAssignmentId,
          contact: currentSurveyorOrg === 'AMMC' ? dualAssignment.ammcSurveyorContact : dualAssignment.niaSurveyorContact
        },
        partnerSurveyorInfo: {
          assignmentId: currentSurveyorOrg === 'AMMC' ? dualAssignment.niaAssignmentId : dualAssignment.ammcAssignmentId,
          contact: partnerSurveyorContact,
          organization: currentSurveyorOrg === 'AMMC' ? 'NIA' : 'AMMC'
        }
      };
    });

    const total = await DualAssignment.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        dualAssignments: enhancedDualAssignments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Get surveyor dual assignments error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get dual assignments',
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
  updateSurveyorProfile,
  getSurveyorDualAssignments
};
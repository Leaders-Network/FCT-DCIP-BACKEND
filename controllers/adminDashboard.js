const { StatusCodes } = require('http-status-codes');
const PolicyRequest = require('../models/PolicyRequest');
const Assignment = require('../models/Assignment');
const SurveySubmission = require('../models/SurveySubmission');
const Surveyor = require('../models/Surveyor');
const Employee = require('../models/Employee');

// Get comprehensive dashboard data for admin
const getDashboardData = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    // Calculate date ranges
    const now = new Date();
    let startDate, previousPeriodStart;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousPeriodStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousPeriodStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousPeriodStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousPeriodStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }
    
    // Policy Request Metrics
    const [
      totalPolicies,
      previousPolicies,
      pendingPolicies,
      approvedPolicies,
      rejectedPolicies
    ] = await Promise.all([
      PolicyRequest.countDocuments({ createdAt: { $gte: startDate } }),
      PolicyRequest.countDocuments({ 
        createdAt: { $gte: previousPeriodStart, $lt: startDate } 
      }),
      PolicyRequest.countDocuments({ status: 'pending' }),
      PolicyRequest.countDocuments({ status: 'approved' }),
      PolicyRequest.countDocuments({ status: 'rejected' })
    ]);
    
    // Assignment Metrics
    const [
      totalAssignments,
      activeAssignments,
      completedAssignments,
      overdueAssignments
    ] = await Promise.all([
      Assignment.countDocuments({ assignedAt: { $gte: startDate } }),
      Assignment.countDocuments({ 
        status: { $in: ['assigned', 'in_progress'] } 
      }),
      Assignment.countDocuments({ 
        status: 'completed',
        assignedAt: { $gte: startDate }
      }),
      Assignment.countDocuments({
        status: { $in: ['assigned', 'in_progress'] },
        deadline: { $lt: now }
      })
    ]);
    
    // Surveyor Metrics
    const [
      totalSurveyors,
      activeSurveyors,
      availableSurveyors
    ] = await Promise.all([
      Surveyor.countDocuments({ status: 'active' }),
      Surveyor.countDocuments({ 
        status: 'active',
        'profile.availability': { $in: ['available', 'busy'] }
      }),
      Surveyor.countDocuments({ 
        status: 'active',
        'profile.availability': 'available'
      })
    ]);
    
    // Recent Activity - Policy Requests
    const recentPolicies = await PolicyRequest.find()
      .populate('assignedSurveyors', 'firstname lastname')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('policyNumber contactDetails status priority createdAt assignedSurveyors');
    
    // Recent Activity - Assignments
    const recentAssignments = await Assignment.find()
      .populate('policyId', 'policyNumber contactDetails')
      .populate('surveyorId', 'userid firstname lastname')
      .sort({ assignedAt: -1 })
      .limit(10)
      .select('policyId surveyorId status priority assignedAt deadline');
    
    // Recent Activity - Survey Submissions
    const recentSubmissions = await SurveySubmission.find()
      .populate('policyId', 'policyNumber contactDetails')
      .populate('surveyorId', 'userid firstname lastname')
      .sort({ submissionTime: -1 })
      .limit(5)
      .select('policyId surveyorId status submissionTime reviewedAt');
    
    // Performance Trends - Daily data for the period
    const dailyTrends = await PolicyRequest.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          newPolicies: { $sum: 1 },
          approvedPolicies: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);
    
    // Top Performing Surveyors
    const topSurveyors = await Assignment.aggregate([
      {
        $match: {
          assignedAt: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$surveyorId',
          completedAssignments: { $sum: 1 },
          avgCompletionTime: {
            $avg: { $subtract: ['$completedAt', '$assignedAt'] }
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
        $sort: { completedAssignments: -1 }
      },
      {
        $limit: 5
      }
    ]);
    
    // Status Distribution
    const statusDistribution = await PolicyRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          percentage: { $sum: 1 }
        }
      }
    ]);
    
    // Calculate total for percentage
    const totalPoliciesAll = await PolicyRequest.countDocuments();
    statusDistribution.forEach(item => {
      item.percentage = totalPoliciesAll > 0 ? (item.count / totalPoliciesAll) * 100 : 0;
    });
    
    // Priority Distribution
    const priorityDistribution = await PolicyRequest.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Calculate growth percentages
    const policyGrowth = previousPolicies > 0 
      ? ((totalPolicies - previousPolicies) / previousPolicies) * 100 
      : 0;
    
    const completionRate = totalAssignments > 0 
      ? (completedAssignments / totalAssignments) * 100 
      : 0;
    
    // System Health Indicators
    const systemHealth = {
      overdueRate: activeAssignments > 0 ? (overdueAssignments / activeAssignments) * 100 : 0,
      surveyorUtilization: totalSurveyors > 0 ? ((totalSurveyors - availableSurveyors) / totalSurveyors) * 100 : 0,
      avgProcessingTime: await calculateAvgProcessingTime(startDate)
    };
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        summary: {
          policies: {
            total: totalPolicies,
            pending: pendingPolicies,
            approved: approvedPolicies,
            rejected: rejectedPolicies,
            growth: policyGrowth
          },
          assignments: {
            total: totalAssignments,
            active: activeAssignments,
            completed: completedAssignments,
            overdue: overdueAssignments,
            completionRate
          },
          surveyors: {
            total: totalSurveyors,
            active: activeSurveyors,
            available: availableSurveyors
          }
        },
        recentActivity: {
          policies: recentPolicies,
          assignments: recentAssignments,
          submissions: recentSubmissions
        },
        analytics: {
          dailyTrends,
          topSurveyors,
          statusDistribution,
          priorityDistribution,
          systemHealth
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get dashboard data',
      error: error.message
    });
  }
};

// Helper function to calculate average processing time
const calculateAvgProcessingTime = async (startDate) => {
  try {
    const result = await PolicyRequest.aggregate([
      {
        $match: {
          status: 'approved',
          createdAt: { $gte: startDate }
        }
      },
      {
        $addFields: {
          processingTime: {
            $subtract: ['$updatedAt', '$createdAt']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$processingTime' }
        }
      }
    ]);
    
    return result[0]?.avgTime || 0;
  } catch (error) {
    console.error('Calculate avg processing time error:', error);
    return 0;
  }
};

// Get quick stats for dashboard widgets
const getQuickStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const [
      todayPolicies,
      weekPolicies,
      pendingAssignments,
      overdueAssignments,
      activeSubmissions
    ] = await Promise.all([
      PolicyRequest.countDocuments({ createdAt: { $gte: startOfDay } }),
      PolicyRequest.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Assignment.countDocuments({ status: 'assigned' }),
      Assignment.countDocuments({
        status: { $in: ['assigned', 'in_progress'] },
        deadline: { $lt: new Date() }
      }),
      SurveySubmission.countDocuments({ status: 'pending' })
    ]);
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        todayPolicies,
        weekPolicies,
        pendingAssignments,
        overdueAssignments,
        activeSubmissions
      }
    });
  } catch (error) {
    console.error('Get quick stats error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get quick stats',
      error: error.message
    });
  }
};

// Get alerts and notifications for admin
const getAdminAlerts = async (req, res) => {
  try {
    const now = new Date();
    const alerts = [];
    
    // Overdue assignments
    const overdueAssignments = await Assignment.find({
      status: { $in: ['assigned', 'in_progress'] },
      deadline: { $lt: now }
    })
    .populate('policyId', 'policyNumber')
    .populate('surveyorId', 'userid firstname lastname')
    .limit(10);
    
    overdueAssignments.forEach(assignment => {
      alerts.push({
        type: 'overdue_assignment',
        severity: 'high',
        title: 'Overdue Assignment',
        message: `Assignment for policy ${assignment.policyId.policyNumber} is overdue`,
        data: {
          assignmentId: assignment._id,
          policyNumber: assignment.policyId.policyNumber,
          surveyor: `${assignment.surveyorId.firstname} ${assignment.surveyorId.lastname}`,
          deadline: assignment.deadline
        },
        timestamp: assignment.deadline
      });
    });
    
    // Pending reviews
    const pendingReviews = await SurveySubmission.find({
      status: 'pending'
    })
    .populate('policyId', 'policyNumber')
    .populate('surveyorId', 'userid firstname lastname')
    .limit(5);
    
    pendingReviews.forEach(submission => {
      alerts.push({
        type: 'pending_review',
        severity: 'medium',
        title: 'Pending Survey Review',
        message: `Survey for policy ${submission.policyId.policyNumber} awaits review`,
        data: {
          submissionId: submission._id,
          policyNumber: submission.policyId.policyNumber,
          surveyor: `${submission.surveyorId.firstname} ${submission.surveyorId.lastname}`,
          submissionTime: submission.submissionTime
        },
        timestamp: submission.submissionTime
      });
    });
    
    // High priority unassigned policies
    const unassignedPolicies = await PolicyRequest.find({
      status: 'pending',
      priority: { $in: ['high', 'urgent'] }
    }).limit(5);
    
    unassignedPolicies.forEach(policy => {
      alerts.push({
        type: 'unassigned_policy',
        severity: 'high',
        title: 'Unassigned High Priority Policy',
        message: `High priority policy ${policy.policyNumber} needs assignment`,
        data: {
          policyId: policy._id,
          policyNumber: policy.policyNumber,
          priority: policy.priority,
          createdAt: policy.createdAt
        },
        timestamp: policy.createdAt
      });
    });
    
    // Sort alerts by severity and timestamp
    alerts.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[b.severity] - severityOrder[a.severity];
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        alerts: alerts.slice(0, 20), // Limit to 20 most important alerts
        summary: {
          total: alerts.length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length
        }
      }
    });
  } catch (error) {
    console.error('Get admin alerts error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get admin alerts',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardData,
  getQuickStats,
  getAdminAlerts
};
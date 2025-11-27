const express = require('express');
const {
  getSurveyorAssignments,
  getAssignmentById,
  acceptAssignment,
  startAssignment,
  updateAssignmentProgress,
  completeAssignment,
  addAssignmentMessage,
  getAssignmentMessages,
  createAssignment
} = require('../controllers/assignment');
const { protect, restrictTo } = require('../middlewares/authentication');
const { requireAnyAdmin } = require('../middlewares/niaAuth');
const { requireSurveyorOrAdmin, requireAssignmentAccess, logSurveyorActivity } = require('../middlewares/surveyorAuth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Assignment management routes for surveyors (supports both AMMC and NIA)
router.get('/', requireSurveyorOrAdmin, getSurveyorAssignments); // Get surveyor's assignments
// Assignment creation (admin only - supports both AMMC and NIA admins)
router.post('/', requireAnyAdmin, createAssignment); // Create assignment
router.get('/:assignmentId', requireSurveyorOrAdmin, getAssignmentById); // Get specific assignment
router.patch('/:assignmentId/accept', requireAssignmentAccess, logSurveyorActivity('ACCEPT_ASSIGNMENT'), acceptAssignment); // Accept assignment
router.patch('/:assignmentId/start', requireAssignmentAccess, logSurveyorActivity('START_ASSIGNMENT'), startAssignment); // Start assignment
router.patch('/:assignmentId/progress', requireAssignmentAccess, logSurveyorActivity('UPDATE_PROGRESS'), updateAssignmentProgress); // Update assignment
router.patch('/:assignmentId/complete', requireAssignmentAccess, logSurveyorActivity('COMPLETE_ASSIGNMENT'), completeAssignment); // Complete assignment

// Communication routes (supports both AMMC and NIA)
router.post('/:assignmentId/messages', requireSurveyorOrAdmin, addAssignmentMessage); // Add message
router.get('/:assignmentId/messages', requireSurveyorOrAdmin, getAssignmentMessages); // Get messages

module.exports = router;
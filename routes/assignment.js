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

const router = express.Router();

// All routes require authentication
router.use(protect);

// Assignment management routes for surveyors
router.get('/', restrictTo('Surveyor'), getSurveyorAssignments); // Get surveyor's assignments
// Assignment creation (admin only)
router.post('/', restrictTo('Admin', 'Super-admin'), createAssignment); // Create assignment
router.get('/:assignmentId', restrictTo('Admin', 'Super-admin', 'Surveyor'), getAssignmentById); // Get specific assignment
router.patch('/:assignmentId/accept', restrictTo('Surveyor'), acceptAssignment); // Accept assignment
router.patch('/:assignmentId/start', restrictTo('Surveyor'), startAssignment); // Start assignment
router.patch('/:assignmentId/progress', restrictTo('Surveyor'), updateAssignmentProgress); // Update assignment
router.patch('/:assignmentId/complete', restrictTo('Surveyor'), completeAssignment); // Complete assignment

// Communication routes
router.post('/:assignmentId/messages', restrictTo('Admin', 'Super-admin', 'Surveyor'), addAssignmentMessage); // Add message
router.get('/:assignmentId/messages', restrictTo('Admin', 'Super-admin', 'Surveyor'), getAssignmentMessages); // Get messages

module.exports = router;
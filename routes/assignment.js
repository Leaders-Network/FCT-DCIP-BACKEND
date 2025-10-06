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
const auth = require('../middlewares/authentication');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Assignment management routes for surveyors
router.get('/', getSurveyorAssignments); // Get surveyor's assignments
// Assignment creation (admin only)
router.post('/', require('../middlewares/authentication'), require('../middlewares/adminOnly'), createAssignment); // Create assignment
router.get('/:assignmentId', getAssignmentById); // Get specific assignment
router.patch('/:assignmentId/accept', acceptAssignment); // Accept assignment
router.patch('/:assignmentId/start', startAssignment); // Start assignment
router.patch('/:assignmentId/progress', updateAssignmentProgress); // Update progress
router.patch('/:assignmentId/complete', completeAssignment); // Complete assignment

// Communication routes
router.post('/:assignmentId/messages', addAssignmentMessage); // Add message
router.get('/:assignmentId/messages', getAssignmentMessages); // Get messages

module.exports = router;
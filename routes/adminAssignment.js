const express = require('express');
const {
  getAllAssignments,
  getAssignmentById,
  updateAssignment,
  reassignAssignment,
  cancelAssignment,
  getAssignmentAnalytics,
  createAssignment
} = require('../controllers/adminAssignment');
const auth = require('../middlewares/authentication');
const adminOnly = require('../middlewares/adminOnly');

const router = express.Router();

// All routes require authentication and admin role
router.use(auth);
router.use(adminOnly);

router.get('/', getAllAssignments); // Get all assignments with filters
router.get('/analytics', getAssignmentAnalytics); // Get assignment analytics
router.get('/:assignmentId', getAssignmentById); // Get assignment by ID
router.patch('/:assignmentId', updateAssignment); // Update assignment
router.patch('/:assignmentId/reassign', reassignAssignment); // Reassign to different surveyor
router.patch('/:assignmentId/cancel', cancelAssignment); // Cancel assignment

router.post('/', createAssignment); // Create a new assignment

module.exports = router;
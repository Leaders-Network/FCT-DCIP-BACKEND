const express = require('express');
const router = express.Router();
const { getAllAssignments, getAssignmentAnalytics, getAssignmentById, updateAssignment, reassignAssignment, cancelAssignment, createAssignment, getAssignmentByPolicyId } = require('../controllers/adminAssignment');
const { protect, restrictTo } = require('../middlewares/authentication');

router.use(protect);
router.use(restrictTo('Admin', 'Super-admin'));

router.get('/', getAllAssignments); // Get all assignments with filters
router.get('/analytics', getAssignmentAnalytics); // Get assignment analytics
router.get('/:assignmentId', getAssignmentById); // Get assignment by ID
router.get('/policy/:policyId', getAssignmentByPolicyId); // Get assignment by policy ID
router.patch('/:assignmentId', updateAssignment); // Update assignment
router.patch('/:assignmentId/reassign', reassignAssignment); // Reassign to different surveyor
router.patch('/:assignmentId/cancel', cancelAssignment); // Cancel assignment

router.post('/', createAssignment); // Create a new assignment

module.exports = router;
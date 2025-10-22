const express = require('express');
const {
  getAllPolicyRequests,
  getPolicyRequestById,
  assignSurveyor,
  getAvailableSurveyors,
  reviewSurveySubmission,
  updatePolicyRequest,
  sendPolicyToUser
} = require('../controllers/policy');
const { protect, restrictTo } = require('../middlewares/authentication');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(restrictTo('Admin', 'Super-admin'));

// Get all policy requests (for admin)
router.get('/', getAllPolicyRequests);

// Get a single policy request by ID (for admin)
router.get('/:ammcId', getPolicyRequestById);

// Update a policy request (for admin)
router.patch('/:ammcId', updatePolicyRequest);

// Assign a surveyor to a policy
router.post('/:ammcId/assign', assignSurveyor);

// Get available surveyors for assignment
router.get('/available-surveyors', getAvailableSurveyors);

// Review a survey submission
router.post('/review-submission/:submissionId', reviewSurveySubmission);

// Send policy to user
router.post('/:ammcId/send-to-user', sendPolicyToUser);

// Delete policy request (admin only)
router.delete('/:ammcId', require('../controllers/policy').deletePolicyRequest);

module.exports = router;

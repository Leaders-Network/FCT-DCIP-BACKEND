const express = require('express');
const {
  createPolicyRequest,
  getAllPolicyRequests,
  getPolicyRequestById,
  updatePolicyRequest,
  assignSurveyor,
  getAvailableSurveyors,
  reviewSurveySubmission,
  getUserPolicyRequests
} = require('../controllers/policy');
const auth = require('../middlewares/authentication');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Policy request management
router.post('/', createPolicyRequest); // Create new policy request
router.get('/user', getUserPolicyRequests); // Get user's own policy requests
router.get('/', getAllPolicyRequests); // Get all policy requests (admin)
router.get('/:policyId', getPolicyRequestById); // Get specific policy request
router.patch('/:policyId', updatePolicyRequest); // Update policy request

// Surveyor assignment
router.get('/surveyors/available', getAvailableSurveyors); // Get available surveyors
router.post('/:policyId/assign', assignSurveyor); // Assign surveyors to policy

// Survey review
router.post('/submissions/:submissionId/review', reviewSurveySubmission); // Review survey submission

module.exports = router;
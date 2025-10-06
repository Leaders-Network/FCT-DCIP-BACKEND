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
router.get('/', auth, require('../middlewares/adminOnly'), getAllPolicyRequests); // Get all policy requests (admin)
router.get('/:policyId', auth, require('../middlewares/adminOnly'), getPolicyRequestById); // Get specific policy request
router.patch('/:policyId', auth, require('../middlewares/adminOnly'), updatePolicyRequest); // Update policy request

// Surveyor assignment
router.get('/surveyors/available', getAvailableSurveyors); // Get available surveyors
router.post('/:policyId/assign', auth, require('../middlewares/adminOnly'), assignSurveyor); // Assign surveyors to policy

// Survey review
router.post('/submissions/:submissionId/review', auth, require('../middlewares/adminOnly'), reviewSurveySubmission); // Review survey submission

module.exports = router;
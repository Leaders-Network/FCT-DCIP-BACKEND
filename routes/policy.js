const express = require('express');
const policyController = require('../controllers/policy');
const { protect, restrictTo, restrictToModel } = require('../middlewares/authentication');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Policy request management
router.post('/', restrictToModel('User'), policyController.createPolicyRequest); // Create new policy request
router.get('/user', restrictToModel('User'), policyController.getUserPolicyRequests); // Get user's own policy requests
router.get('/', restrictTo('Admin', 'Super-admin'), policyController.getAllPolicyRequests); // Get all policy requests (admin)
router.get('/:policyId', restrictTo('Admin', 'Super-admin'), policyController.getPolicyRequestById); // Get specific policy request
router.patch('/:policyId', restrictTo('Admin', 'Super-admin'), policyController.updatePolicyRequest); // Update policy request

// Surveyor assignment
router.get('/surveyors/available', restrictTo('Admin', 'Super-admin'), policyController.getAvailableSurveyors); // Get available surveyors
router.post('/:policyId/assign', restrictTo('Admin', 'Super-admin'), policyController.assignSurveyor); // Assign surveyors to policy

// Survey review
router.post('/submissions/:submissionId/review', restrictTo('Admin', 'Super-admin'), policyController.reviewSurveySubmission);

// Delete policy request (users can delete their own, admins can delete any)
router.delete('/:policyId', policyController.deletePolicyRequest);

module.exports = router;
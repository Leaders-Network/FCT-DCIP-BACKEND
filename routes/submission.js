const express = require('express');
const {
  createSurveySubmission,
  getSurveyorSubmissions,
  getSubmissionById,
  updateSurveySubmission,
  submitSurvey,
  addContactLogEntry,
  getSubmissionByAssignment,
  deleteDraftSubmission
} = require('../controllers/submission');
const { protect, restrictTo } = require('../middlewares/authentication');
const { requireSurveyorOrAdmin, requireAnySurveyor, logSurveyorActivity } = require('../middlewares/surveyorAuth');

const router = express.Router();

// Assignment-based routes (accessible by surveyors, admins, and users for their own policies)
router.get('/assignment/:assignmentId', protect, getSubmissionByAssignment);

// All other routes require authentication and surveyor role (supports both AMMC and NIA)
router.use(protect);

// Survey submission routes for surveyors (supports both AMMC and NIA)
router.post('/', requireAnySurveyor, logSurveyorActivity('CREATE_SUBMISSION'), createSurveySubmission); // Create new submission
router.get('/', requireAnySurveyor, getSurveyorSubmissions); // Get surveyor's submissions
router.get('/:submissionId', requireSurveyorOrAdmin, getSubmissionById); // Get specific submission
router.patch('/:submissionId', requireAnySurveyor, logSurveyorActivity('UPDATE_SUBMISSION'), updateSurveySubmission); // Update submission
router.patch('/:submissionId/submit', requireAnySurveyor, logSurveyorActivity('SUBMIT_SURVEY'), submitSurvey); // Submit survey (draft to submitted)
router.delete('/:submissionId', requireAnySurveyor, logSurveyorActivity('DELETE_DRAFT'), deleteDraftSubmission); // Delete draft submission

// Contact log routes (supports both AMMC and NIA)
router.post('/:submissionId/contact', requireAnySurveyor, logSurveyorActivity('ADD_CONTACT_LOG'), addContactLogEntry); // Add contact log entry

module.exports = router;
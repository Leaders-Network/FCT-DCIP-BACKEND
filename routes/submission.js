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
const auth = require('../middlewares/authentication');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Survey submission routes for surveyors
router.post('/', createSurveySubmission); // Create new submission
router.get('/', getSurveyorSubmissions); // Get surveyor's submissions
router.get('/:submissionId', getSubmissionById); // Get specific submission
router.patch('/:submissionId', updateSurveySubmission); // Update submission
router.patch('/:submissionId/submit', submitSurvey); // Submit survey (draft to submitted)
router.delete('/:submissionId', deleteDraftSubmission); // Delete draft submission

// Contact log routes
router.post('/:submissionId/contact', addContactLogEntry); // Add contact log entry

// Assignment-based routes
router.get('/assignment/:assignmentId', getSubmissionByAssignment); // Get submission by assignment

module.exports = router;
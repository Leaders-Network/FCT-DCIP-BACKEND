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

const router = express.Router();

// Assignment-based routes (accessible by surveyors, admins, and users for their own policies)
router.get('/assignment/:assignmentId', protect, getSubmissionByAssignment);

// All other routes require authentication and surveyor role
router.use(protect);
router.use(restrictTo('Surveyor'));

// Survey submission routes for surveyors
router.post('/', createSurveySubmission); // Create new submission
router.get('/', getSurveyorSubmissions); // Get surveyor's submissions
router.get('/:submissionId', getSubmissionById); // Get specific submission
router.patch('/:submissionId', updateSurveySubmission); // Update submission
router.patch('/:submissionId/submit', submitSurvey); // Submit survey (draft to submitted)
router.delete('/:submissionId', deleteDraftSubmission); // Delete draft submission

// Contact log routes
router.post('/:submissionId/contact', addContactLogEntry); // Add contact log entry

module.exports = router;
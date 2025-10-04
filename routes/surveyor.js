const express = require('express');
const {
  getSurveyorDashboard,
  getSurveyorAssignments,
  updateAssignmentStatus,
  submitSurvey,
  getSurveyorSubmissions,
  getSurveyorProfile,
  updateSurveyorProfile
} = require('../controllers/surveyor');
const auth = require('../middlewares/authentication');

const router = express.Router();

// All routes require authentication
router.use(auth);

// Dashboard
router.get('/dashboard', getSurveyorDashboard);

// Assignments
router.get('/assignments', getSurveyorAssignments);
router.patch('/assignments/:assignmentId/status', updateAssignmentStatus);

// Survey submissions
router.post('/surveys', submitSurvey);
router.get('/submissions', getSurveyorSubmissions);

// Profile management
router.get('/profile', getSurveyorProfile);
router.patch('/profile', updateSurveyorProfile);

module.exports = router;
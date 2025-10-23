const express = require('express');
const {
  getSurveyorDashboard,
  getSurveyorAssignments,
  getAssignmentById,
  updateAssignmentStatus,
  submitSurvey,
  getSurveyorSubmissions,
  getSurveyorProfile,
  updateSurveyorProfile
} = require('../controllers/surveyor');
const { protect, restrictTo } = require('../middlewares/authentication');
const upload = require('../middlewares/file-upload');

const router = express.Router();

// All routes require authentication and must be restricted to Surveyor role
router.use(protect);
router.use(restrictTo('Surveyor'));

// Dashboard
router.get('/dashboard', getSurveyorDashboard);

// Assignments
router.get('/assignments', getSurveyorAssignments);
router.get('/assignments/:assignmentId', getAssignmentById);
router.patch('/assignments/:assignmentId/status', updateAssignmentStatus);

// Survey submissions
router.post('/surveys', upload.single('surveyDocument'), submitSurvey);
router.get('/submissions', getSurveyorSubmissions);

// Profile management
router.get('/profile', getSurveyorProfile);
router.patch('/profile', updateSurveyorProfile);

module.exports = router;
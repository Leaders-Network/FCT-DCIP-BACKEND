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
const { requireAnySurveyor, logSurveyorActivity } = require('../middlewares/surveyorAuth');
const upload = require('../middlewares/file-upload');

const router = express.Router();

// All routes require authentication and surveyor role (supports both AMMC and NIA)
router.use(protect);
router.use(requireAnySurveyor);

// Dashboard (supports both AMMC and NIA surveyors)
router.get('/dashboard', logSurveyorActivity('ACCESS_DASHBOARD'), getSurveyorDashboard);

// Assignments (supports both AMMC and NIA surveyors)
router.get('/assignments', getSurveyorAssignments);
router.get('/assignments/:assignmentId', getAssignmentById);
router.patch('/assignments/:assignmentId/status', logSurveyorActivity('UPDATE_ASSIGNMENT_STATUS'), updateAssignmentStatus);

// Survey submissions (supports both AMMC and NIA surveyors)
router.post('/surveys', upload.single('surveyDocument'), logSurveyorActivity('SUBMIT_SURVEY'), submitSurvey);
router.get('/submissions', getSurveyorSubmissions);

// Profile management (supports both AMMC and NIA surveyors)
router.get('/profile', getSurveyorProfile);
router.patch('/profile', logSurveyorActivity('UPDATE_PROFILE'), updateSurveyorProfile);

module.exports = router;
const express = require('express');
const {
  getSurveyorDashboard,
  getSurveyorAssignments,
  getAssignmentById,
  updateAssignmentStatus,
  submitSurvey,
  getSurveyorSubmissions,
  getSurveyorProfile,
  updateSurveyorProfile,
  getSurveyorDualAssignments
} = require('../controllers/surveyor');
const { protect, restrictTo, requireSurveyorDashboardAccess } = require('../middlewares/authentication');
const { logSurveyorActivity } = require('../middlewares/surveyorAuth');
const { ensurePartnerContactInfo, populateDualAssignmentInfo } = require('../middlewares/assignmentContactMiddleware');
const upload = require('../middlewares/file-upload');

const router = express.Router();

// Test endpoint to check if routing works
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Surveyor routes are working' });
});

// All routes require authentication and surveyor dashboard access
router.use(protect);
router.use(requireSurveyorDashboardAccess);

// Dashboard (supports both AMMC and NIA surveyors)
router.get('/dashboard', logSurveyorActivity('ACCESS_DASHBOARD'), getSurveyorDashboard);

// Assignments (supports both AMMC and NIA surveyors)
router.get('/assignments', getSurveyorAssignments);
router.get('/assignments/:assignmentId', getAssignmentById);
router.patch('/assignments/:assignmentId/status', logSurveyorActivity('UPDATE_ASSIGNMENT_STATUS'), updateAssignmentStatus);

// Dual assignments (supports both AMMC and NIA surveyors)
router.get('/dual-assignments', getSurveyorDualAssignments);

// Survey submissions (supports both AMMC and NIA surveyors)
router.post('/surveys', upload.single('surveyDocument'), logSurveyorActivity('SUBMIT_SURVEY'), submitSurvey);
router.get('/submissions', getSurveyorSubmissions);

// Profile management (supports both AMMC and NIA surveyors)
router.get('/profile', getSurveyorProfile);
router.patch('/profile', logSurveyorActivity('UPDATE_PROFILE'), updateSurveyorProfile);

module.exports = router;
const express = require('express');
const {
  getDashboardData,
  getQuickStats,
  getAdminAlerts
} = require('../controllers/adminDashboard');
const { protect, requireAdminDashboardAccess } = require('../middlewares/authentication');

const router = express.Router();

// All routes require authentication and admin dashboard access
router.use(protect);
router.use(requireAdminDashboardAccess);

router.get('/', getDashboardData); // Get comprehensive dashboard data
router.get('/stats', getQuickStats); // Get quick stats for widgets
router.get('/alerts', getAdminAlerts); // Get admin alerts and notifications

module.exports = router;
const express = require('express');
const {
  getDashboardData,
  getQuickStats,
  getAdminAlerts
} = require('../controllers/adminDashboard');
const auth = require('../middlewares/authentication');
const adminOnly = require('../middlewares/adminOnly');

const router = express.Router();

// All routes require authentication and admin role
router.use(auth);
router.use(adminOnly);

router.get('/', getDashboardData); // Get comprehensive dashboard data
router.get('/stats', getQuickStats); // Get quick stats for widgets
router.get('/alerts', getAdminAlerts); // Get admin alerts and notifications

module.exports = router;
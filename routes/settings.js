const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, changePassword } = require('../controllers/settings');
const { protect } = require('../middlewares/authentication');

// All routes require authentication
router.use(protect);

// Get user profile
router.get('/profile', getProfile);

// Update profile
router.patch('/profile', updateProfile);

// Change password
router.post('/change-password', changePassword);

module.exports = router;

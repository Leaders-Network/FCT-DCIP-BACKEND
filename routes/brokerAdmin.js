const express = require('express');
const router = express.Router();
const { protect, requireBrokerAdminAccess } = require('../middlewares/authentication');
const { loginBrokerAdmin, verifyBrokerAdmin, logoutBrokerAdmin } = require('../controllers/brokerAuth');

// Authentication routes (no protection needed for login)
router.post('/auth/login', loginBrokerAdmin);

// Protected routes (require authentication and broker admin access)
router.get('/auth/verify', protect, requireBrokerAdminAccess, verifyBrokerAdmin);
router.post('/auth/logout', protect, requireBrokerAdminAccess, logoutBrokerAdmin);

module.exports = router;

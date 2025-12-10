const express = require('express');
const router = express.Router();
const {
    sendResetPasswordOTP,
    verifyResetPasswordOTP,
    resetPassword,
    resendResetPasswordOTP
} = require('../controllers/resetPassword');
const validateKey = require('../middlewares/generate-api-key');

// All routes require API key validation
router.use(validateKey);

// Send reset password OTP
router.post('/send-otp', sendResetPasswordOTP);

// Verify reset password OTP
router.post('/verify-otp', verifyResetPasswordOTP);

// Reset password with token
router.post('/reset', resetPassword);

// Resend OTP
router.post('/resend-otp', resendResetPasswordOTP);

module.exports = router;
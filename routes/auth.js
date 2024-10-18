const express = require('express')
const authenticationMiddleware = require('../middlewares/authentication');
const router = express.Router()
const { requestOtp, verifyOtp, register, login, sendResetPasswordOtp, sendResetPasswordOtpEmployee, resetPassword, resetPasswordEmployee, loginEmployee, registerEmployee } = require('../controllers/auth')
const validateKey = require('../middlewares/generate-api-key')

router.post('/request-otp', validateKey, requestOtp)
router.post('/verify-otp', validateKey, verifyOtp)
router.post('/register', validateKey, register)
router.post('/login',  validateKey, login)
router.post('/send-reset-password-otp', validateKey, authenticationMiddleware, sendResetPasswordOtp)
router.post('/reset-password-otp', validateKey, sendResetPasswordOtpEmployee) 
router.patch('/reset-password', validateKey, authenticationMiddleware, resetPassword)
router.patch('/employee-reset-password', validateKey, resetPasswordEmployee)
router.post('/loginEmployee', validateKey, loginEmployee)
router.post('/registerEmployee', validateKey, authenticationMiddleware, registerEmployee)

module.exports = router

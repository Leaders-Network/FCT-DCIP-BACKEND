const express = require('express')
const authenticationMiddleware = require('../middlewares/authentication');
const router = express.Router()
const { requestOtp, verifyOtp, register, login, sendResetPasswordOtpUser, sendResetPasswordOtpEmployee, resetPasswordUser, verifyOtpEmployee, verifyPasswordResetOtpUser, resetPasswordEmployee, loginEmployee, registerEmployee } = require('../controllers/auth')
const validateKey = require('../middlewares/generate-api-key')

router.post('/request-otp', validateKey, requestOtp)
router.post('/verify-otp', validateKey, verifyOtp)
router.post('/register', validateKey, register)
router.post('/login',  validateKey, login)
router.post('/send-reset-password-otp', validateKey, sendResetPasswordOtpUser)
router.patch('/reset-password', validateKey, resetPasswordUser)
router.post('/verify-otp-user', validateKey, verifyPasswordResetOtpUser)
router.post('/reset-password-otp', validateKey, sendResetPasswordOtpEmployee) 
router.post('/verify-otp-employee', validateKey, verifyOtpEmployee)
router.patch('/employee-reset-password', validateKey, resetPasswordEmployee)
router.post('/loginEmployee', validateKey, loginEmployee)
router.post('/registerEmployee', validateKey, authenticationMiddleware, registerEmployee)




module.exports = router

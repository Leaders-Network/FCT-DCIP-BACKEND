const express = require('express')
const authenticationMiddleware = require('../middlewares/authentication');
const router = express.Router()
const { requestOtp, verifyOtp, register, login, sendResetPasswordOtpUser, sendResetPasswordOtpEmployee, resetPasswordUser, verifyOtpEmployee, verifyPasswordResetOtpUser, resetPasswordEmployee, loginEmployee, registerEmployee, addProperty, deleteUser, removeProperty, getAllProperties, updateProperty, getAllEmployees, returnAvailableRoles } = require('../controllers/auth')
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
router.post('/user/add-property', validateKey, authenticationMiddleware, addProperty)
router.delete('/user/delete', validateKey, authenticationMiddleware, deleteUser)
router.delete('/user/remove-property/:id', validateKey, authenticationMiddleware, removeProperty)
router.patch('/user/update-property/:id', validateKey, authenticationMiddleware, updateProperty)
router.get('/user/get-all-properties', validateKey, authenticationMiddleware, getAllProperties)
router.get('/get-all-employees', validateKey, authenticationMiddleware, getAllEmployees)
router.get('/available-roles', validateKey, authenticationMiddleware, returnAvailableRoles)



module.exports = router

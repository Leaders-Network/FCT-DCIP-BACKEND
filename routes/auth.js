const express = require('express')
const { protect, restrictTo, restrictToModel, allowUserOrAdmin } = require('../middlewares/authentication');
const router = express.Router()
const { requestOtp, verifyOtp, register, login, sendResetPasswordOtpUser, sendResetPasswordOtpEmployee, resetPasswordUser, verifyOtpEmployee, verifyPasswordResetOtpUser, resetPasswordEmployee, loginEmployee, registerEmployee, addProperty, deleteUser, removeProperty, getAllProperties, updateProperty, getAllUsers, getUserById, getAllEmployees, returnAvailableRoles, returnAvailableCategories } = require('../controllers/auth')
const validateKey = require('../middlewares/generate-api-key')

router.post('/request-otp', validateKey, requestOtp)
router.post('/verify-otp', validateKey, verifyOtp)
router.post('/register', validateKey, register)
router.post('/login', validateKey, login)
router.post('/send-reset-password-otp', validateKey, sendResetPasswordOtpUser)
router.patch('/reset-password', validateKey, protect, resetPasswordUser)
router.post('/verify-otp-user', validateKey, verifyPasswordResetOtpUser)
router.post('/reset-password-otp', validateKey, sendResetPasswordOtpEmployee)
router.post('/verify-otp-employee', validateKey, verifyOtpEmployee)
router.patch('/employee-reset-password', validateKey, resetPasswordEmployee)
router.post('/loginEmployee', validateKey, loginEmployee)
router.post('/registerEmployee', validateKey, protect, restrictTo('Admin', 'Super-admin'), registerEmployee)
router.post('/user/add-property', validateKey, protect, allowUserOrAdmin, addProperty)
router.delete('/user/delete', validateKey, protect, allowUserOrAdmin, deleteUser)
router.delete('/user/remove-property/:id', validateKey, protect, allowUserOrAdmin, removeProperty)
router.patch('/user/update-property/:id', validateKey, protect, allowUserOrAdmin, updateProperty)
router.get('/users', validateKey, protect, restrictTo('Admin', 'Super-admin'), getAllUsers);
router.get('/users/:id', validateKey, protect, restrictTo('Admin', 'Super-admin'), getUserById);
router.get('/user/get-all-properties', validateKey, protect, allowUserOrAdmin, getAllProperties)
router.get('/get-all-employees', validateKey, protect, restrictTo('Admin', 'Super-admin', 'NIA-Admin'), getAllEmployees)
router.get('/available-roles', validateKey, protect, restrictTo('Admin', 'Super-admin', 'NIA-Admin'), returnAvailableRoles)
router.get('/available-categories', validateKey, protect, returnAvailableCategories)



module.exports = router

const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const { Employee } = require('../models/Employee');
const Surveyor = require('../models/Surveyor');
const NIAAdmin = require('../models/NIAAdmin');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');
const bcrypt = require('bcryptjs');

/**
 * Get user profile
 */
const getProfile = async (req, res) => {
    try {
        const { userId, tokenType, model } = req.user;

        let profile;

        // Handle based on model type first
        if (model === 'User') {
            profile = await User.findById(userId).select('-password');
        } else if (model === 'Employee') {
            // For employees, get the employee record
            profile = await Employee.findById(userId)
                .select('-password')
                .populate('employeeRole employeeStatus');
        }

        if (!profile) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Profile not found'
            });
        }

        res.status(StatusCodes.OK).json({
            success: true,
            data: profile
        });
    } catch (error) {
        console.error('Get profile error:', error);
        const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to fetch profile'
        });
    }
};

/**
 * Update profile (name, email, phone)
 */
const updateProfile = async (req, res) => {
    try {
        const { userId, model } = req.user;
        const { firstname, lastname, email, phonenumber } = req.body;

        let updatedProfile;

        if (model === 'User') {
            // Check if email already exists
            if (email) {
                const existingUser = await User.findOne({ email, _id: { $ne: userId } });
                if (existingUser) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        success: false,
                        message: 'Email already in use'
                    });
                }
            }

            updatedProfile = await User.findByIdAndUpdate(
                userId,
                { firstname, lastname, email, phonenumber },
                { new: true, runValidators: true }
            ).select('-password');

        } else if (model === 'Employee') {
            // Check if email already exists
            if (email) {
                const existingEmployee = await Employee.findOne({ email, _id: { $ne: userId } });
                if (existingEmployee) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        success: false,
                        message: 'Email already in use'
                    });
                }
            }

            updatedProfile = await Employee.findByIdAndUpdate(
                userId,
                { firstname, lastname, email, phonenumber },
                { new: true, runValidators: true }
            ).select('-password').populate('employeeRole employeeStatus');
        }

        if (!updatedProfile) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'Profile not found'
            });
        }

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedProfile
        });
    } catch (error) {
        console.error('Update profile error:', error);
        const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to update profile'
        });
    }
};

/**
 * Change password
 */
const changePassword = async (req, res) => {
    try {
        const { userId, model } = req.user;
        const { currentPassword, newPassword, confirmPassword } = req.body;

        console.log('🔐 Password change request:', { userId, model });

        // Validate input
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'All password fields are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'New passwords do not match'
            });
        }

        if (newPassword.length < 6) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        if (currentPassword === newPassword) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: 'New password must be different from current password'
            });
        }

        let user;
        if (model === 'User') {
            user = await User.findById(userId);
        } else if (model === 'Employee') {
            user = await Employee.findById(userId);
        }

        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        console.log('🔍 Verifying current password...');
        const isPasswordCorrect = await user.comparePassword(currentPassword);
        if (!isPasswordCorrect) {
            console.log('❌ Current password is incorrect');
            return res.status(StatusCodes.UNAUTHORIZED).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }
        console.log('✅ Current password verified');

        // Hash new password and update directly to avoid pre-save hook issues
        console.log('🔐 Hashing new password...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        console.log('✅ Password hashed successfully');

        console.log('💾 Updating password in database...');
        if (model === 'User') {
            // For User model, update directly to avoid pre-save hook double hashing
            await User.findByIdAndUpdate(userId, { password: hashedPassword });
            console.log('✅ User password updated directly in database');
        } else if (model === 'Employee') {
            // For Employee model, also update directly for consistency
            await Employee.findByIdAndUpdate(userId, { password: hashedPassword });
            console.log('✅ Employee password updated directly in database');
        }

        console.log('🎉 Password changed successfully for user:', userId);

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to change password'
        });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword
};

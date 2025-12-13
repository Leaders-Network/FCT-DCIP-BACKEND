const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const { Employee } = require('../models/Employee');
const Otp = require('../models/OTP');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');
const bcrypt = require('bcryptjs');
const sendEmail = require('../utils/sendEmail');

/**
 * Send reset password OTP to user's email
 * Works for both regular users and employees
 */
const sendResetPasswordOTP = async (req, res) => {
    try {
        const { email } = req.body;
        console.log('🔐 Reset Password OTP Request:', { email });

        if (!email) {
            console.log('❌ No email provided');
            throw new BadRequestError('Email is required');
        }

        // Check if user exists in either User or Employee collection
        console.log('👤 Checking if user exists...');
        let user = await User.findOne({ email });
        let userType = 'user';

        if (!user) {
            console.log('👤 User not found in User collection, checking Employee collection...');
            user = await Employee.findOne({ email });
            userType = 'employee';
        }

        if (!user) {
            console.log('❌ No user found with email:', email);
            throw new NotFoundError('No account found with that email address');
        }

        console.log('✅ User found:', { email, userType, userId: user._id });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('🔢 Generated OTP:', otp, 'for email:', email);
        console.log('📝 OTP Details:', {
            otp: otp,
            email: email,
            userType: userType,
            userId: user._id,
            timestamp: new Date().toISOString()
        });

        // Delete any existing OTP for this email
        const deletedCount = await Otp.deleteMany({ email });
        console.log('🗑️ Deleted existing OTPs:', deletedCount.deletedCount);

        // Create new OTP record
        const otpRecord = await Otp.create({
            email,
            otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });
        console.log('💾 Created OTP record:', {
            email: otpRecord.email,
            otp: otpRecord.otp,
            expiresAt: otpRecord.expiresAt
        });

        // Send OTP via email
        console.log('📧 Sending OTP email to:', email);
        await sendEmail(email, "resetpassword", otp);
        console.log('✅ OTP email sent successfully');

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Password reset OTP sent to your email successfully',
            userType // Let frontend know which type of user this is
        });
    } catch (error) {
        console.error('❌ Send reset password OTP error:', error);
        const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to send reset password OTP'
        });
    }
};

/**
 * Verify OTP for password reset
 */
const verifyResetPasswordOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        console.log('🔍 Verify OTP Request:', { email, otp });

        if (!email || !otp) {
            console.log('❌ Missing email or OTP');
            throw new BadRequestError('Email and OTP are required');
        }

        // Find OTP record
        console.log('🔍 Looking for OTP record...');
        const otpRecord = await Otp.findOne({ email, otp });

        if (!otpRecord) {
            console.log('❌ OTP record not found for:', { email, otp });
            throw new BadRequestError('Invalid or expired OTP');
        }

        console.log('✅ OTP record found:', {
            email: otpRecord.email,
            otp: otpRecord.otp,
            expiresAt: otpRecord.expiresAt,
            verified: otpRecord.verified,
            createdAt: otpRecord.createdAt,
            timeRemaining: Math.round((otpRecord.expiresAt - new Date()) / 1000 / 60) + ' minutes'
        });

        // Check if OTP has expired
        const now = new Date();
        if (otpRecord.expiresAt < now) {
            console.log('❌ OTP expired:', {
                expiresAt: otpRecord.expiresAt,
                now: now,
                expired: true
            });
            await Otp.deleteOne({ email, otp });
            throw new BadRequestError('OTP has expired. Please request a new one');
        }

        console.log('✅ OTP is still valid');

        // Verify user still exists
        console.log('👤 Verifying user still exists...');
        let user = await User.findOne({ email });
        let userType = 'user';

        if (!user) {
            console.log('👤 User not in User collection, checking Employee...');
            user = await Employee.findOne({ email });
            userType = 'employee';
        }

        if (!user) {
            console.log('❌ User account not found:', email);
            throw new NotFoundError('User account not found');
        }

        console.log('✅ User verified:', { email, userType, userId: user._id });

        // Generate reset token (valid for 15 minutes)
        const resetToken = require('crypto').randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
        console.log('🔑 Generated reset token:', {
            resetToken: resetToken.substring(0, 10) + '...',
            expiresAt: resetTokenExpiry
        });

        // Store reset token in OTP collection (reusing the record)
        const updatedRecord = await Otp.findOneAndUpdate(
            { email, otp },
            {
                resetToken,
                resetTokenExpiry,
                verified: true
            },
            { new: true }
        );

        console.log('💾 Updated OTP record with reset token:', {
            email: updatedRecord.email,
            verified: updatedRecord.verified,
            hasResetToken: !!updatedRecord.resetToken
        });

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'OTP verified successfully',
            resetToken,
            userType
        });
    } catch (error) {
        console.error('❌ Verify reset password OTP error:', error);
        const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to verify OTP'
        });
    }
};

/**
 * Reset password using verified token
 */
const resetPassword = async (req, res) => {
    try {
        const { email, resetToken, newPassword, confirmPassword } = req.body;
        console.log('🔐 Reset Password Request:', {
            email,
            resetToken: resetToken ? resetToken.substring(0, 10) + '...' : 'missing',
            hasNewPassword: !!newPassword,
            hasConfirmPassword: !!confirmPassword
        });

        if (!email || !resetToken || !newPassword || !confirmPassword) {
            console.log('❌ Missing required fields');
            throw new BadRequestError('All fields are required');
        }

        if (newPassword !== confirmPassword) {
            console.log('❌ Passwords do not match');
            throw new BadRequestError('Passwords do not match');
        }

        if (newPassword.length < 6) {
            console.log('❌ Password too short:', newPassword.length);
            throw new BadRequestError('Password must be at least 6 characters long');
        }

        console.log('✅ Password validation passed');

        // Find and verify reset token
        console.log('🔍 Looking for reset token record...');
        const otpRecord = await Otp.findOne({
            email,
            resetToken,
            verified: true
        });

        if (!otpRecord) {
            console.log('❌ Reset token record not found:', { email, verified: true });
            throw new BadRequestError('Invalid or expired reset token');
        }

        console.log('✅ Reset token record found:', {
            email: otpRecord.email,
            verified: otpRecord.verified,
            resetTokenExpiry: otpRecord.resetTokenExpiry
        });

        // Check if reset token has expired
        const now = new Date();
        if (otpRecord.resetTokenExpiry < now) {
            console.log('❌ Reset token expired:', {
                expiresAt: otpRecord.resetTokenExpiry,
                now: now
            });
            await Otp.deleteOne({ email, resetToken });
            throw new BadRequestError('Reset token has expired. Please start the process again');
        }

        console.log('✅ Reset token is still valid');

        // Find user and determine type
        console.log('👤 Finding user account...');
        let user = await User.findOne({ email });
        let userType = 'user';

        if (!user) {
            console.log('👤 User not in User collection, checking Employee...');
            user = await Employee.findOne({ email });
            userType = 'employee';
        }

        if (!user) {
            console.log('❌ User account not found:', email);
            throw new NotFoundError('User account not found');
        }

        console.log('✅ User found:', { email, userType, userId: user._id });

        // Hash new password
        console.log('🔐 Hashing new password...');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        console.log('✅ Password hashed successfully');

        // Update password
        console.log('💾 Updating password in database...');
        if (userType === 'user') {
            await User.findOneAndUpdate(
                { email },
                { password: hashedPassword },
                { new: true, runValidators: true }
            );
            console.log('✅ User password updated');
        } else {
            // For employees, also activate their account if it's not active
            try {
                const Status = require('../models/Status');
                const activeStatus = await Status.findOne({ status: 'Active' });
                console.log('📊 Active status found:', !!activeStatus);

                await Employee.findOneAndUpdate(
                    { email },
                    {
                        password: hashedPassword,
                        employeeStatus: activeStatus?._id || user.employeeStatus
                    },
                    { new: true, runValidators: true }
                );
                console.log('✅ Employee password updated and account activated');
            } catch (statusError) {
                console.log('⚠️ Status model not found, updating password only');
                await Employee.findOneAndUpdate(
                    { email },
                    { password: hashedPassword },
                    { new: true, runValidators: true }
                );
                console.log('✅ Employee password updated');
            }
        }

        // Clean up OTP record
        console.log('🗑️ Cleaning up OTP record...');
        const deleteResult = await Otp.deleteOne({ email, resetToken });
        console.log('✅ OTP record cleaned up:', deleteResult.deletedCount);

        console.log('🎉 Password reset completed successfully for:', email);

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'Password reset successfully',
            userType
        });
    } catch (error) {
        console.error('❌ Reset password error:', error);
        const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to reset password'
        });
    }
};

/**
 * Resend OTP for password reset
 */
const resendResetPasswordOTP = async (req, res) => {
    try {
        const { email } = req.body;
        console.log('🔄 Resend OTP Request:', { email });

        if (!email) {
            console.log('❌ No email provided for resend');
            throw new BadRequestError('Email is required');
        }

        // Check if user exists
        console.log('👤 Checking if user exists for resend...');
        let user = await User.findOne({ email });
        let userType = 'user';

        if (!user) {
            console.log('👤 User not found in User collection, checking Employee...');
            user = await Employee.findOne({ email });
            userType = 'employee';
        }

        if (!user) {
            console.log('❌ No user found for resend:', email);
            throw new NotFoundError('No account found with that email address');
        }

        console.log('✅ User found for resend:', { email, userType, userId: user._id });

        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('🔢 Generated new OTP for resend:', otp, 'for email:', email);
        console.log('📝 Resend OTP Details:', {
            otp: otp,
            email: email,
            userType: userType,
            userId: user._id,
            timestamp: new Date().toISOString(),
            reason: 'resend_request'
        });

        // Delete any existing OTP for this email
        const deletedCount = await Otp.deleteMany({ email });
        console.log('🗑️ Deleted existing OTPs for resend:', deletedCount.deletedCount);

        // Create new OTP record
        const otpRecord = await Otp.create({
            email,
            otp,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });
        console.log('💾 Created new OTP record for resend:', {
            email: otpRecord.email,
            otp: otpRecord.otp,
            expiresAt: otpRecord.expiresAt
        });

        // Send OTP via email
        console.log('📧 Sending resend OTP email to:', email);
        await sendEmail(email, "resetpassword", otp);
        console.log('✅ Resend OTP email sent successfully');

        res.status(StatusCodes.OK).json({
            success: true,
            message: 'New OTP sent to your email successfully',
            userType
        });
    } catch (error) {
        console.error('❌ Resend reset password OTP error:', error);
        const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Failed to resend OTP'
        });
    }
};

module.exports = {
    sendResetPasswordOTP,
    verifyResetPasswordOTP,
    resetPassword,
    resendResetPasswordOTP
};
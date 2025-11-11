/**
 * Quick Authentication Setup Script
 * This script generates tokens and outputs a ready-to-paste browser console command
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

const generateToken = (userId, fullname, role, model) => {
    return jwt.sign(
        { userId, fullname, role, model },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_LIFETIME || '30d' }
    );
};

const quickSetup = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        // Find or create test user
        let testUser = await User.findOne({ email: 'testuser@example.com' });

        if (!testUser) {
            testUser = await User.create({
                fullname: 'Test User',
                email: 'testuser@example.com',
                password: 'password123',
                phonenumber: '08012345678',
                role: 'user',
                isEmailVerified: true
            });
        }

        const userToken = generateToken(
            testUser._id,
            testUser.fullname,
            testUser.role,
            'User'
        );

        console.log('\n' + '='.repeat(80));
        console.log('🚀 QUICK AUTH SETUP');
        console.log('='.repeat(80));
        console.log('\n📋 Copy and paste this in your browser console:\n');
        console.log(`localStorage.setItem("userToken", "${userToken}"); location.reload();`);
        console.log('\n' + '='.repeat(80));
        console.log('\n✅ Or login with:');
        console.log('   Email: testuser@example.com');
        console.log('   Password: password123\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

quickSetup();

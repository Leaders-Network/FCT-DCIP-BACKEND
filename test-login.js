const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testLogin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const { Employee } = require('./models/Employee');

        // Test login for Super Admin
        const email = 'admin@ammc.com';
        const password = 'password123'; // Common test password

        console.log(`\nTesting login for: ${email}`);

        const user = await Employee.findOne({ email })
            .populate(['employeeRole', 'employeeStatus']);

        if (!user) {
            console.log('User not found');
            process.exit(1);
        }

        console.log(`User found: ${user.firstname} ${user.lastname}`);
        console.log(`Role: ${user.employeeRole?.role}`);
        console.log(`Status: ${user.employeeStatus?.status}`);

        // Test password
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        console.log(`Password correct: ${isPasswordCorrect}`);

        if (isPasswordCorrect) {
            // Generate token
            const token = jwt.sign(
                {
                    userId: user._id,
                    model: 'Employee'
                },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_LIFETIME || '30d' }
            );

            console.log('\n=== LOGIN SUCCESS ===');
            console.log('Token generated:', token.substring(0, 50) + '...');
            console.log('\nTo test in frontend, set this token in localStorage:');
            console.log(`localStorage.setItem('adminToken', '${token}');`);
        } else {
            console.log('\n=== LOGIN FAILED ===');
            console.log('Incorrect password');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testLogin();
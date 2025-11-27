/**
 * Test script to verify NIA Admin creation endpoint
 * Run with: node scripts/testNIAAdminCreation.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function testNIAAdminCreation() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fct-dcip-local');
        console.log('✅ Connected to MongoDB');

        const { Employee, Role, Status } = require('../models/Employee');
        const NIAAdmin = require('../models/NIAAdmin');

        // Check if NIA Admin role exists
        console.log('\n📋 Checking for NIA Admin role...');
        let niaAdminRole = await Role.findOne({ role: 'NIA-Admin' });

        if (!niaAdminRole) {
            console.log('⚠️  NIA-Admin role not found, creating it...');
            niaAdminRole = await Role.create({
                role: 'NIA-Admin'
            });
            console.log('✅ NIA-Admin role created');
        } else {
            console.log('✅ NIA-Admin role exists');
        }

        // Check if Active status exists (note: enum uses 'Active' with capital A)
        console.log('\n📋 Checking for Active status...');
        let activeStatus = await Status.findOne({ status: 'Active' });

        if (!activeStatus) {
            console.log('⚠️  Active status not found, creating it...');
            activeStatus = await Status.create({
                status: 'Active'
            });
            console.log('✅ Active status created');
        } else {
            console.log('✅ Active status exists');
        }

        // Test data
        const testAdmin = {
            firstname: 'Test',
            lastname: 'NIAAdmin',
            email: 'test.niaadmin@example.com',
            phonenumber: '08012345678',
            permissions: {
                canManageSurveyors: true,
                canManageAssignments: true,
                canViewReports: true,
                canManageAdmins: false
            }
        };

        console.log('\n🧪 Testing NIA Admin creation...');
        console.log('Test data:', testAdmin);

        // Check if user already exists
        let existingUser = await Employee.findOne({ email: testAdmin.email });
        if (existingUser) {
            console.log('⚠️  Test user already exists, deleting...');
            await NIAAdmin.deleteOne({ userId: existingUser._id });
            await Employee.deleteOne({ _id: existingUser._id });
            console.log('✅ Cleaned up existing test user');
        }

        // Create employee
        console.log('\n👤 Creating employee...');
        const newEmployee = new Employee({
            firstname: testAdmin.firstname,
            lastname: testAdmin.lastname,
            email: testAdmin.email,
            phonenumber: testAdmin.phonenumber,
            password: 'ChangeMe123!',
            employeeRole: niaAdminRole._id,
            employeeStatus: activeStatus._id,
            organization: 'NIA'
        });

        await newEmployee.save();
        console.log('✅ Employee created:', newEmployee._id);

        // Create NIA admin
        console.log('\n🔐 Creating NIA Admin...');
        const niaAdmin = new NIAAdmin({
            userId: newEmployee._id,
            permissions: testAdmin.permissions,
            profile: {},
            status: 'active'
        });

        await niaAdmin.save();
        await niaAdmin.populate('userId', 'firstname lastname email phonenumber');

        console.log('✅ NIA Admin created successfully!');
        console.log('\nNIA Admin Details:');
        console.log('- ID:', niaAdmin._id);
        console.log('- User:', `${niaAdmin.userId.firstname} ${niaAdmin.userId.lastname}`);
        console.log('- Email:', niaAdmin.userId.email);
        console.log('- Permissions:', niaAdmin.permissions);
        console.log('- Status:', niaAdmin.status);

        console.log('\n✅ Test completed successfully!');
        console.log('\n📝 You can now login with:');
        console.log('   Email:', testAdmin.email);
        console.log('   Password: ChangeMe123!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

testNIAAdminCreation();

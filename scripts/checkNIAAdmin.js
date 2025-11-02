require('dotenv').config();
const mongoose = require('mongoose');
const { Employee } = require('../models/Employee');
const NIAAdmin = require('../models/NIAAdmin');
const connectDB = require('../database/connect');

const checkNIAAdmin = async () => {
    try {
        console.log('🔌 Connecting to database...');
        await connectDB(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB!');

        const userId = '6906a4383cc4c4ffe626821f';
        console.log(`\n🔍 Checking user: ${userId}`);

        // Check if Employee exists
        const employee = await Employee.findById(userId)
            .populate(['employeeRole', 'employeeStatus']);

        if (employee) {
            console.log('✅ Employee found:');
            console.log(`  Name: ${employee.firstname} ${employee.lastname}`);
            console.log(`  Email: ${employee.email}`);
            console.log(`  Role: ${employee.employeeRole?.role}`);
            console.log(`  Status: ${employee.employeeStatus?.status}`);
        } else {
            console.log('❌ Employee not found');
        }

        // Check if NIAAdmin exists
        const niaAdmin = await NIAAdmin.findOne({ userId, status: 'active' })
            .populate('userId', 'firstname lastname email');

        if (niaAdmin) {
            console.log('✅ NIAAdmin record found:');
            console.log(`  ID: ${niaAdmin._id}`);
            console.log(`  Status: ${niaAdmin.status}`);
            console.log(`  Permissions:`, niaAdmin.permissions);
        } else {
            console.log('❌ NIAAdmin record not found');

            // Check if there are any NIAAdmin records at all
            const allNIAAdmins = await NIAAdmin.find({});
            console.log(`\n📊 Total NIAAdmin records: ${allNIAAdmins.length}`);

            if (allNIAAdmins.length > 0) {
                console.log('Existing NIAAdmin records:');
                allNIAAdmins.forEach((admin, index) => {
                    console.log(`  ${index + 1}. UserID: ${admin.userId}, Status: ${admin.status}`);
                });
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed.');
        process.exit(0);
    }
};

checkNIAAdmin();
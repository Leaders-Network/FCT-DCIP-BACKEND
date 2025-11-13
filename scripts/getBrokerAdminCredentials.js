const mongoose = require('mongoose');
const { Employee } = require('../models/Employee');
const BrokerAdmin = require('../models/BrokerAdmin');
require('dotenv').config();

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fct-dcip-local';
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB!');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
};

const getBrokerAdminCredentials = async () => {
    try {
        console.log('🔍 Fetching Broker Admin Credentials');
        console.log('===============================\n');

        await connectDB();

        // Find all broker employees
        const brokerEmployees = await Employee.find({ organization: 'Broker' })
            .populate(['employeeRole', 'employeeStatus'])
            .lean();

        if (brokerEmployees.length === 0) {
            console.log('⚠️  No broker employees found in the database.');
            console.log('   Run: npm run create-broker-admins');
            await mongoose.connection.close();
            return;
        }

        console.log(`Found ${brokerEmployees.length} broker employee(s):\n`);

        for (const employee of brokerEmployees) {
            const brokerAdmin = await BrokerAdmin.findOne({ userId: employee._id }).lean();

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`👤 Name: ${employee.firstname} ${employee.lastname}`);
            console.log(`📧 Email: ${employee.email}`);
            console.log(`🔑 Password: ${employee._id.toString()}`);
            console.log(`📱 Phone: ${employee.phonenumber}`);
            console.log(`🏢 Organization: ${employee.organization}`);
            console.log(`👔 Role: ${employee.employeeRole?.role || 'N/A'}`);
            console.log(`📊 Status: ${employee.employeeStatus?.status || 'N/A'}`);

            if (brokerAdmin) {
                console.log(`🏛️  Firm: ${brokerAdmin.brokerFirmName}`);
                console.log(`📜 License: ${brokerAdmin.brokerFirmLicense}`);
                console.log(`✅ Broker Admin Status: ${brokerAdmin.status}`);
            } else {
                console.log(`⚠️  No BrokerAdmin profile found`);
            }
            console.log('');
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📝 How to Login:');
        console.log('   1. Go to: /broker-admin/login');
        console.log('   2. Use the Email and Password (ObjectId) shown above');
        console.log('   3. The password is the MongoDB ObjectId of the employee\n');

        await mongoose.connection.close();
        console.log('🔌 Database connection closed.');

    } catch (error) {
        console.error('❌ Error fetching credentials:', error);
        process.exit(1);
    }
};

getBrokerAdminCredentials();

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const { Employee, Status, Role } = require('../models/Employee');
const connectDB = require('../database/connect');

// NIA Admin account configuration
const NIA_ADMIN_CONFIG = {
    firstname: 'NIA',
    lastname: 'Administrator',
    email: 'admin@nia.org.ng',
    phonenumber: '+2348123456788',
    password: 'NIAAdmin@123', // You can change this
    organization: 'NIA'
};

// Additional NIA Admin accounts (optional)
const ADDITIONAL_NIA_ADMINS = [
    {
        firstname: 'John',
        lastname: 'Doe',
        email: 'john.doe@nia.org.ng',
        phonenumber: '+2348123456787',
        password: 'NIAAdmin@456',
        organization: 'NIA'
    },
    {
        firstname: 'Jane',
        lastname: 'Smith',
        email: 'jane.smith@nia.org.ng',
        phonenumber: '+2348123456786',
        password: 'NIAAdmin@789',
        organization: 'NIA'
    }
];

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function ensureRolesAndStatuses() {
    try {
        log('🔧 Ensuring roles and statuses exist...', 'yellow');

        // Check and create Active status if it doesn't exist
        let activeStatus = await Status.findOne({ status: 'Active' });
        if (!activeStatus) {
            activeStatus = await Status.create({ status: 'Active' });
            log('✅ Created Active status', 'green');
        }

        // Check and create NIA-Admin role if it doesn't exist
        let niaAdminRole = await Role.findOne({ role: 'NIA-Admin' });
        if (!niaAdminRole) {
            niaAdminRole = await Role.create({ role: 'NIA-Admin' });
            log('✅ Created NIA-Admin role', 'green');
        }

        // Check and create Admin role if it doesn't exist (fallback)
        let adminRole = await Role.findOne({ role: 'Admin' });
        if (!adminRole) {
            adminRole = await Role.create({ role: 'Admin' });
            log('✅ Created Admin role', 'green');
        }

        return { activeStatus, niaAdminRole, adminRole };

    } catch (error) {
        log(`❌ Error ensuring roles and statuses: ${error.message}`, 'red');
        throw error;
    }
}

async function createNIAAdminAccount(adminConfig, activeStatus, niaAdminRole) {
    try {
        log(`👤 Creating NIA admin account for ${adminConfig.email}...`, 'yellow');

        // Check if admin already exists
        const existingAdmin = await Employee.findOne({ email: adminConfig.email });
        if (existingAdmin) {
            log(`⚠️  NIA admin account already exists for ${adminConfig.email}!`, 'yellow');
            log(`📧 Email: ${existingAdmin.email}`, 'cyan');
            return existingAdmin;
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminConfig.password, salt);

        // Create NIA admin employee using direct insertion to bypass middleware issues
        const adminData = {
            firstname: adminConfig.firstname,
            lastname: adminConfig.lastname,
            email: adminConfig.email,
            phonenumber: adminConfig.phonenumber,
            password: hashedPassword,
            employeeStatus: activeStatus._id,
            employeeRole: niaAdminRole._id,
            organization: adminConfig.organization || 'NIA',
            deleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Insert directly to avoid pre-save middleware issues
        const result = await Employee.collection.insertOne(adminData);

        // Fetch the created admin to return
        const adminEmployee = await Employee.findById(result.insertedId)
            .populate(['employeeRole', 'employeeStatus']);

        log(`✅ NIA admin account created successfully for ${adminConfig.firstname} ${adminConfig.lastname}!`, 'green');
        log(`📧 Email: ${adminConfig.email}`, 'cyan');
        log(`🔑 Password: ${adminConfig.password}`, 'cyan');
        log(`🏢 Organization: ${adminConfig.organization}`, 'cyan');

        return adminEmployee;

    } catch (error) {
        log(`❌ Error creating NIA admin account: ${error.message}`, 'red');
        throw error;
    }
}

async function main() {
    try {
        log('🚀 Creating NIA Admin Accounts', 'bright');
        log('===============================', 'bright');

        // Connect to database
        log('\n🔌 Connecting to database...', 'yellow');
        await connectDB(process.env.MONGO_URI);
        log('✅ Connected to MongoDB!', 'green');

        // Ensure roles and statuses exist
        const { activeStatus, niaAdminRole } = await ensureRolesAndStatuses();

        // Create main NIA admin account
        log('\n📋 Creating Main NIA Admin Account:', 'magenta');
        await createNIAAdminAccount(NIA_ADMIN_CONFIG, activeStatus, niaAdminRole);

        // Create additional NIA admin accounts
        log('\n📋 Creating Additional NIA Admin Accounts:', 'magenta');
        const createdAdmins = [];

        for (const adminConfig of ADDITIONAL_NIA_ADMINS) {
            const admin = await createNIAAdminAccount(adminConfig, activeStatus, niaAdminRole);
            createdAdmins.push(adminConfig);
        }

        log('\n🎉 NIA Admin setup completed!', 'bright');
        log('==============================', 'bright');
        log('\n📝 NIA Admin Login Credentials:', 'yellow');

        // Display main admin credentials
        log('\n🔑 Main NIA Admin:', 'magenta');
        log(`  Email: ${NIA_ADMIN_CONFIG.email}`, 'cyan');
        log(`  Password: ${NIA_ADMIN_CONFIG.password}`, 'cyan');
        log(`  Name: ${NIA_ADMIN_CONFIG.firstname} ${NIA_ADMIN_CONFIG.lastname}`, 'cyan');

        // Display additional admin credentials
        if (createdAdmins.length > 0) {
            log('\n🔑 Additional NIA Admins:', 'magenta');
            createdAdmins.forEach((admin, index) => {
                log(`  Admin ${index + 1}:`, 'yellow');
                log(`    Email: ${admin.email}`, 'cyan');
                log(`    Password: ${admin.password}`, 'cyan');
                log(`    Name: ${admin.firstname} ${admin.lastname}`, 'cyan');
            });
        }

        log('\n📋 Usage Instructions:', 'yellow');
        log('1. Use these credentials to log into the NIA admin dashboard', 'cyan');
        log('2. Access the dashboard at: http://localhost:3000/nia-admin', 'cyan');
        log('3. You can manage user conflict inquiries, processing monitor, and more', 'cyan');
        log('4. Change passwords after first login for security', 'cyan');

    } catch (error) {
        log(`\n💥 Script failed: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    } finally {
        // Close database connection
        await mongoose.connection.close();
        log('\n🔌 Database connection closed.', 'yellow');
        process.exit(0);
    }
}

// Check if script is run directly
if (require.main === module) {
    // Run the script
    main();
}

module.exports = {
    createNIAAdminAccount,
    ensureRolesAndStatuses,
    NIA_ADMIN_CONFIG,
    ADDITIONAL_NIA_ADMINS
};
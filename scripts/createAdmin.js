require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const { Employee, Status, Role } = require('../models/Employee');
const User = require('../models/User');
const connectDB = require('../database/connect');

// Admin account configuration
const ADMIN_CONFIG = {
  firstname: 'Super',
  lastname: 'Admin',
  email: 'admin@ammc.com',
  phonenumber: '+2348123456789',
  password: 'Admin@123' // You can change this
};

// Test user configuration
const TEST_USER_CONFIG = {
  fullname: 'Test User',
  email: 'user@test.com',
  phonenumber: '+2348123456790',
  password: 'User@123'
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
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

    // Check and create Inactive status if it doesn't exist
    let inactiveStatus = await Status.findOne({ status: 'Inactive' });
    if (!inactiveStatus) {
      inactiveStatus = await Status.create({ status: 'Inactive' });
      log('✅ Created Inactive status', 'green');
    }

    // Check and create Super-admin role if it doesn't exist
    let superAdminRole = await Role.findOne({ role: 'Super-admin' });
    if (!superAdminRole) {
      superAdminRole = await Role.create({ role: 'Super-admin' });
      log('✅ Created Super-admin role', 'green');
    }

    // Create other roles if they don't exist
    const roles = ['Admin', 'Staff', 'Surveyor'];
    for (const roleName of roles) {
      const existingRole = await Role.findOne({ role: roleName });
      if (!existingRole) {
        await Role.create({ role: roleName });
        log(`✅ Created ${roleName} role`, 'green');
      }
    }

    return { activeStatus, superAdminRole };

  } catch (error) {
    log(`❌ Error ensuring roles and statuses: ${error.message}`, 'red');
    throw error;
  }
}

async function createAdminAccount(activeStatus, superAdminRole) {
  try {
    log('👤 Creating admin account...', 'yellow');

    // Check if admin already exists
    const existingAdmin = await Employee.findOne({ email: ADMIN_CONFIG.email });
    if (existingAdmin) {
      log('⚠️  Admin account already exists!', 'yellow');
      log(`📧 Email: ${existingAdmin.email}`, 'cyan');
      return existingAdmin;
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_CONFIG.password, salt);

    // Create admin employee using direct insertion to bypass middleware issues
    const adminData = {
      firstname: ADMIN_CONFIG.firstname,
      lastname: ADMIN_CONFIG.lastname,
      email: ADMIN_CONFIG.email,
      phonenumber: ADMIN_CONFIG.phonenumber,
      password: hashedPassword,
      employeeStatus: activeStatus._id,
      employeeRole: superAdminRole._id,
      deleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert directly to avoid pre-save middleware issues
    const result = await Employee.collection.insertOne(adminData);

    // Fetch the created admin to return
    const adminEmployee = await Employee.findById(result.insertedId)
      .populate(['employeeRole', 'employeeStatus']);

    log('✅ Admin account created successfully!', 'green');
    log(`📧 Email: ${ADMIN_CONFIG.email}`, 'cyan');
    log(`🔑 Password: ${ADMIN_CONFIG.password}`, 'cyan');
    log(`👤 Name: ${ADMIN_CONFIG.firstname} ${ADMIN_CONFIG.lastname}`, 'cyan');

    return adminEmployee;

  } catch (error) {
    log(`❌ Error creating admin account: ${error.message}`, 'red');
    throw error;
  }
}

async function createTestUser() {
  try {
    log('\n👤 Creating test user account...', 'yellow');

    // Check if test user already exists
    const existingUser = await User.findOne({ email: TEST_USER_CONFIG.email });
    if (existingUser) {
      log('⚠️  Test user account already exists!', 'yellow');
      log(`📧 Email: ${existingUser.email}`, 'cyan');
      return existingUser;
    }

    // Create test user (password will be hashed by pre-save middleware)
    const testUser = new User({
      fullname: TEST_USER_CONFIG.fullname,
      email: TEST_USER_CONFIG.email,
      phonenumber: TEST_USER_CONFIG.phonenumber,
      password: TEST_USER_CONFIG.password, // Don't hash manually - let pre-save middleware handle it
      isEmailVerified: true // Set as verified for testing
    });

    await testUser.save();

    log('✅ Test user account created successfully!', 'green');
    log(`📧 Email: ${TEST_USER_CONFIG.email}`, 'cyan');
    log(`🔑 Password: ${TEST_USER_CONFIG.password}`, 'cyan');
    log(`👤 Name: ${TEST_USER_CONFIG.fullname}`, 'cyan');

    return testUser;

  } catch (error) {
    log(`❌ Error creating test user account: ${error.message}`, 'red');
    throw error;
  }
}

async function main() {
  try {
    log('🚀 Creating Admin & Test User Accounts', 'bright');
    log('======================================', 'bright');

    // Connect to database
    log('\n🔌 Connecting to database...', 'yellow');
    await connectDB(process.env.MONGO_URI);
    log('✅ Connected to MongoDB!', 'green');

    // Ensure roles and statuses exist
    const { activeStatus, superAdminRole } = await ensureRolesAndStatuses();

    // Create admin account
    await createAdminAccount(activeStatus, superAdminRole);

    // Create test user account
    await createTestUser();

    log('\n🎉 Account setup completed!', 'bright');
    log('============================', 'bright');
    log('\n📝 Login Credentials:', 'yellow');
    log('Admin Account:', 'cyan');
    log(`  Email: ${ADMIN_CONFIG.email}`, 'cyan');
    log(`  Password: ${ADMIN_CONFIG.password}`, 'cyan');
    log('Test User Account:', 'cyan');
    log(`  Email: ${TEST_USER_CONFIG.email}`, 'cyan');
    log(`  Password: ${TEST_USER_CONFIG.password}`, 'cyan');

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

// Run the script
main();
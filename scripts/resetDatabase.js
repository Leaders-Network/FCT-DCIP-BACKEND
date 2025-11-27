require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import models
const { Employee, Status, Role } = require('../models/Employee');
const { User } = require('../models/User');
const PolicyRequest = require('../models/PolicyRequest');
const Assignment = require('../models/Assignment');
const SurveySubmission = require('../models/SurveySubmission');
const Surveyor = require('../models/Surveyor');
const { Property } = require('../models/Property');
const OTP = require('../models/OTP');

const connectDB = require('../database/connect');

// Admin account configuration
const ADMIN_CONFIG = {
  firstname: 'Super',
  lastname: 'Admin',
  email: 'admin@ammc.com',
  phonenumber: '+2348123456789',
  password: 'Admin@123' // You can change this
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function clearDatabase() {
  try {
    log('\n🗑️  Starting database cleanup...', 'yellow');
    
    // Get all collection names
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    log(`Found ${collectionNames.length} collections: ${collectionNames.join(', ')}`, 'cyan');
    
    // Clear all collections
    for (const collectionName of collectionNames) {
      const result = await mongoose.connection.db.collection(collectionName).deleteMany({});
      log(`✅ Cleared ${collectionName}: ${result.deletedCount} documents deleted`, 'green');
    }
    
    log('✅ Database cleanup completed!', 'green');
    
  } catch (error) {
    log(`❌ Error clearing database: ${error.message}`, 'red');
    throw error;
  }
}

async function createRolesAndStatuses() {
  try {
    log('\n🔧 Creating roles and statuses...', 'yellow');
    
    // Create statuses
    const statuses = [
      { status: 'Active' },
      { status: 'Inactive' }
    ];
    
    const createdStatuses = await Status.insertMany(statuses);
    log(`✅ Created ${createdStatuses.length} statuses`, 'green');
    
    // Create roles
    const roles = [
      { role: 'Super-admin' },
      { role: 'Admin' },
      { role: 'Staff' },
      { role: 'Surveyor' }
    ];
    
    const createdRoles = await Role.insertMany(roles);
    log(`✅ Created ${createdRoles.length} roles`, 'green');
    
    return {
      activeStatus: createdStatuses.find(s => s.status === 'Active'),
      superAdminRole: createdRoles.find(r => r.role === 'Super-admin')
    };
    
  } catch (error) {
    log(`❌ Error creating roles and statuses: ${error.message}`, 'red');
    throw error;
  }
}

async function createAdminAccount(activeStatus, superAdminRole) {
  try {
    log('\n👤 Creating admin account...', 'yellow');
    
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

async function createSampleData() {
  try {
    log('\n📊 Creating sample data...', 'yellow');
    
    // You can add sample data creation here if needed
    // For now, we'll just create the basic structure
    
    log('✅ Sample data creation completed!', 'green');
    
  } catch (error) {
    log(`❌ Error creating sample data: ${error.message}`, 'red');
    throw error;
  }
}

async function verifySetup() {
  try {
    log('\n🔍 Verifying setup...', 'yellow');
    
    // Count documents in each collection
    const counts = {
      employees: await Employee.countDocuments(),
      roles: await Role.countDocuments(),
      statuses: await Status.countDocuments(),
      users: await User.countDocuments(),
      policies: await PolicyRequest.countDocuments(),
      assignments: await Assignment.countDocuments(),
      submissions: await SurveySubmission.countDocuments(),
      surveyors: await Surveyor.countDocuments()
    };
    
    log('📊 Database Summary:', 'cyan');
    Object.entries(counts).forEach(([collection, count]) => {
      log(`   ${collection}: ${count} documents`, 'cyan');
    });
    
    // Verify admin account
    const adminAccount = await Employee.findOne({ email: ADMIN_CONFIG.email })
      .populate(['employeeRole', 'employeeStatus']);
    
    if (adminAccount) {
      log('\n✅ Admin account verification:', 'green');
      log(`   Name: ${adminAccount.firstname} ${adminAccount.lastname}`, 'green');
      log(`   Email: ${adminAccount.email}`, 'green');
      log(`   Role: ${adminAccount.employeeRole.role}`, 'green');
      log(`   Status: ${adminAccount.employeeStatus.status}`, 'green');
    } else {
      log('❌ Admin account not found!', 'red');
    }
    
  } catch (error) {
    log(`❌ Error verifying setup: ${error.message}`, 'red');
    throw error;
  }
}

async function main() {
  try {
    log('🚀 Starting Database Reset Script', 'bright');
    log('=====================================', 'bright');
    
    // Connect to database
    log('\n🔌 Connecting to database...', 'yellow');
    await connectDB(process.env.MONGO_URI);
    log('✅ Connected to MongoDB!', 'green');
    
    // Clear database
    await clearDatabase();
    
    // Create roles and statuses
    const { activeStatus, superAdminRole } = await createRolesAndStatuses();
    
    // Create admin account
    await createAdminAccount(activeStatus, superAdminRole);
    
    // Create sample data (optional)
    await createSampleData();
    
    // Verify setup
    await verifySetup();
    
    log('\n🎉 Database reset completed successfully!', 'bright');
    log('=====================================', 'bright');
    log('\n📝 Next Steps:', 'yellow');
    log('1. Start your backend server', 'cyan');
    log('2. Login with the admin credentials above', 'cyan');
    log('3. Create additional users as needed', 'cyan');
    
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

// Handle script arguments
const args = process.argv.slice(2);
const skipConfirmation = args.includes('--force') || args.includes('-f');

if (!skipConfirmation) {
  log('⚠️  WARNING: This script will completely clear your database!', 'red');
  log('All existing data will be permanently deleted.', 'red');
  log('\nTo proceed, run: node scripts/resetDatabase.js --force', 'yellow');
  process.exit(0);
}

// Run the script
main();
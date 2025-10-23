require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../database/connect');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function migrateFields() {
  try {
    log('🔄 Starting field migration: policyId → ammcId', 'yellow');

    // Migrate assignments collection
    log('\n📋 Migrating assignments collection...', 'cyan');
    const assignmentsResult = await mongoose.connection.db.collection('assignments').updateMany(
      { policyId: { $exists: true } },
      { $rename: { "policyId": "ammcId" } }
    );
    log(`✅ Assignments: ${assignmentsResult.modifiedCount} documents updated`, 'green');

    // Migrate surveysubmissions collection
    log('\n📝 Migrating surveysubmissions collection...', 'cyan');
    const submissionsResult = await mongoose.connection.db.collection('surveysubmissions').updateMany(
      { policyId: { $exists: true } },
      { $rename: { "policyId": "ammcId" } }
    );
    log(`✅ Survey Submissions: ${submissionsResult.modifiedCount} documents updated`, 'green');

    // Check for any remaining policyId fields in other collections
    log('\n🔍 Checking for remaining policyId fields...', 'cyan');

    const collections = await mongoose.connection.db.listCollections().toArray();
    let foundOtherFields = false;

    for (const collection of collections) {
      const collectionName = collection.name;
      if (collectionName === 'assignments' || collectionName === 'surveysubmissions') {
        continue; // Skip already processed collections
      }

      const count = await mongoose.connection.db.collection(collectionName).countDocuments({
        policyId: { $exists: true }
      });

      if (count > 0) {
        log(`⚠️  Found ${count} documents with policyId in ${collectionName}`, 'yellow');
        foundOtherFields = true;
      }
    }

    if (!foundOtherFields) {
      log('✅ No other policyId fields found in database', 'green');
    }

    // Verify migration
    log('\n🔍 Verifying migration...', 'cyan');

    const assignmentsWithAmmcId = await mongoose.connection.db.collection('assignments').countDocuments({
      ammcId: { $exists: true }
    });

    const submissionsWithAmmcId = await mongoose.connection.db.collection('surveysubmissions').countDocuments({
      ammcId: { $exists: true }
    });

    const assignmentsWithPolicyId = await mongoose.connection.db.collection('assignments').countDocuments({
      policyId: { $exists: true }
    });

    const submissionsWithPolicyId = await mongoose.connection.db.collection('surveysubmissions').countDocuments({
      policyId: { $exists: true }
    });

    log('\n📊 Migration Summary:', 'bright');
    log(`   Assignments with ammcId: ${assignmentsWithAmmcId}`, 'green');
    log(`   Assignments with policyId: ${assignmentsWithPolicyId}`, assignmentsWithPolicyId > 0 ? 'red' : 'green');
    log(`   Submissions with ammcId: ${submissionsWithAmmcId}`, 'green');
    log(`   Submissions with policyId: ${submissionsWithPolicyId}`, submissionsWithPolicyId > 0 ? 'red' : 'green');

    if (assignmentsWithPolicyId === 0 && submissionsWithPolicyId === 0) {
      log('\n🎉 Migration completed successfully!', 'bright');
    } else {
      log('\n⚠️  Migration may not be complete. Some policyId fields still exist.', 'yellow');
    }

  } catch (error) {
    log(`❌ Migration failed: ${error.message}`, 'red');
    throw error;
  }
}

async function main() {
  try {
    log('🚀 Field Migration Script', 'bright');
    log('========================', 'bright');
    log('This script migrates policyId fields to ammcId', 'cyan');

    // Connect to database
    log('\n🔌 Connecting to database...', 'yellow');
    await connectDB(process.env.MONGO_URI);
    log('✅ Connected to MongoDB!', 'green');

    // Run migration
    await migrateFields();

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
  log('⚠️  This script will rename policyId fields to ammcId in your database.', 'yellow');
  log('Make sure you have a backup before proceeding.', 'yellow');
  log('\nTo proceed, run: node scripts/migrateFields.js --force', 'cyan');
  process.exit(0);
}

// Run the script
main();
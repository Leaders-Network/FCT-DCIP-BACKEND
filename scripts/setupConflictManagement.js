require('dotenv').config();
const mongoose = require('mongoose');
const UserConflictInquiry = require('../models/UserConflictInquiry');
const AutomaticConflictFlag = require('../models/AutomaticConflictFlag');
const Assignment = require('../models/Assignment');
const SurveySubmission = require('../models/SurveySubmission');

const connectDB = require('../database/connect');

async function setupConflictManagement() {
    try {
        console.log('🚀 Starting conflict management setup...');

        // Connect to database
        await connectDB(process.env.MONGO_URI);
        console.log('✅ Connected to database');

        // Ensure indexes are created for UserConflictInquiry
        console.log('📊 Creating indexes for UserConflictInquiry...');
        await UserConflictInquiry.createIndexes();
        console.log('✅ UserConflictInquiry indexes created');

        // Ensure indexes are created for AutomaticConflictFlag
        console.log('📊 Creating indexes for AutomaticConflictFlag...');
        await AutomaticConflictFlag.createIndexes();
        console.log('✅ AutomaticConflictFlag indexes created');

        // Add organization field to existing assignments if not present
        console.log('🔄 Updating existing assignments with organization field...');
        const assignmentUpdateResult = await Assignment.updateMany(
            { organization: { $exists: false } },
            { $set: { organization: 'AMMC' } }
        );
        console.log(`✅ Updated ${assignmentUpdateResult.modifiedCount} assignments with organization field`);

        // Add organization field to existing survey submissions if not present
        console.log('🔄 Updating existing survey submissions with organization field...');
        const submissionUpdateResult = await SurveySubmission.updateMany(
            { organization: { $exists: false } },
            { $set: { organization: 'AMMC', is_merged: false } }
        );
        console.log(`✅ Updated ${submissionUpdateResult.modifiedCount} survey submissions with organization field`);

        // Create sample conflict inquiry statuses for testing (optional)
        console.log('📝 Setting up conflict inquiry reference ID sequence...');

        // Verify that the pre-save middleware for reference ID generation works
        const testInquiry = new UserConflictInquiry({
            policyId: new mongoose.Types.ObjectId(),
            mergedReportId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId(),
            conflictType: 'test',
            description: 'Test inquiry for setup verification',
            userContact: {
                email: 'test@example.com'
            }
        });

        // Don't save, just validate the reference ID generation
        await testInquiry.validate();
        console.log(`✅ Reference ID generation working: ${testInquiry.referenceId}`);

        console.log('🎉 Conflict management setup completed successfully!');
        console.log('\n📋 Summary:');
        console.log('- UserConflictInquiry model indexes created');
        console.log('- AutomaticConflictFlag model indexes created');
        console.log(`- ${assignmentUpdateResult.modifiedCount} assignments updated with organization field`);
        console.log(`- ${submissionUpdateResult.modifiedCount} survey submissions updated with organization field`);
        console.log('- Reference ID generation verified');

        console.log('\n🔧 Next steps:');
        console.log('1. Update your frontend to use the new conflict management APIs');
        console.log('2. Configure email settings in your .env file for notifications');
        console.log('3. Test the conflict inquiry submission and admin response workflow');
        console.log('4. Test the automatic conflict detection system');

    } catch (error) {
        console.error('❌ Error during conflict management setup:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
}

// Run the setup if this script is executed directly
if (require.main === module) {
    setupConflictManagement();
}

module.exports = setupConflictManagement;
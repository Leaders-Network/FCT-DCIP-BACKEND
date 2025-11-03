const mongoose = require('mongoose');
const DualAssignment = require('../models/DualAssignment');

async function cleanupDualAssignments() {
    try {
        console.log('🧹 Starting cleanup of dual assignments...');

        // Load environment variables
        require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

        // Connect to database
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fct-dcip-local';
        console.log('🔗 Connecting to:', uri.includes('mongodb+srv') ? 'MongoDB Atlas' : 'Local MongoDB');
        await mongoose.connect(uri);
        console.log('📊 Connected to database');

        // Find all dual assignments
        const assignments = await DualAssignment.find({});
        console.log(`📋 Found ${assignments.length} dual assignments`);

        let updatedCount = 0;

        for (const assignment of assignments) {
            let needsUpdate = false;

            // Check if ammcSurveyorContact is an empty object
            if (assignment.ammcSurveyorContact &&
                typeof assignment.ammcSurveyorContact === 'object' &&
                Object.keys(assignment.ammcSurveyorContact).length === 0) {
                assignment.ammcSurveyorContact = null;
                needsUpdate = true;
                console.log(`🔧 Cleaning empty ammcSurveyorContact for assignment ${assignment._id}`);
            }

            // Check if niaSurveyorContact is an empty object
            if (assignment.niaSurveyorContact &&
                typeof assignment.niaSurveyorContact === 'object' &&
                Object.keys(assignment.niaSurveyorContact).length === 0) {
                assignment.niaSurveyorContact = null;
                needsUpdate = true;
                console.log(`🔧 Cleaning empty niaSurveyorContact for assignment ${assignment._id}`);
            }

            // Check if ammcSurveyorContact has no meaningful data
            if (assignment.ammcSurveyorContact &&
                !assignment.ammcSurveyorContact.name &&
                !assignment.ammcSurveyorContact.email &&
                !assignment.ammcSurveyorContact.surveyorId) {
                assignment.ammcSurveyorContact = null;
                needsUpdate = true;
                console.log(`🔧 Cleaning meaningless ammcSurveyorContact for assignment ${assignment._id}`);
            }

            // Check if niaSurveyorContact has no meaningful data
            if (assignment.niaSurveyorContact &&
                !assignment.niaSurveyorContact.name &&
                !assignment.niaSurveyorContact.email &&
                !assignment.niaSurveyorContact.surveyorId) {
                assignment.niaSurveyorContact = null;
                needsUpdate = true;
                console.log(`🔧 Cleaning meaningless niaSurveyorContact for assignment ${assignment._id}`);
            }

            if (needsUpdate) {
                await assignment.save();
                updatedCount++;
            }
        }

        console.log(`✅ Cleanup completed! Updated ${updatedCount} assignments`);

        // Show current state
        console.log('\n📊 Current assignment states:');
        const updatedAssignments = await DualAssignment.find({});
        updatedAssignments.forEach((assignment, index) => {
            console.log(`Assignment ${index + 1}:`, {
                id: assignment._id.toString().slice(-6),
                assignmentStatus: assignment.assignmentStatus,
                hasAMMC: !!assignment.ammcSurveyorContact,
                hasNIA: !!assignment.niaSurveyorContact,
                ammcName: assignment.ammcSurveyorContact?.name || 'None',
                niaName: assignment.niaSurveyorContact?.name || 'None'
            });
        });

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📊 Disconnected from database');
    }
}

// Run if called directly
if (require.main === module) {
    cleanupDualAssignments();
}

module.exports = { cleanupDualAssignments };
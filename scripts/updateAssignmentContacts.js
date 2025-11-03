const mongoose = require('mongoose');
const Assignment = require('../models/Assignment');
const DualAssignment = require('../models/DualAssignment');
const AssignmentContactService = require('../services/AssignmentContactService');

/**
 * Script to update all existing assignments with partner contact information
 */
async function updateAllAssignmentContacts() {
    try {
        console.log('Starting assignment contact update process...');

        // Find all assignments that are part of dual assignments but missing partner contact info
        const assignmentsToUpdate = await Assignment.find({
            dualAssignmentId: { $exists: true, $ne: null },
            $or: [
                { partnerSurveyorContact: { $exists: false } },
                { 'partnerSurveyorContact.email': { $exists: false } },
                { 'partnerSurveyorContact.licenseNumber': { $exists: false } }
            ]
        });

        console.log(`Found ${assignmentsToUpdate.length} assignments to update`);

        let updatedCount = 0;
        let errorCount = 0;

        for (const assignment of assignmentsToUpdate) {
            try {
                console.log(`Updating assignment ${assignment._id}...`);

                // Get the dual assignment
                const dualAssignment = await DualAssignment.findById(assignment.dualAssignmentId);

                if (!dualAssignment) {
                    console.log(`Dual assignment not found for assignment ${assignment._id}`);
                    continue;
                }

                // Determine partner contact based on organization
                const currentOrganization = assignment.organization || 'AMMC';
                const partnerContact = currentOrganization === 'AMMC'
                    ? dualAssignment.niaSurveyorContact
                    : dualAssignment.ammcSurveyorContact;

                if (partnerContact && partnerContact.surveyorId) {
                    // Update assignment with partner contact info
                    await AssignmentContactService.updateAssignmentWithPartnerContact(
                        assignment._id,
                        partnerContact
                    );

                    updatedCount++;
                    console.log(`✓ Updated assignment ${assignment._id} with partner contact info`);
                } else {
                    console.log(`No partner contact available for assignment ${assignment._id}`);
                }
            } catch (error) {
                console.error(`Error updating assignment ${assignment._id}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n=== Update Summary ===');
        console.log(`Total assignments processed: ${assignmentsToUpdate.length}`);
        console.log(`Successfully updated: ${updatedCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('Assignment contact update process completed.');

        return {
            processed: assignmentsToUpdate.length,
            updated: updatedCount,
            errors: errorCount
        };
    } catch (error) {
        console.error('Error in updateAllAssignmentContacts:', error);
        throw error;
    }
}

/**
 * Update contact information for all dual assignments
 */
async function updateAllDualAssignmentContacts() {
    try {
        console.log('Starting dual assignment contact update process...');

        // Find all dual assignments
        const dualAssignments = await DualAssignment.find({});
        console.log(`Found ${dualAssignments.length} dual assignments to check`);

        let updatedCount = 0;
        let errorCount = 0;

        for (const dualAssignment of dualAssignments) {
            try {
                let needsUpdate = false;

                // Check if AMMC contact needs updating
                if (dualAssignment.ammcSurveyorContact && dualAssignment.ammcSurveyorContact.surveyorId) {
                    const ammcContact = dualAssignment.ammcSurveyorContact;
                    if (!ammcContact.licenseNumber || !ammcContact.specialization || !ammcContact.experience) {
                        needsUpdate = true;
                    }
                }

                // Check if NIA contact needs updating
                if (dualAssignment.niaSurveyorContact && dualAssignment.niaSurveyorContact.surveyorId) {
                    const niaContact = dualAssignment.niaSurveyorContact;
                    if (!niaContact.licenseNumber || !niaContact.specialization || !niaContact.experience) {
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    console.log(`Updating dual assignment ${dualAssignment._id}...`);

                    // Update AMMC contact if exists
                    if (dualAssignment.ammcSurveyorContact && dualAssignment.ammcSurveyorContact.surveyorId) {
                        try {
                            const updatedContact = await AssignmentContactService.getSurveyorContactInfo(
                                dualAssignment.ammcSurveyorContact.surveyorId,
                                'AMMC'
                            );
                            dualAssignment.ammcSurveyorContact = {
                                ...dualAssignment.ammcSurveyorContact,
                                ...updatedContact
                            };
                        } catch (error) {
                            console.error(`Error updating AMMC contact for dual assignment ${dualAssignment._id}:`, error.message);
                        }
                    }

                    // Update NIA contact if exists
                    if (dualAssignment.niaSurveyorContact && dualAssignment.niaSurveyorContact.surveyorId) {
                        try {
                            const updatedContact = await AssignmentContactService.getSurveyorContactInfo(
                                dualAssignment.niaSurveyorContact.surveyorId,
                                'NIA'
                            );
                            dualAssignment.niaSurveyorContact = {
                                ...dualAssignment.niaSurveyorContact,
                                ...updatedContact
                            };
                        } catch (error) {
                            console.error(`Error updating NIA contact for dual assignment ${dualAssignment._id}:`, error.message);
                        }
                    }

                    await dualAssignment.save();
                    updatedCount++;
                    console.log(`✓ Updated dual assignment ${dualAssignment._id}`);
                }
            } catch (error) {
                console.error(`Error updating dual assignment ${dualAssignment._id}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n=== Dual Assignment Update Summary ===');
        console.log(`Total dual assignments processed: ${dualAssignments.length}`);
        console.log(`Successfully updated: ${updatedCount}`);
        console.log(`Errors: ${errorCount}`);

        return {
            processed: dualAssignments.length,
            updated: updatedCount,
            errors: errorCount
        };
    } catch (error) {
        console.error('Error in updateAllDualAssignmentContacts:', error);
        throw error;
    }
}

// If running directly
if (require.main === module) {
    const connectDB = require('../database/connectWithRetry');

    connectDB().then(async () => {
        try {
            console.log('Connected to database. Starting contact update process...\n');

            // Update dual assignments first
            await updateAllDualAssignmentContacts();

            console.log('\n' + '='.repeat(50) + '\n');

            // Then update individual assignments
            await updateAllAssignmentContacts();

            console.log('\nAll contact updates completed successfully!');
            process.exit(0);
        } catch (error) {
            console.error('Script failed:', error);
            process.exit(1);
        }
    }).catch(error => {
        console.error('Database connection failed:', error);
        process.exit(1);
    });
}

module.exports = {
    updateAllAssignmentContacts,
    updateAllDualAssignmentContacts
};
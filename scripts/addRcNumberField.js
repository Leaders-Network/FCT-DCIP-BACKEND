const mongoose = require('mongoose');
require('dotenv').config();

const PolicyRequest = require('../models/PolicyRequest');

const addRcNumberField = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to database successfully');

        console.log('Adding RC number field to existing policy requests...');

        // Update all existing policy requests to add rcNumber field with a default value
        const result = await PolicyRequest.updateMany(
            { 'contactDetails.rcNumber': { $exists: false } },
            {
                $set: {
                    'contactDetails.rcNumber': 'RC000000' // Default placeholder value
                }
            }
        );

        console.log(`Updated ${result.modifiedCount} policy requests with RC number field`);

        // Get count of all policies to verify
        const totalPolicies = await PolicyRequest.countDocuments();
        console.log(`Total policy requests in database: ${totalPolicies}`);

        console.log('Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Database connection closed');
    }
};

// Run the migration
if (require.main === module) {
    addRcNumberField();
}

module.exports = addRcNumberField;
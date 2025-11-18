const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const clearPolicyRequests = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const result = await mongoose.connection.db.collection('policyrequests').deleteMany({});
        console.log(`✅ Deleted ${result.deletedCount} policy requests from database`);

        await mongoose.connection.close();
        console.log('Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error clearing policy requests:', error);
        process.exit(1);
    }
};

clearPolicyRequests();

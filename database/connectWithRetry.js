const mongoose = require('mongoose');

mongoose.set('strictQuery', false);

async function connectWithRetry(uri, opts = {}) {
    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            await mongoose.connect(uri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferMaxEntries: 0,
                bufferCommands: false,
                heartbeatFrequencyMS: 10000,
                maxIdleTimeMS: 30000,
                ...opts
            });

            console.log(`✅ MongoDB connected successfully to: ${uri.replace(/\/\/.*@/, '//***:***@')}`);

            // Handle connection events
            mongoose.connection.on('error', (err) => {
                console.error('❌ MongoDB connection error:', err.message);
            });

            mongoose.connection.on('disconnected', () => {
                console.warn('⚠️ MongoDB disconnected');
                // Attempt to reconnect after a short delay
                setTimeout(() => {
                    console.log('🔄 Attempting to reconnect to MongoDB...');
                    connectWithRetry(uri, opts).catch(err => {
                        console.error('❌ Reconnection failed:', err.message);
                    });
                }, 5000);
            });

            mongoose.connection.on('reconnected', () => {
                console.log('🔄 MongoDB reconnected');
            });

            mongoose.connection.on('close', () => {
                console.warn('🔌 MongoDB connection closed');
            });

            return mongoose.connection;

        } catch (err) {
            retryCount++;
            console.error(`❌ MongoDB connection attempt ${retryCount}/${maxRetries} failed:`, err.message);

            if (retryCount >= maxRetries) {
                console.error('💥 All MongoDB connection attempts failed. Exiting...');

                // Provide helpful error messages based on error type
                if (err.message.includes('ECONNREFUSED')) {
                    console.error(`
🔧 TROUBLESHOOTING TIPS:
1. If using local MongoDB:
   - Install MongoDB: https://www.mongodb.com/try/download/community
   - Start MongoDB service: net start MongoDB
   - Or run manually: mongod --dbpath "C:\\data\\db"

2. If using MongoDB Atlas:
   - Check your internet connection
   - Verify the connection string is correct
   - Ensure your IP is whitelisted in Atlas

3. Current connection string: ${uri.replace(/\/\/.*@/, '//***:***@')}
                    `);
                } else if (err.message.includes('ESERVFAIL') || err.message.includes('ENOTFOUND')) {
                    console.error(`
🌐 DNS/NETWORK ISSUE:
1. Check your internet connection
2. Try different DNS servers (8.8.8.8, 1.1.1.1)
3. If using Atlas, check MongoDB Atlas status page
4. Consider using local MongoDB for development
                    `);
                }

                process.exit(1);
            }

            // Wait before retrying (exponential backoff)
            const delay = Math.pow(2, retryCount) * 1000;
            console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

module.exports = connectWithRetry;
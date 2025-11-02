require('dotenv').config();
const jwt = require('jsonwebtoken');

// Get the token from command line argument
const token = process.argv[2];

if (!token) {
    console.log('Usage: node debugToken.js <token>');
    process.exit(1);
}

try {
    // Decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded successfully:');
    console.log(JSON.stringify(decoded, null, 2));
} catch (error) {
    console.error('Token decode error:', error.message);
}
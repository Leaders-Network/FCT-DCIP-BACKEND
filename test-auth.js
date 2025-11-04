const jwt = require('jsonwebtoken');
require('dotenv').config();

// Test token verification
const testToken = process.argv[2];

if (!testToken) {
    console.log('Usage: node test-auth.js <token>');
    console.log('Please provide a token to test');
    process.exit(1);
}

try {
    const payload = jwt.verify(testToken, process.env.JWT_SECRET);
    console.log('Token is valid!');
    console.log('Payload:', payload);
} catch (error) {
    console.log('Token is invalid:', error.message);
}
// Test script for settings endpoints
const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api/v1';
const API_KEY = '4a8612b0162373aff93c2088780b42e77d06b22b9906a58f5940054b192695134262a4c481b9713426922f29b7bd44ea64dcc6e13a3d22d0f7d05044e9ca626c';

// Replace with a valid token from your browser's localStorage
const USER_TOKEN = 'YOUR_TOKEN_HERE';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
        'Authorization': `Bearer ${USER_TOKEN}`
    }
});

async function testSettings() {
    try {
        console.log('Testing GET /settings/profile...');
        const profileResponse = await api.get('/settings/profile');
        console.log('✅ Profile fetched:', profileResponse.data);

        console.log('\nTesting PATCH /settings/profile...');
        const updateResponse = await api.patch('/settings/profile', {
            firstname: 'Test',
            lastname: 'User',
            email: 'test@example.com',
            phonenumber: '1234567890'
        });
        console.log('✅ Profile updated:', updateResponse.data);

        console.log('\nTesting POST /settings/change-password...');
        const passwordResponse = await api.post('/settings/change-password', {
            currentPassword: 'oldpassword',
            newPassword: 'newpassword123',
            confirmPassword: 'newpassword123'
        });
        console.log('✅ Password changed:', passwordResponse.data);

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testSettings();

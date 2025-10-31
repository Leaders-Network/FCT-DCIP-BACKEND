// Simple test to verify server can start without import errors
require('dotenv').config();

console.log('🧪 Testing server imports...');

try {
    // Test all the route imports
    const userConflictInquiriesRouter = require('../routes/userConflictInquiries');
    console.log('✅ userConflictInquiries route imported successfully');

    const automaticConflictFlagsRouter = require('../routes/automaticConflictFlags');
    console.log('✅ automaticConflictFlags route imported successfully');

    const processingMonitorRouter = require('../routes/processingMonitor');
    console.log('✅ processingMonitor route imported successfully');

    const adminDashboardEnhancedRouter = require('../routes/adminDashboardEnhanced');
    console.log('✅ adminDashboardEnhanced route imported successfully');

    // Test middleware imports
    const { protect, restrictTo } = require('../middlewares/authentication');
    console.log('✅ authentication middleware imported successfully');

    // Test model imports
    const UserConflictInquiry = require('../models/UserConflictInquiry');
    console.log('✅ UserConflictInquiry model imported successfully');

    const AutomaticConflictFlag = require('../models/AutomaticConflictFlag');
    console.log('✅ AutomaticConflictFlag model imported successfully');

    const MergedReport = require('../models/MergedReport');
    console.log('✅ MergedReport model imported successfully');

    const DualAssignment = require('../models/DualAssignment');
    console.log('✅ DualAssignment model imported successfully');

    // Test email service
    const { sendEmail } = require('../utils/emailService');
    console.log('✅ emailService imported successfully');

    console.log('\n🎉 All imports successful! Server should start without errors.');
    console.log('\n📋 Available API endpoints:');
    console.log('- /api/v1/user-conflict-inquiries');
    console.log('- /api/v1/automatic-conflict-flags');
    console.log('- /api/v1/processing-monitor');
    console.log('- /api/v1/admin/dashboard-enhanced');

} catch (error) {
    console.error('❌ Import error:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}
require('dotenv').config();
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
require('express-async-errors');
const connectWithRetry = require('./database/connectWithRetry');
const express = require("express")
const authRouter = require('./routes/auth');
const filesRouter = require('./routes/files');
const surveyorRouter = require('./routes/surveyor');
const policyRouter = require('./routes/policy');
const propertyRouter = require('./routes/property');
const adminSurveyorRouter = require('./routes/adminSurveyor');
const adminAssignmentRouter = require('./routes/adminAssignment');
const adminDashboardRouter = require('./routes/adminDashboard');
const adminPolicyRouter = require('./routes/adminPolicy');
const adminPropertyRouter = require('./routes/adminProperty');
const adminAdministratorRouter = require('./routes/adminAdministrator');
const adminEmployeeRouter = require('./routes/adminEmployee');
const surveyDocumentsRouter = require('./routes/surveyDocuments');
const assignmentRouter = require('./routes/assignment');
const submissionRouter = require('./routes/submission');
const dualAssignmentRouter = require('./routes/dualAssignment');
const niaAdminRouter = require('./routes/niaAdmin');
const brokerAdminRouter = require('./routes/brokerAdmin');
const userConflictInquiriesRouter = require('./routes/userConflictInquiries');
const reportReleaseRouter = require('./routes/reportRelease');
const automaticConflictFlagsRouter = require('./routes/automaticConflictFlags');
const processingMonitorRouter = require('./routes/processingMonitor');
const reportMergingRouter = require('./routes/reportMerging');
const scheduledProcessorRouter = require('./routes/scheduledProcessor');
const policyStatusRouter = require('./routes/policyStatus');
const paymentDecisionRouter = require('./routes/paymentDecision');
const userReportsRouter = require('./routes/userReports');
const testMergedReportsRouter = require('./routes/testMergedReports');
const debugMergedReportsRouter = require('./routes/debugMergedReports');
const quickTestRouter = require('./routes/quickTest');
const diagnosticReportsRouter = require('./routes/diagnosticReports');
const manualReportProcessingRouter = require('./routes/manualReportProcessing');
const claimsRouter = require('./routes/claims');
const notificationsRouter = require('./routes/notifications');
const notFoundMiddleware = require('./middlewares/not-found');
const errorHandlerMiddleware = require('./middlewares/error-handler');
const cors = require('cors');
const { createStatuses, createRoles, createPropertyCategories, createSurveyorRoles, createFirstSuperAdmin } = require('./controllers/auth')
const scheduledProcessor = require('./services/ScheduledReportProcessor');
const { compressionMiddleware, requestTiming } = require('./middlewares/performance');

const app = express()

// Add compression for better performance
app.use(compressionMiddleware);

// Add request timing for monitoring
app.use(requestTiming);

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://www.fctbuilders.gladfaith.com',
      'https://fctbuilders.gladfaith.com',
      'https://Builders-Liability-AMMC-frontend-ten.vercel.app',
      'https://Builders-Liability-AMMC-frontend-h440cotuv.vercel.app',
      'https://Builders-Liability-AMMC-frontend-83mrqo57b.vercel.app',
    ];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    const cleanedOrigin = origin.toLowerCase();

    if (allowedOrigins.includes(cleanedOrigin)) {
      return callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      return callback(null, true); // Allow all origins for now to debug
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ["Content-Type", "Authorization", 'apikey', 'x-api-key'],
  credentials: true,
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  preflightContinue: false,
}

// Handle preflight requests explicitly
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/files', filesRouter);
app.use('/api/v1/surveyor', surveyorRouter);
app.use('/api/v1/policy', policyRouter);
app.use('/api/v1/property', propertyRouter);
app.use('/api/v1/admin/surveyor', adminSurveyorRouter);
app.use('/api/v1/admin/assignment', adminAssignmentRouter);
app.use('/api/v1/admin/dashboard', adminDashboardRouter);
app.use('/api/v1/admin/policy', adminPolicyRouter);
app.use('/api/v1/admin/property', adminPropertyRouter);
app.use('/api/v1/admin/administrators', adminAdministratorRouter);
app.use('/api/v1/admin/employees', adminEmployeeRouter);
app.use('/api/v1/survey-documents', surveyDocumentsRouter);
app.use('/api/v1/assignment', assignmentRouter);
app.use('/api/v1/submission', submissionRouter);
app.use('/api/v1/dual-assignment', dualAssignmentRouter);
app.use('/api/v1/nia-admin', niaAdminRouter);
app.use('/api/v1/broker-admin', brokerAdminRouter);
app.use('/api/v1/user-conflict-inquiries', userConflictInquiriesRouter);
app.use('/api/v1/report-release', reportReleaseRouter);
app.use('/api/v1/automatic-conflict-flags', automaticConflictFlagsRouter);
app.use('/api/v1/processing-monitor', processingMonitorRouter);
app.use('/api/v1/report-merging', reportMergingRouter);
app.use('/api/v1/scheduled-processor', scheduledProcessorRouter);
app.use('/api/v1/policy-status', policyStatusRouter);
app.use('/api/v1/payment-decision', paymentDecisionRouter);
app.use('/api/v1/user-reports', userReportsRouter);
app.use('/api/v1/test-merged-reports', testMergedReportsRouter);
app.use('/api/v1/debug-merged-reports', debugMergedReportsRouter);
app.use('/api/v1/quick-test', quickTestRouter);
app.use('/api/v1/diagnostic-reports', diagnosticReportsRouter);
app.use('/api/v1/manual-processing', manualReportProcessingRouter);
app.use('/api/v1/claims', claimsRouter);
app.use('/api/v1/notifications', notificationsRouter);

// Authentication testing routes
const authTestRouter = require('./routes/authTest');
app.use('/api/v1/auth-test', authTestRouter);

// Email testing route
const testEmailRouter = require('./routes/testEmail');
app.use('/api/v1/test-email', testEmailRouter);

app.get('/', (_req, res) => { res.send('<h3>Builders-Liability-AMMC API Server</h3>') })

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);


const PORT = process.env.PORT || 5000
const start = async () => {
  try {
    // Connect to MongoDB with retry logic
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/Builders-Liability-AMMC-local';
    await connectWithRetry(uri);

    // Initialize database data
    await createStatuses();
    await createRoles();
    await createPropertyCategories();
    await createSurveyorRoles();
    await createFirstSuperAdmin();

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server is listening on port ${PORT}...`);
      console.log(`📊 Admin Dashboard: http://localhost:${PORT}/api/v1`);

      // Start the scheduled report processor
      scheduledProcessor.start();
    });
  } catch (error) {
    console.error('💥 Failed to start server:', error.message);
    process.exit(1);
  }
};

start();
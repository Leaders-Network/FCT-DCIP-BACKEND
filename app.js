require('dotenv').config();
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
require('express-async-errors');
const connectDB = require('./database/connect');
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
const notFoundMiddleware = require('./middlewares/not-found');
const errorHandlerMiddleware = require('./middlewares/error-handler');
const helmet = require('helmet');
const cors = require('cors');
const rateLimiter = require('express-rate-limit');
const { createStatuses, createRoles, createPropertyCategories, createSurveyorRoles, createFirstSuperAdmin } = require('./controllers/auth')

const app = express()

const corsOptions = {
  origin: [
    'http://localhost:3000',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ["Content-Type", "Authorization",'x-api-key'],
  credentials: true,
}
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); 

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
app.get('/', (req, res) => { res.send('<h3>DEPLOYED !</h3>') })

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);


const PORT = process.env.PORT || 5000
const start = async () => {
    try {
      await connectDB(process.env.MONGO_URI);
      await createStatuses()
      await createRoles()
      await createPropertyCategories()
      await createSurveyorRoles()
      await createFirstSuperAdmin()
      app.listen(PORT, () =>
        console.log(`Server is listening on port ${PORT}...`)
      );
    } catch (error) {
      console.log(error);
    }
};
  
start();
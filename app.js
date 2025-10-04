require('dotenv').config();
require('express-async-errors');
const connectDB = require('./database/connect');
const express = require("express")
const authRouter = require('./routes/auth');
const filesRouter = require('./routes/files');
const surveyorRouter = require('./routes/surveyor');
const policyRouter = require('./routes/policy');
const adminSurveyorRouter = require('./routes/adminSurveyor');
const adminAssignmentRouter = require('./routes/adminAssignment');
const adminDashboardRouter = require('./routes/adminDashboard');
const surveyDocumentsRouter = require('./routes/surveyDocuments');
const notFoundMiddleware = require('./middlewares/not-found');
const errorHandlerMiddleware = require('./middlewares/error-handler');
const helmet = require('helmet');
const cors = require('cors');
const rateLimiter = require('express-rate-limit');
const { createStatuses, createRoles, createPropertyCategories, createSurveyorRoles, createFirstSuperAdmin } = require('./controllers/auth')

const app = express()
app.use(express.json());



app.set('trust proxy', 1);
app.use(
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })
);
app.use(express.json());
app.use(helmet());

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: '*',
  credentials: true,
}
app.use(cors());

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/files', filesRouter);
app.use('/api/v1/surveyor', surveyorRouter);
app.use('/api/v1/policy', policyRouter);
app.use('/api/v1/admin/surveyor', adminSurveyorRouter);
app.use('/api/v1/admin/assignment', adminAssignmentRouter);
app.use('/api/v1/admin/dashboard', adminDashboardRouter);
app.use('/api/v1/survey-documents', surveyDocumentsRouter);
app.get('/', (req, res) => { res.send('<h3>DEPLOYED !</h3>') })

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);


const PORT = process.env.PORT || 3000
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
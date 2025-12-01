# Builders-Liability-AMMC Backend

## 📋 Overview

The Builders-Liability-AMMC (Federal Capital Territory - Distress and Compulsory Insurance Policy) Backend is a comprehensive Node.js/Express API that manages insurance policy requests, dual surveyor assignments, report processing, and administrative functions for the AMMC (Abuja Municipal Management Council) and NIA (Nigerian Insurers Association).

## 🏗️ Architecture

### Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT (JSON Web Tokens)
- **File Storage:** Cloudinary
- **Email:** Nodemailer
- **Scheduling:** node-cron

### Key Features
- ✅ Dual surveyor assignment system (AMMC + NIA)
- ✅ Automated report merging and conflict detection
- ✅ Role-based access control (Super Admin, Admin, NIA Admin, Surveyor, User)
- ✅ Real-time assignment tracking and notifications
- ✅ Document management and file uploads
- ✅ Email notifications for all stakeholders
- ✅ Scheduled report processing
- ✅ Comprehensive audit logging

## 📁 Project Structure

```
Builders-Liability-AMMC-BACKEND/
├── controllers/          # Request handlers
│   ├── auth.js          # Authentication & user management
│   ├── policy.js        # Policy request management
│   ├── dualAssignment.js # Dual surveyor assignments
│   ├── niaAdmin.js      # NIA admin operations
│   ├── surveyor.js      # Surveyor operations
│   └── ...
├── models/              # Mongoose schemas
│   ├── User.js          # User model
│   ├── Employee.js      # Employee model
│   ├── PolicyRequest.js # Policy request model
│   ├── DualAssignment.js # Dual assignment model
│   ├── Surveyor.js      # Surveyor model
│   ├── MergedReport.js  # Merged report model
│   └── ...
├── routes/              # API routes
│   ├── auth.js
│   ├── policy.js
│   ├── dualAssignment.js
│   ├── niaAdmin.js
│   └── ...
├── middlewares/         # Custom middleware
│   ├── authentication.js # JWT verification & RBAC
│   ├── niaAuth.js       # NIA-specific auth
│   ├── validation.js    # Request validation
│   └── ...
├── services/            # Business logic
│   ├── AutoReportMerger.js
│   ├── DualSurveyTrigger.js
│   ├── ScheduledReportProcessor.js
│   └── ...
├── utils/               # Utility functions
│   ├── emailService.js
│   ├── assignmentValidation.js
│   └── ...
├── scripts/             # Utility scripts
│   ├── generateDevTokens.js
│   ├── createAdmin.js
│   └── ...
├── database/            # Database configuration
├── errors/              # Custom error classes
└── app.js              # Application entry point
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Cloudinary account (for file uploads)
- Gmail account (for email notifications)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Builders-Liability-AMMC-BACKEND
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```env
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Application
PORT=5000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-make-it-long-and-random
JWT_LIFETIME=30d

# API Security
API_KEY=your-api-key-for-frontend-validation

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM="DCIP System"

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Frontend URL
NEXT_PUBLIC_BASE_URL=http://localhost:3001
```

4. **Initialize the database**
```bash
# Create initial roles and statuses
npm start
# The system will auto-create required roles and statuses on first run
```

5. **Create admin accounts**
```bash
# Create Super Admin
npm run create-admin

# Create NIA Admin
npm run create-nia-admin

# Generate development tokens for testing
npm run generate-tokens
```

### Running the Application

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

## 🔐 Authentication & Authorization

### User Types

1. **User** - Regular users who submit policy requests
2. **Surveyor** - Conducts property surveys (AMMC or NIA)
3. **Admin** - AMMC administrators
4. **NIA Admin** - NIA administrators
5. **Super Admin** - Full system access

### Token Types

The system uses different token types for different user roles:
- `user` - Regular users
- `admin` - AMMC admins
- `nia-admin` - NIA admins
- `surveyor` - Surveyors
- `super-admin` - Super administrators

### Authentication Flow

1. User logs in with email/password
2. Backend verifies credentials
3. JWT token generated with user info and role
4. Token sent to frontend
5. Frontend includes token in Authorization header
6. Backend middleware verifies token and sets `req.user`

## 📡 API Endpoints

### Authentication
```
POST   /api/v1/auth/register              # Register new user
POST   /api/v1/auth/login                 # User login
POST   /api/v1/auth/loginEmployee         # Employee login
POST   /api/v1/auth/request-otp           # Request OTP for verification
POST   /api/v1/auth/verify-otp            # Verify OTP
POST   /api/v1/auth/reset-password-user   # Reset user password
```

### Policy Management
```
GET    /api/v1/policy                     # Get user's policies
POST   /api/v1/policy                     # Create policy request
GET    /api/v1/policy/:id                 # Get policy by ID
PUT    /api/v1/policy/:id                 # Update policy
DELETE /api/v1/policy/:id                 # Delete policy
```

### Dual Assignment
```
POST   /api/v1/dual-assignment            # Create dual assignment
GET    /api/v1/dual-assignment            # Get all dual assignments
GET    /api/v1/dual-assignment/:id        # Get dual assignment by ID
POST   /api/v1/dual-assignment/:id/assign-ammc  # Assign AMMC surveyor
POST   /api/v1/dual-assignment/:id/assign-nia   # Assign NIA surveyor
```

### Surveyor Operations
```
GET    /api/v1/surveyor/assignments       # Get surveyor's assignments
GET    /api/v1/surveyor/assignments/:id   # Get assignment details
POST   /api/v1/surveyor/submit            # Submit survey
GET    /api/v1/surveyor/dashboard         # Get surveyor dashboard data
```

### NIA Admin
```
GET    /api/v1/nia-admin/dashboard        # NIA dashboard data
GET    /api/v1/nia-admin/surveyors        # Get NIA surveyors
POST   /api/v1/nia-admin/surveyors        # Create NIA surveyor
GET    /api/v1/nia-admin/surveyors/available  # Get available surveyors
PUT    /api/v1/nia-admin/surveyors/:id    # Update surveyor
```

### Admin Operations
```
GET    /api/v1/admin/dashboard            # Admin dashboard data
GET    /api/v1/admin/surveyor             # Get AMMC surveyors
POST   /api/v1/admin/surveyor             # Create AMMC surveyor
GET    /api/v1/admin/policy               # Get all policies
PUT    /api/v1/admin/policy/:id           # Update policy status
```

### Report Management
```
GET    /api/v1/report-release/user/reports/summary  # User report summary
GET    /api/v1/report-release/user/reports          # User reports list
GET    /api/v1/report-release/report/:id            # Get report details
POST   /api/v1/report-release/download/:id          # Download report
```

## 🔄 Dual Surveyor System

### How It Works

1. **Policy Submission**
   - User submits policy request
   - System creates DualAssignment record
   - Status: `unassigned`

2. **AMMC Assignment**
   - Admin assigns AMMC surveyor
   - Creates Assignment record
   - Status: `partially_assigned`
   - Completion: 0%

3. **NIA Assignment**
   - NIA Admin assigns NIA surveyor
   - Creates Assignment record
   - Status: `fully_assigned`
   - Completion: 0%

4. **Survey Submissions**
   - AMMC surveyor submits → Completion: 50%
   - NIA surveyor submits → Completion: 100%

5. **Automatic Merging**
   - Both surveys complete
   - AutoReportMerger processes reports
   - Conflict detection runs
   - MergedReport created

6. **Report Release**
   - If no conflicts: Status `released`
   - If conflicts: Status `withheld`
   - User can download when released

## 📧 Email Notifications

The system sends automated emails for:
- ✉️ OTP verification
- ✉️ Password reset
- ✉️ Assignment notifications (surveyors)
- ✉️ Survey completion (admins)
- ✉️ Report release (users)
- ✉️ Conflict alerts (admins)

## 🛠️ Utility Scripts

### Generate Development Tokens
```bash
npm run generate-tokens
```
Creates valid JWT tokens for all user types with test accounts.

### Quick Auth Setup
```bash
npm run quick-auth
```
Generates a user token quickly for testing.

### Create Admin
```bash
npm run create-admin
```
Creates a Super Admin account.

### Create NIA Admin
```bash
npm run create-nia-admin
```
Creates a NIA Admin account.

## 🧪 Testing

### Manual Testing with Generated Tokens

1. Run token generation:
```bash
npm run generate-tokens
```

2. Copy the token for your user type

3. Use in API client (Postman/Insomnia):
```
Authorization: Bearer <your-token>
```

### Test Accounts

After running `npm run generate-tokens`:

| Type | Email | Password |
|------|-------|----------|
| User | testuser@example.com | password123 |
| Super Admin | superadmin@example.com | admin123 |
| AMMC Admin | ammcadmin@example.com | admin123 |
| NIA Admin | niaadmin@example.com | admin123 |
| Surveyor | surveyor@example.com | surveyor123 |

## 🐛 Debugging

### Enable Debug Logs

The authentication middleware includes detailed logging:
- ✅ Token verification status
- ✅ User lookup results
- ✅ Access control decisions

Check console output for:
```
🔐 Verifying token...
✅ Token verified
👤 Looking up User
✅ User found
🔒 allowUserOrAdmin check
✅ Access granted
```

### Common Issues

**401 Unauthorized:**
- Check token is valid JWT
- Verify JWT_SECRET matches
- Ensure token hasn't expired
- Check user exists in database

**Phone Number Validation:**
- Accepts: `08012345678`, `2348012345678`, `+2348012345678`
- Removes spaces and dashes automatically

**Surveyor Assignment Errors:**
- Ensure using Employee ID (userId), not Surveyor ID
- Check surveyor status is 'active'
- Verify organization matches (AMMC/NIA)

## 📊 Database Models

### Key Collections

- **users** - Regular users
- **employees** - Staff (admins, surveyors)
- **policyRequests** - Insurance policy requests
- **dualAssignments** - Dual surveyor assignments
- **assignments** - Individual surveyor assignments
- **surveyors** - Surveyor profiles
- **surveySubmissions** - Survey reports
- **mergedReports** - Merged dual survey reports
- **niaAdmins** - NIA administrator records

## 🔒 Security

- ✅ JWT authentication
- ✅ Password hashing with bcrypt
- ✅ Role-based access control
- ✅ API key validation
- ✅ Input validation and sanitization
- ✅ CORS configuration
- ✅ Rate limiting (recommended for production)

## 📈 Performance

- ✅ Database indexing on frequently queried fields
- ✅ Pagination for large datasets
- ✅ Compression middleware
- ✅ Request timing monitoring
- ✅ Efficient population of related documents

## 🚀 Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Use strong JWT_SECRET
3. Configure production MongoDB
4. Set up Cloudinary production account
5. Configure production email service

### Recommended Services

- **Hosting:** Vercel, Heroku, AWS, DigitalOcean
- **Database:** MongoDB Atlas
- **File Storage:** Cloudinary
- **Email:** SendGrid, AWS SES, or Gmail

## 📝 License

[Your License Here]

## 👥 Contributors

[Your Team Here]

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation in `/docs`

---

**Version:** 1.0.0  
**Last Updated:** 2024

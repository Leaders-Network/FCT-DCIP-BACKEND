# FCT-DCIP Backend API Documentation

## Overview
Complete backend implementation for the FCT-DCIP Insurance platform with surveyor workflow management, policy requests, and file handling.

## Base URL
```
Production: https://fct-dcip-backend-1.onrender.com/api/v1
Local: http://localhost:3000/api/v1
```

## Authentication
All protected routes require JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### 🔐 Authentication (`/auth`)
- `POST /auth/loginEmployee` - Employee/Surveyor login
- `POST /auth/registerEmployee` - Register new employee
- `POST /auth/reset-password-otp` - Request password reset
- `POST /auth/verify-otp-employee` - Verify OTP
- `PATCH /auth/employee-reset-password` - Reset password

### 👨‍🔬 Surveyor Management (`/surveyor`)
All routes require authentication.

#### Dashboard
- `GET /surveyor/dashboard` - Get surveyor dashboard data
  ```json
  {
    "success": true,
    "data": {
      "profile": { /* surveyor profile */ },
      "statistics": {
        "totalAssignments": 25,
        "pendingAssignments": 3,
        "completedSurveys": 22,
        "overdueAssignments": 1
      },
      "recentAssignments": [ /* recent assignments */ ],
      "recentSubmissions": [ /* recent submissions */ ]
    }
  }
  ```

#### Assignments
- `GET /surveyor/assignments?status=all&page=1&limit=10` - Get assignments
- `PATCH /surveyor/assignments/:assignmentId/status` - Update assignment status
  ```json
  {
    "status": "accepted|rejected|in-progress|completed",
    "notes": "Optional notes"
  }
  ```

#### Survey Submissions
- `POST /surveyor/surveys` - Submit survey
- `GET /surveyor/submissions?status=all&page=1&limit=10` - Get submissions

#### Profile
- `GET /surveyor/profile` - Get profile
- `PATCH /surveyor/profile` - Update profile

### 📋 Policy Management (`/policy`)
All routes require authentication.

#### Policy Requests
- `POST /policy` - Create policy request (users)
- `GET /policy/user?status=all&page=1&limit=10` - Get user's policy requests
- `GET /policy?status=all&page=1&limit=10` - Get all policy requests (admin)
- `GET /policy/:policyId` - Get specific policy request
- `PATCH /policy/:policyId` - Update policy request

#### Surveyor Assignment
- `GET /policy/surveyors/available` - Get available surveyors
- `POST /policy/:policyId/assign` - Assign surveyors to policy

#### Survey Review
- `POST /policy/submissions/:submissionId/review` - Review survey submission

### 📁 File Management (`/files`)
All routes require authentication.

- `POST /files/upload` - Upload file to Cloudinary
- `GET /files/download/:publicId` - Download file
- `GET /files/download-url/:publicId` - Get download URL

## Data Models

### 👨‍🔬 Surveyor Model
```javascript
{
  userId: ObjectId, // Reference to Employee
  profile: {
    specialization: ['residential', 'commercial', 'industrial', 'agricultural'],
    certifications: [{ name, issuedBy, issuedDate, expiryDate }],
    experience: Number, // years
    location: { state, city, area },
    availability: 'available|busy|on-leave'
  },
  statistics: {
    totalAssignments: Number,
    completedSurveys: Number,
    pendingAssignments: Number,
    averageRating: Number,
    totalRatings: Number
  },
  settings: {
    notifications: { email, sms, pushNotifications },
    workingHours: { start, end, workingDays }
  }
}
```

### 📋 Policy Request Model
```javascript
{
  userId: String,
  propertyDetails: {
    address: String,
    propertyType: String,
    buildingValue: Number,
    yearBuilt: Number,
    squareFootage: Number,
    constructionMaterial: String,
    coordinates: { latitude, longitude }
  },
  contactDetails: {
    fullName: String,
    email: String,
    phoneNumber: String,
    alternatePhone: String
  },
  requestDetails: {
    coverageType: String,
    policyDuration: String,
    additionalCoverage: [String],
    specialRequests: String
  },
  status: 'submitted|assigned|surveyed|approved|rejected|completed',
  assignedSurveyors: [ObjectId],
  priority: 'low|medium|high|urgent',
  deadline: Date,
  statusHistory: [{ status, changedBy, changedAt, reason }]
}
```

### 📝 Survey Submission Model
```javascript
{
  policyId: ObjectId,
  surveyorId: ObjectId,
  assignmentId: ObjectId,
  surveyDetails: {
    propertyCondition: String,
    structuralAssessment: String,
    riskFactors: String,
    recommendations: String,
    estimatedValue: Number,
    photos: [{ url, publicId, description, timestamp }]
  },
  surveyDocument: { name, url, publicId },
  surveyNotes: String,
  contactLog: [{ date, method, notes, successful, duration }],
  recommendedAction: 'approve|reject|request_more_info',
  qualityCheck: {
    completeness: Number,
    accuracy: Number,
    timeliness: Number,
    overallScore: Number
  },
  status: 'draft|submitted|under_review|approved|rejected|revision_required'
}
```

### 📋 Assignment Model
```javascript
{
  policyId: ObjectId,
  surveyorId: ObjectId,
  assignedBy: ObjectId,
  deadline: Date,
  priority: 'low|medium|high|urgent',
  status: 'assigned|accepted|in-progress|completed|rejected|cancelled',
  instructions: String,
  specialRequirements: [String],
  location: {
    address: String,
    coordinates: { latitude, longitude },
    contactPerson: { name, phone, email, availableHours }
  },
  progressTracking: {
    startedAt: Date,
    completedAt: Date,
    milestones: [{ name, completedAt, notes }],
    checkpoints: [{ timestamp, location, notes, photos }]
  },
  communication: {
    messages: [{ from, message, timestamp, type }]
  }
}
```

## Status Flows

### Policy Request Status Flow
```
submitted → assigned → surveyed → approved/rejected → completed
```

### Assignment Status Flow
```
assigned → accepted → in-progress → completed
         ↘ rejected
```

### Survey Submission Status Flow
```
submitted → under_review → approved/revision_required
```

## Error Responses
All error responses follow this format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

## File Upload
Supports PDF files up to 10MB. Files are uploaded to Cloudinary and return:
```json
{
  "success": true,
  "data": {
    "url": "https://cloudinary.com/...",
    "publicId": "survey-documents/123456_filename.pdf",
    "originalName": "filename.pdf"
  }
}
```

## Security Features
- JWT authentication
- Role-based access control
- API key validation
- File type validation
- Request rate limiting
- Input sanitization
- CORS protection

## Environment Variables Required
```env
MONGO_URI=mongodb+srv://...
APIKEY=your_api_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EMAIL=your_email
EMAIL_PASSWORD=your_email_password
```
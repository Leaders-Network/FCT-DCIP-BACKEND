# Code Duplication and Redundancy Analysis
## Builders Liability AMMC Project

**Date:** Generated Analysis  
**Scope:** Backend and Frontend Codebase Review

---

## Executive Summary

This analysis identifies significant code duplication and redundancy across the Builders Liability AMMC project. The main areas of concern are:

1. **Email Service Duplication** - Multiple implementations of email sending functionality
2. **Notification Service Overlap** - Several notification services with overlapping responsibilities
3. **Controller Pattern Repetition** - Repeated error handling, validation, and response patterns
4. **Database Query Patterns** - Similar populate and query logic across multiple controllers
5. **Route Duplication** - Some routes appear to be duplicated in app.js

---

## 1. Email Service Duplication (CRITICAL)

### Problem
There are **at least 4 different email service implementations** with overlapping functionality:

#### 1.1 `utils/emailService.js`
- **Purpose:** Main email utility with multiple notification functions
- **Features:**
  - `createTransporter()` - Creates nodemailer transporter
  - `sendAutomaticConflictAlert()`
  - `sendReportMergingNotification()`
  - `sendPaymentDecisionNotification()`
  - `sendReportAvailableNotification()`
  - `sendConflictInquiryNotification()`
  - `sendConflictInquiryResponse()`
  - `sendReportProcessingUpdate()`
- **Transporter:** Uses environment variables (SMTP_HOST, SMTP_PORT, etc.)

#### 1.2 `services/emailService.js`
- **Purpose:** Broker admin credentials email
- **Features:**
  - `createTransporter()` - Creates Ethereal test account transporter
  - `sendBrokerAdminCredentials()` - Sends broker admin credentials
- **Transporter:** Uses Ethereal test account (for testing only)
- **Issue:** Uses different transporter setup than utils/emailService.js

#### 1.3 `services/BrokerAdminEmailService.js`
- **Status:** **INCOMPLETE** (only 3 lines, appears to be a stub)
- **Issue:** File exists but is not functional

#### 1.4 `services/DualSurveyorNotificationService.js`
- **Purpose:** Dual surveyor notification emails
- **Features:**
  - `getTransporter()` - Creates its own transporter (lazy initialization)
  - `sendEmail()` - Generic email sending method
  - `notifyOtherSurveyor()`
  - `notifyReportMerged()`
  - Multiple email template generators
- **Transporter:** Uses environment variables, but creates its own instance
- **Issue:** Duplicates transporter creation logic

#### 1.5 `utils/sendEmail.js`
- **Purpose:** OTP and verification emails
- **Features:**
  - Creates Ethereal test account
  - Handles "verifyemail", "surveyorCredentials", "resetpassword" mail types
- **Transporter:** Uses Ethereal test account
- **Issue:** Another separate email implementation

### Impact
- **Maintenance Burden:** Changes to email configuration must be made in multiple places
- **Inconsistency:** Different email services may behave differently
- **Testing Complexity:** Multiple email implementations to test
- **Code Size:** ~2000+ lines of duplicated email logic

### Recommendation
**Consolidate all email functionality into a single service:**
1. Create a unified `services/EmailService.js` that:
   - Has a single `createTransporter()` method
   - Supports both production (SMTP) and development (Ethereal) modes
   - Provides template-based email sending
   - Exports specific notification methods
2. Deprecate and remove:
   - `services/emailService.js` (BrokerAdminEmailService)
   - `services/BrokerAdminEmailService.js` (incomplete)
   - `utils/sendEmail.js` (migrate to new service)
3. Refactor existing services to use the unified EmailService:
   - `services/DualSurveyorNotificationService.js`
   - `services/UserNotificationService.js`
   - All controllers using email functionality

---

## 2. Notification Service Overlap

### Problem
Multiple notification services with overlapping responsibilities:

#### 2.1 `services/NotificationService.js`
- **Purpose:** Admin and surveyor notifications
- **Features:**
  - `notifyAdminsOfNewPolicy()` - Logs notifications (doesn't actually send emails - commented out)
  - `notifySurveyorOfAssignment()` - Logs notifications (doesn't actually send emails - commented out)
- **Issue:** Only logs to console, doesn't actually send notifications

#### 2.2 `services/UserNotificationService.js`
- **Purpose:** User notifications for reports and payments
- **Features:**
  - `notifyReportReady()` - Sends email via `utils/emailService.sendEmail()`
  - `notifyPaymentDecision()` - Sends email via `utils/emailService.sendEmail()`
- **Uses:** `utils/emailService.sendEmail()` (but this function doesn't exist in utils/emailService.js!)

#### 2.3 `services/claimNotificationService.js`
- **Purpose:** Claim-related notifications
- **Features:**
  - `createNotification()` - Creates database notification records
  - `getUserNotifications()` - Retrieves notifications
  - `markAsRead()` - Marks notification as read
  - `notifyStatusChange()` - Creates notification for status changes
- **Uses:** Notification model (database records)

#### 2.4 `services/DualSurveyorNotificationService.js`
- **Purpose:** Dual surveyor assignment notifications
- **Features:**
  - Email notifications for dual surveyor workflows
  - Has its own email sending implementation

### Impact
- **Confusion:** Unclear which service to use for which notification type
- **Incomplete Implementation:** NotificationService.js doesn't actually send notifications
- **Missing Function:** UserNotificationService references non-existent `sendEmail` function
- **Inconsistent Patterns:** Some use database records, some use emails, some just log

### Recommendation
**Create a unified notification system:**
1. **Database Notifications:** Use `services/claimNotificationService.js` pattern for in-app notifications
2. **Email Notifications:** Use unified EmailService (from recommendation 1)
3. **Unified Notification Service:** Create `services/NotificationService.js` that:
   - Handles both database and email notifications
   - Provides methods for all notification types
   - Uses the unified EmailService for emails
   - Uses Notification model for database records
4. **Deprecate:**
   - Current `services/NotificationService.js` (non-functional)
   - Migrate `services/UserNotificationService.js` to use unified service
   - Integrate `services/DualSurveyorNotificationService.js` email logic into unified service

---

## 3. Controller Pattern Repetition

### Problem
Repeated patterns across controllers:

#### 3.1 Error Handling Pattern
Found **748 instances** of try-catch blocks across 25 controller files:
```javascript
try {
  // ... logic
} catch (error) {
  console.error('... error:', error);
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: '...',
    error: error.message
  });
}
```

**Files with most repetition:**
- `adminAssignment.js`: 34 instances
- `policy.js`: 53 instances
- `dualAssignment.js`: 55 instances
- `assignment.js`: 36 instances

#### 3.2 Database Query Patterns
Found **151 instances** of `.populate()` calls across 20 controller files:
- Similar populate patterns repeated across multiple controllers
- Same field selections repeated (e.g., `'firstname lastname email'`)

**Common Patterns:**
```javascript
.populate('ammcId', 'policyNumber contactDetails propertyDetails status priority')
.populate('surveyorId', 'firstname lastname email phonenumber')
.populate('assignedBy', 'firstname lastname')
```

#### 3.3 Response Format Pattern
Repeated response formatting:
```javascript
res.status(StatusCodes.OK).json({
  success: true,
  data: { ... },
  pagination: { ... }
});
```

### Impact
- **Code Duplication:** ~2000+ lines of repeated error handling
- **Maintenance:** Changes to error handling must be made in many places
- **Inconsistency:** Slight variations in error messages and formats
- **Testing:** Similar test patterns needed for each controller

### Recommendation
**Create reusable middleware and utilities:**
1. **Error Handling Middleware:** Already exists (`middlewares/error-handler.js`), but controllers don't use it consistently
   - Refactor controllers to throw errors instead of catching
   - Let middleware handle error responses
2. **Query Builder Utility:** Create `utils/queryBuilder.js`:
   - Standard populate configurations
   - Common query filters
   - Pagination helpers
3. **Response Formatter:** Create `utils/responseFormatter.js`:
   - Standardized success responses
   - Pagination response format
   - Error response format

---

## 4. Assignment Controller Duplication

### Problem
Two assignment controllers with significant overlap:

#### 4.1 `controllers/assignment.js`
- **Purpose:** Surveyor-facing assignment operations
- **Features:**
  - `getSurveyorAssignments()` - Get assignments for authenticated surveyor
  - `getAssignmentById()` - Get single assignment
  - `updateAssignmentStatus()` - Update assignment status
  - Similar populate patterns
  - Similar error handling

#### 4.2 `controllers/adminAssignment.js`
- **Purpose:** Admin-facing assignment operations
- **Features:**
  - `getAllAssignments()` - Get all assignments with filters
  - `getAssignmentById()` - Get single assignment (admin view)
  - `updateAssignment()` - Update assignment
  - `reassignAssignment()` - Reassign to different surveyor
  - Similar populate patterns
  - Similar error handling

### Overlap
- Both have `getAssignmentById()` with similar logic
- Both use similar populate patterns
- Both have similar error handling
- Both query Assignment model with similar filters

### Recommendation
**Extract common logic:**
1. **Shared Service:** Create `services/AssignmentService.js`:
   - Common query methods
   - Common populate configurations
   - Shared business logic
2. **Controller Refactoring:**
   - Controllers become thin wrappers
   - Call service methods
   - Handle request/response only

---

## 5. Route Duplication in app.js

### Problem
In `app.js`, there's a duplicate route registration:

```javascript
app.use('/api/v1/processing-monitor', processingMonitorRouter);  // Line 113
// ... other routes ...
app.use('/api/v1/processing-monitor', processingMonitorRouter);  // Line 120 (DUPLICATE)
```

### Impact
- **Confusion:** Unclear which route takes precedence
- **Maintenance:** Easy to miss when updating routes

### Recommendation
**Remove duplicate route registration** (line 120)

---

## 6. Frontend Service Patterns

### Observation
Frontend has fewer services:
- `api.ts` - Main API client
- `fileService.ts` - File operations
- `policyStatus.ts` - Policy status operations
- `processingMonitor.ts` - Processing monitor
- `userConflictInquiries.ts` - Conflict inquiries

**Potential Issue:** If API calls are duplicated across components instead of using services, this could be a problem. Further investigation needed.

---

## 7. Summary of Recommendations

### High Priority (Critical)
1. ✅ **Consolidate Email Services** - Create unified EmailService
2. ✅ **Fix Notification Services** - Create unified notification system
3. ✅ **Remove Duplicate Route** - Fix app.js duplicate route

### Medium Priority (Important)
4. ✅ **Extract Controller Patterns** - Create query builder and response formatter utilities
5. ✅ **Refactor Error Handling** - Use error middleware consistently
6. ✅ **Extract Assignment Logic** - Create AssignmentService

### Low Priority (Nice to Have)
7. ⚠️ **Frontend Service Audit** - Check for API call duplication in components
8. ⚠️ **Documentation** - Document the unified services

---

## 8. Estimated Impact

### Code Reduction
- **Email Services:** ~1500 lines → ~500 lines (67% reduction)
- **Notification Services:** ~800 lines → ~400 lines (50% reduction)
- **Controller Error Handling:** ~2000 lines → ~500 lines (75% reduction with middleware)
- **Total Estimated Reduction:** ~3400 lines of code

### Benefits
- **Maintainability:** Single source of truth for each concern
- **Consistency:** Uniform behavior across the application
- **Testing:** Fewer places to test
- **Performance:** Potential for better caching and optimization
- **Developer Experience:** Clearer code organization

---

## 9. Implementation Plan

### Phase 1: Email Service Consolidation (Week 1)
1. Create unified `services/EmailService.js`
2. Migrate all email functionality
3. Update all references
4. Remove old email service files
5. Test all email functionality

### Phase 2: Notification Service Unification (Week 2)
1. Create unified `services/NotificationService.js`
2. Integrate database and email notifications
3. Migrate existing notification calls
4. Remove old notification service files
5. Test all notification flows

### Phase 3: Controller Refactoring (Week 3-4)
1. Create query builder utility
2. Create response formatter utility
3. Refactor error handling to use middleware
4. Extract AssignmentService
5. Refactor controllers to use new utilities

### Phase 4: Cleanup and Testing (Week 5)
1. Remove duplicate routes
2. Comprehensive testing
3. Update documentation
4. Code review

---

## 10. Files Requiring Attention

### Backend Files to Refactor
- `services/emailService.js` - Migrate to unified service
- `services/BrokerAdminEmailService.js` - Remove (incomplete)
- `services/NotificationService.js` - Replace with functional version
- `services/UserNotificationService.js` - Migrate to unified service
- `services/DualSurveyorNotificationService.js` - Use unified EmailService
- `utils/sendEmail.js` - Migrate to unified service
- `utils/emailService.js` - Consolidate into unified service
- `controllers/assignment.js` - Extract to service
- `controllers/adminAssignment.js` - Extract to service
- `app.js` - Remove duplicate route

### New Files to Create
- `services/EmailService.js` - Unified email service
- `services/NotificationService.js` - Unified notification service (rewrite)
- `services/AssignmentService.js` - Shared assignment logic
- `utils/queryBuilder.js` - Query building utilities
- `utils/responseFormatter.js` - Response formatting utilities

---

## Notes

- This analysis is based on code review and pattern matching
- Some duplication may be intentional (e.g., admin vs user views)
- Further investigation may reveal additional duplication
- Consider running code analysis tools (e.g., SonarQube, CodeClimate) for deeper insights


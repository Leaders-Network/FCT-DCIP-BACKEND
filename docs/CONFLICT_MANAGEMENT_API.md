# Conflict Management API Documentation

This document outlines the backend APIs available for the NIA Dashboard and Dual-Surveyor System conflict management features.

## Base URL
```
http://localhost:5000/api/v1
```

## Authentication
All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## User Conflict Inquiries

### Submit New Conflict Inquiry
```http
POST /user-conflict-inquiries
```

**Request Body:**
```json
{
  "policyId": "string",
  "mergedReportId": "string", 
  "conflictType": "disagreement_findings|recommendation_concern|surveyor_conduct|technical_error|missing_information|clarification_needed|other",
  "description": "string",
  "urgency": "low|medium|high",
  "contactPreference": "email|phone|both",
  "userContact": {
    "email": "string",
    "phone": "string",
    "preferredTime": "string"
  }
}
```

### Get Admin Conflict Inquiries
```http
GET /admin/user-conflict-inquiries?status=all&urgency=all&conflictType=all&organization=all&page=1&limit=20
```

### Get Inquiry Statistics
```http
GET /admin/user-conflict-inquiries/stats?organization=all&timeframe=30d
```

### Assign Inquiry to Admin
```http
PUT /admin/user-conflict-inquiries/:id/assign
```

**Request Body:**
```json
{
  "organization": "AMMC|NIA|BOTH"
}
```

### Respond to Inquiry
```http
PUT /admin/user-conflict-inquiries/:id/respond
```

**Request Body:**
```json
{
  "response": "string",
  "method": "email|phone|in_person"
}
```

### Add Internal Note
```http
PUT /admin/user-conflict-inquiries/:id/add-note
```

**Request Body:**
```json
{
  "note": "string",
  "noteType": "general|follow_up|escalation|resolution"
}
```

### Escalate Inquiry
```http
PUT /admin/user-conflict-inquiries/:id/escalate
```

**Request Body:**
```json
{
  "escalatedTo": "string",
  "reason": "string"
}
```

### Close Inquiry
```http
PUT /admin/user-conflict-inquiries/:id/close
```

**Request Body:**
```json
{
  "closureReason": "string"
}
```

## Automatic Conflict Flags

### Get Admin Conflict Flags
```http
GET /admin/automatic-conflict-flags?status=all&severity=all&conflictType=all&priority=all&page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

### Get Specific Conflict Flag
```http
GET /admin/automatic-conflict-flags/:id
```

### Review Conflict Flag
```http
PUT /admin/automatic-conflict-flags/:id/review
```

**Request Body:**
```json
{
  "reviewNotes": "string",
  "reviewDecision": "valid_conflict|false_positive|requires_manual_review|escalate"
}
```

### Resolve Conflict Flag
```http
PUT /admin/automatic-conflict-flags/:id/resolve
```

**Request Body:**
```json
{
  "resolutionMethod": "admin_override|surveyor_clarification|user_acceptance|policy_update",
  "resolutionNotes": "string"
}
```

### Escalate Conflict Flag
```http
PUT /admin/automatic-conflict-flags/:id/escalate
```

**Request Body:**
```json
{
  "escalatedTo": "string",
  "reason": "string"
}
```

### Create Conflict Flag (System Use)
```http
POST /automatic-conflict-flags/detect
```

**Request Body:**
```json
{
  "mergedReportId": "string",
  "policyId": "string",
  "dualAssignmentId": "string",
  "conflictType": "recommendation_mismatch|value_discrepancy|risk_assessment_difference|structural_disagreement|other",
  "conflictSeverity": "low|medium|high|critical",
  "ammcRecommendation": "string",
  "niaRecommendation": "string",
  "ammcValue": "number",
  "niaValue": "number",
  "discrepancyPercentage": "number",
  "flaggedSections": "array",
  "detectionMetadata": "object"
}
```

### Get Policy Conflict Flags
```http
GET /automatic-conflict-flags/policy/:policyId
```

## Processing Monitor

### Get Processing Overview
```http
GET /processing-monitor/overview?organization=all&timeframe=24h
```

### Get Active Processing Jobs
```http
GET /processing-monitor/active-processing?organization=all
```

### Get Performance Metrics
```http
GET /processing-monitor/performance-metrics?timeframe=7d&organization=all
```

### Get System Health
```http
GET /processing-monitor/system-health
```

### Get Recent Activity
```http
GET /processing-monitor/recent-activity?limit=50&organization=all
```

## Enhanced Admin Dashboard

### Get Dashboard Overview
```http
GET /admin/dashboard-enhanced/overview?organization=all&timeframe=30d
```

### Get Current Workload
```http
GET /admin/dashboard-enhanced/workload?organization=all
```

### Get System Alerts
```http
GET /admin/dashboard-enhanced/alerts?organization=all
```

## Query Parameters

### Common Parameters
- `organization`: Filter by organization (`all`, `AMMC`, `NIA`)
- `timeframe`: Time period (`1h`, `24h`, `7d`, `30d`)
- `page`: Page number for pagination (default: 1)
- `limit`: Items per page (default: 20)
- `sortBy`: Field to sort by (default: `createdAt`)
- `sortOrder`: Sort direction (`asc`, `desc`)

### Status Filters
- `status`: Filter by status (`all`, `open`, `in_progress`, `resolved`, `closed`)
- `urgency`: Filter by urgency (`all`, `low`, `medium`, `high`)
- `severity`: Filter by severity (`all`, `low`, `medium`, `high`, `critical`)
- `priority`: Filter by priority (`all`, `low`, `normal`, `high`, `urgent`)

## Response Format

All API responses follow this format:

```json
{
  "success": true|false,
  "message": "string",
  "data": "object|array",
  "error": "string (only on errors)"
}
```

## Error Codes

- `400`: Bad Request - Invalid input data
- `401`: Unauthorized - Invalid or missing authentication token
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource not found
- `409`: Conflict - Resource already exists
- `500`: Internal Server Error - Server-side error

## Email Notifications

The system automatically sends email notifications for:

- New user conflict inquiries (to admins)
- Admin responses to user inquiries (to users)
- Automatic conflict detection (to admins)
- Conflict resolution (to users)
- Escalations (to supervisors)

## Database Models

### UserConflictInquiry
- Comprehensive inquiry tracking with reference IDs
- Internal notes and communication history
- Escalation and resolution management
- Satisfaction rating system

### AutomaticConflictFlag
- Automatic conflict detection and flagging
- Severity assessment and confidence scoring
- Review and resolution workflow
- Notification history tracking

### Processing Monitoring
- Real-time processing status tracking
- Performance metrics and system health
- Activity logging and audit trails
- Alert generation for system issues

## Integration Notes

1. **Authentication**: Ensure proper JWT token handling
2. **Error Handling**: Implement proper error handling for all API calls
3. **Pagination**: Handle pagination for list endpoints
4. **Real-time Updates**: Consider implementing WebSocket connections for real-time updates
5. **Caching**: Implement appropriate caching strategies for dashboard data
6. **Rate Limiting**: Be aware of potential rate limiting on API endpoints

## Testing

Use the provided migration script to set up the conflict management system:

```bash
node Builders-Liability-AMMC-BACKEND/scripts/setupConflictManagement.js
```

This will:
- Create necessary database indexes
- Update existing records with organization fields
- Verify reference ID generation
- Set up the conflict management infrastructure
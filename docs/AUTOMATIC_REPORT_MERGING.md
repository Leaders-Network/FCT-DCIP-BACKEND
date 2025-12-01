# Automatic Report Merging System

## Overview

The Automatic Report Merging System is a comprehensive solution that automatically processes and merges survey reports from dual assignments (AMMC and NIA surveyors). The system detects conflicts, calculates confidence scores, and determines release status based on predefined algorithms.

## Architecture

### Core Components

1. **AutoReportMerger Service** - Main processing engine
2. **ScheduledReportProcessor** - Automated background processing
3. **ProcessingJob Model** - Job tracking and management
4. **Email Service** - Conflict notifications
5. **API Controllers & Routes** - Management interfaces

### Processing Flow

```
Dual Assignment Completed
         ↓
Scheduled Processor Detects
         ↓
AutoReportMerger Processes
         ↓
Conflict Detection & Analysis
         ↓
Merged Report Creation
         ↓
Notification & Status Update
```

## API Endpoints

### Report Merging Management

#### Process Specific Assignment
```http
POST /api/v1/report-merging/process/:dualAssignmentId
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Report merging completed successfully",
  "data": {
    "mergedReportId": "64f8a1b2c3d4e5f6a7b8c9d0",
    "conflictsDetected": 2,
    "processingTime": 1250,
    "recommendation": "conditional",
    "processingJobId": "64f8a1b2c3d4e5f6a7b8c9d1"
  }
}
```

#### Process All Pending
```http
POST /api/v1/report-merging/process-all
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Batch processing started for 15 assignments",
  "data": {
    "batchJobId": "64f8a1b2c3d4e5f6a7b8c9d2",
    "expectedCount": 15,
    "status": "processing"
  }
}
```

#### Get Merged Report
```http
GET /api/v1/report-merging/merged-report/:reportId
Authorization: Bearer <token>
```

#### Get Processing Job Status
```http
GET /api/v1/report-merging/job/:jobId
Authorization: Bearer <admin_token>
```

#### Get Merging Statistics
```http
GET /api/v1/report-merging/stats?timeframe=7d
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "timeframe": "7d",
    "totalReports": 45,
    "pendingAssignments": 3,
    "statusBreakdown": {
      "approved": 30,
      "pending": 10,
      "withheld": 5
    },
    "conflictDetection": {
      "withConflicts": 12,
      "withoutConflicts": 33,
      "avgConfidenceWithConflicts": 72.5,
      "avgConfidenceWithoutConflicts": 94.2
    },
    "processingPerformance": {
      "avgProcessingTime": 1150,
      "minProcessingTime": 450,
      "maxProcessingTime": 3200
    }
  }
}
```

#### Reprocess Report
```http
POST /api/v1/report-merging/reprocess/:reportId
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "Updated algorithm parameters"
}
```

### Scheduled Processor Management

#### Get Processor Status
```http
GET /api/v1/scheduled-processor/status
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "lastRunTime": "2024-11-02T10:30:00.000Z",
    "isScheduled": true,
    "pendingAssignments": 3,
    "failedAssignments": 1,
    "stats": {
      "totalProcessed": 127,
      "successCount": 125,
      "errorCount": 2,
      "lastError": {
        "assignmentId": "64f8a1b2c3d4e5f6a7b8c9d3",
        "error": "Survey submission not found",
        "timestamp": "2024-11-02T09:15:00.000Z"
      }
    },
    "nextRun": "2024-11-02T10:35:00.000Z"
  }
}
```

#### Trigger Manual Processing
```http
POST /api/v1/scheduled-processor/trigger
Authorization: Bearer <admin_token>
```

#### Retry Failed Assignments
```http
POST /api/v1/scheduled-processor/retry-failed
Authorization: Bearer <admin_token>
```

#### Reset Statistics
```http
POST /api/v1/scheduled-processor/reset-stats
Authorization: Bearer <admin_token>
```

## Conflict Detection Algorithm

### Conflict Types and Thresholds

1. **Property Value Conflicts**
   - Threshold: 15% difference
   - Severity: High if >30%, Medium if 15-30%

2. **Area Measurement Conflicts**
   - Threshold: 10% difference
   - Severity: High if >25%, Medium if 10-25%

3. **GPS Coordinate Conflicts**
   - Threshold: 0.001 degree difference
   - Severity: Medium for significant differences

4. **Recommendation Conflicts**
   - Threshold: Exact match required
   - Severity: Critical for any mismatch

### Confidence Score Calculation

```javascript
Initial Score: 100%
- Critical Conflicts: -30 points each
- High Conflicts: -15 points each
- Medium Conflicts: -5 points each
- Low Conflicts: -2 points each

Final Score: Max(0, calculated_score)
```

### Release Status Determination

- **Approved**: No critical conflicts, confidence ≥ 70%
- **Pending**: 1-2 high conflicts or confidence 50-69%
- **Withheld**: Any critical conflicts or confidence < 50%

## Merging Logic

### Property Details Merging
- **Property Type**: Must match (conflict if different)
- **Address**: Use most complete version
- **Coordinates**: Average if close, flag if far apart

### Measurements Merging
- **Total Area**: Average if within threshold
- **Dimensions**: Average all available measurements

### Valuation Merging
- **Estimated Value**: Average if within threshold
- **Market Value**: Average if both exist
- **Method**: Use most detailed approach

### Recommendation Merging
- **Matching**: Use agreed recommendation
- **Conflicting**: Default to most conservative:
  1. Reject (highest priority)
  2. Conditional (medium priority)
  3. Approve (lowest priority)

## Scheduled Processing

### Schedule Configuration
- **Processing Frequency**: Every 5 minutes
- **Cleanup Frequency**: Every hour
- **Batch Size**: Maximum 10 assignments per cycle
- **Delay Buffer**: 2 minutes after completion

### Processing Conditions
```javascript
{
  completionStatus: 100,
  processingStatus: { $ne: 'completed' },
  mergedReportId: { $exists: false },
  updatedAt: { $lt: new Date(Date.now() - 2 * 60 * 1000) }
}
```

## Email Notifications

### Conflict Alerts
Sent to all active admins when critical or high-severity conflicts are detected.

**Template Variables:**
- Policy ID
- Conflict type and severity
- AMMC vs NIA values
- Detection timestamp
- Review link

### Processing Notifications
Sent when report merging is completed (optional configuration).

## Error Handling

### Retry Logic
- **Max Retries**: 3 attempts
- **Retry Conditions**: Failed status with retry count < max
- **Backoff Strategy**: Manual retry through admin interface

### Error Types
1. **Survey Not Found**: Missing submission data
2. **Data Validation**: Invalid survey data structure
3. **Processing Timeout**: Long-running operations
4. **Database Errors**: Connection or query failures

## Monitoring and Logging

### Key Metrics
- Processing success rate
- Average processing time
- Conflict detection rate
- Queue depth and processing lag

### Log Levels
- **INFO**: Normal processing events
- **WARN**: Conflicts detected, retries
- **ERROR**: Processing failures, system errors

## Configuration

### Environment Variables
```bash
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@Builders-Liability-AMMC.gov.ng

# Frontend URL for email links
FRONTEND_URL=https://your-frontend-domain.com

# Processing Configuration
MAX_PROCESSING_BATCH_SIZE=10
PROCESSING_DELAY_MINUTES=2
CLEANUP_RETENTION_DAYS=30
```

### Algorithm Tuning
Conflict thresholds can be adjusted in the AutoReportMerger constructor:

```javascript
this.conflictThresholds = {
    propertyValue: 0.15,    // 15%
    area: 0.10,             // 10%
    coordinates: 0.001,     // GPS degrees
    recommendation: 'exact' // Must match
};
```

## Security Considerations

### Access Control
- All endpoints require authentication
- Admin-only endpoints use role-based restrictions
- Processing jobs track initiator information

### Data Protection
- Sensitive survey data is not logged
- Email notifications use secure SMTP
- Processing results are audit-logged

## Performance Optimization

### Database Indexes
- Dual assignment status and completion
- Processing job status and timestamps
- Merged report creation dates

### Batch Processing
- Limited concurrent processing
- Queue-based job management
- Automatic cleanup of old records

## Troubleshooting

### Common Issues

1. **Assignments Not Processing**
   - Check completion status (must be 100%)
   - Verify survey submissions exist
   - Check processor status and logs

2. **High Conflict Rates**
   - Review surveyor training
   - Adjust conflict thresholds
   - Analyze conflict patterns

3. **Processing Delays**
   - Monitor queue depth
   - Check system resources
   - Review batch size settings

### Debug Commands
```bash
# Check processor status
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/v1/scheduled-processor/status

# Trigger manual processing
curl -X POST -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/v1/scheduled-processor/trigger

# Get processing statistics
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/v1/report-merging/stats?timeframe=24h"
```

## Future Enhancements

### Planned Features
1. **Machine Learning Integration**: Improve conflict detection accuracy
2. **Advanced Analytics**: Detailed reporting and insights
3. **Custom Workflows**: Configurable processing rules
4. **Real-time Notifications**: WebSocket-based updates
5. **Audit Trail**: Comprehensive change tracking

### API Versioning
Current version: v1
Future versions will maintain backward compatibility with deprecation notices.
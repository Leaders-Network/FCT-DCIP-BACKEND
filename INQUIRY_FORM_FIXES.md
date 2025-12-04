# User Conflict Inquiry Form - Backend Fixes

## Changes Made

### 1. Model Changes (`models/UserConflictInquiry.js`)

#### Reference ID Generation
- **Changed**: `referenceId` field from `required: true` to `required: false`
- **Reason**: The pre-save hook automatically generates the referenceId, so it shouldn't be required in validation
- **Format**: `CF-YYYYMMDD-XXXX` (e.g., `CF-20241204-1234`)

```javascript
referenceId: {
    type: String,
    required: false // Generated automatically by pre-save hook
}
```

#### Policy ID Made Optional
- **Changed**: `policyId` field from `required: true` to `required: false`
- **Reason**: Users might want to raise general inquiries not tied to a specific policy
- **Default**: `null`

```javascript
policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PolicyRequest',
    required: false,
    default: null
}
```

#### User Contact Name Field Added
- **Added**: `name` field to `userContact` object
- **Reason**: Frontend sends user's name from cookies/localStorage
- **Default**: Empty string

```javascript
userContact: {
    email: { type: String, required: true },
    name: { type: String, default: '' },  // NEW
    phone: { type: String, default: '' },
    preferredTime: { type: String, default: '' }
}
```

### 2. Route Changes (`routes/userConflictInquiries.js`)

#### Improved Validation
- **Changed**: Validation logic to only require essential fields
- **Required**: `conflictType`, `description`, `userContact.email`
- **Optional**: `policyId`, `mergedReportId`, `phone`, `name`, `preferredTime`

#### Better Error Messages
- **Changed**: More descriptive error messages
- **Example**: "Missing required fields: conflictType, description, and userContact.email are required"

#### Enhanced Data Handling
- **Added**: Support for `userContact.name` field
- **Improved**: Conditional handling of optional fields
- **Fixed**: Only adds fields to inquiryData if they have values

## Request/Response Format

### Request Body (Frontend → Backend)
```json
{
  "conflictType": "disagreement_findings",
  "description": "User's detailed description",
  "urgency": "medium",
  "contactPreference": "email",
  "userContact": {
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "1234567890"
  },
  "policyId": "507f1f77bcf86cd799439011",
  "mergedReportId": "507f1f77bcf86cd799439012"
}
```

**Required Fields:**
- `conflictType` (enum)
- `description` (string)
- `userContact.email` (string)

**Optional Fields:**
- `policyId` (ObjectId)
- `mergedReportId` (ObjectId)
- `urgency` (enum: low/medium/high, default: medium)
- `contactPreference` (enum: email/phone/both, default: email)
- `userContact.name` (string)
- `userContact.phone` (string)
- `userContact.preferredTime` (string)

### Response (Backend → Frontend)
```json
{
  "success": true,
  "message": "Conflict inquiry submitted successfully",
  "data": {
    "referenceId": "CF-20241204-1234",
    "inquiryId": "507f1f77bcf86cd799439011",
    "expectedResponseTime": "24-48 hours"
  }
}
```

## Valid Conflict Types (Enum)
- `disagreement_findings` - Disagreement with Findings
- `recommendation_concern` - Recommendation Concern
- `surveyor_conduct` - Surveyor Conduct Issue
- `technical_error` - Technical Error
- `missing_information` - Missing Information
- `clarification_needed` - Clarification Needed
- `other` - Other Concern

## Pre-Save Hook Behavior

The model has a pre-save hook that automatically generates the `referenceId`:

```javascript
UserConflictInquirySchema.pre('save', function (next) {
    if (this.isNew && !this.referenceId) {
        const date = new Date();
        const dateStr = date.getFullYear().toString() +
            (date.getMonth() + 1).toString().padStart(2, '0') +
            date.getDate().toString().padStart(2, '0');
        const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
        this.referenceId = `CF-${dateStr}-${randomNum}`;
    }
    next();
});
```

## Testing

To test the changes:

1. **Submit inquiry without policyId** (general inquiry):
```bash
POST /api/v1/user-conflict-inquiries
{
  "conflictType": "technical_error",
  "description": "Test inquiry",
  "userContact": {
    "email": "test@example.com",
    "name": "Test User"
  }
}
```

2. **Submit inquiry with policyId**:
```bash
POST /api/v1/user-conflict-inquiries
{
  "policyId": "507f1f77bcf86cd799439011",
  "conflictType": "disagreement_findings",
  "description": "Test inquiry with policy",
  "userContact": {
    "email": "test@example.com",
    "name": "Test User",
    "phone": "1234567890"
  }
}
```

3. **Verify referenceId is generated**:
- Check response includes `referenceId` field
- Format should be `CF-YYYYMMDD-XXXX`

## Migration Notes

No database migration required. Existing records will continue to work:
- Existing records already have `referenceId` (generated on creation)
- Existing records have `policyId` (will remain valid)
- New `userContact.name` field will default to empty string for existing records

## Summary

✅ Reference ID is now auto-generated by backend (not required in request)
✅ Policy ID is now optional (users can raise general inquiries)
✅ User contact name field added to support frontend data
✅ Better validation and error messages
✅ Backward compatible with existing data

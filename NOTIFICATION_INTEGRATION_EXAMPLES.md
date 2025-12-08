# Notification Integration Examples

## Example 1: Policy Creation Flow

```javascript
// In your policy creation endpoint
const EnhancedNotificationService = require('../services/EnhancedNotificationService');

router.post('/policy', authenticateToken, async (req, res) => {
  try {
    // Create policy
    const policy = await PolicyRequest.create({
      ...req.body,
      userId: req.user.id
    });

    // Notify user
    await EnhancedNotificationService.notifyPolicyCreated(
      policy._id,
      req.user.id,
      req.user.email
    );

    // Notify all admins
    const admins = await Employee.find({ 
      employeeRole: { $in: await getAdminRoleIds() },
      deleted: false 
    });

    const adminNotifications = admins.map(admin => ({
      recipientId: admin._id.toString(),
      recipientType: 'admin',
      type: 'policy_created',
      title: 'New Policy Request',
      message: `New policy request from ${req.user.fullname} requires assignment`,
      priority: 'high',
      actionUrl: `/admin/dashboard/policies/${policy._id}`,
      actionLabel: 'Assign Surveyor',
      metadata: {
        policyId: policy._id.toString(),
        icon: 'FileText',
        color: 'blue'
      }
    }));

    await EnhancedNotificationService.createBulk(adminNotifications);

    res.json({ success: true, policy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Example 2: Assignment Creation

```javascript
// When assigning a surveyor
router.post('/admin/assignment', authenticateToken, async (req, res) => {
  try {
    const { ammcId, surveyorId, deadline, priority } = req.body;

    // Create assignment
    const assignment = await Assignment.create({
      ammcId,
      surveyorId,
      assignedBy: req.user.id,
      deadline,
      priority,
      status: 'assigned'
    });

    // Get surveyor details
    const surveyor = await Employee.findById(surveyorId);

    // Notify surveyor
    await EnhancedNotificationService.notifyPolicyAssigned(
      ammcId,
      surveyorId,
      surveyor.email,
      assignment._id
    );

    // Update policy status
    await PolicyRequest.findByIdAndUpdate(ammcId, {
      status: 'assigned',
      assignedSurveyors: [surveyorId]
    });

    res.json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Example 3: Survey Submission

```javascript
// When surveyor submits survey
router.post('/submission/:assignmentId/submit', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const submission = await SurveySubmission.findOne({ assignmentId });

    // Update submission status
    submission.status = 'submitted';
    submission.submissionTime = new Date();
    await submission.save();

    // Get assignment and policy
    const assignment = await Assignment.findById(assignmentId).populate('ammcId');
    const policy = assignment.ammcId;

    // Update policy status
    policy.status = 'surveyed';
    await policy.save();

    // Notify all admins
    const admins = await Employee.find({ 
      employeeRole: { $in: await getAdminRoleIds() },
      deleted: false 
    });

    await EnhancedNotificationService.notifySurveySubmitted(
      policy._id,
      admins.map(a => a._id.toString()),
      submission._id
    );

    // Notify user
    const user = await User.findById(policy.userId);
    await EnhancedNotificationService.create({
      recipientId: policy.userId,
      recipientType: 'user',
      type: 'policy_surveyed',
      title: 'Survey Completed',
      message: 'Your property survey has been completed and is under review',
      priority: 'medium',
      actionUrl: `/dashboard/policies/${policy._id}`,
      actionLabel: 'View Status',
      metadata: {
        policyId: policy._id.toString(),
        icon: 'CheckCircle',
        color: 'green'
      },
      sendEmail: true,
      recipientEmail: user.email
    });

    res.json({ success: true, submission });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Example 4: Report Ready

```javascript
// When report is ready for download
router.post('/report/:reportId/release', authenticateToken, async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await MergedReport.findById(reportId).populate('policyId');
    const policy = report.policyId;

    // Update report status
    report.status = 'released';
    report.releasedAt = new Date();
    await report.save();

    // Get user
    const user = await User.findById(policy.userId);

    // Notify user
    await EnhancedNotificationService.notifyReportReady(
      policy._id,
      policy.userId,
      user.email,
      reportId
    );

    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Example 5: Deadline Approaching (Scheduled Job)

```javascript
// Run this as a cron job every hour
const cron = require('node-cron');
const EnhancedNotificationService = require('./services/EnhancedNotificationService');

// Check for assignments with approaching deadlines
cron.schedule('0 * * * *', async () => {
  try {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Find assignments due in next 24 hours
    const assignments = await Assignment.find({
      status: { $in: ['assigned', 'in_progress'] },
      deadline: { $gte: now, $lte: in24Hours },
      deadlineNotificationSent: { $ne: true }
    }).populate('surveyorId');

    for (const assignment of assignments) {
      const hoursRemaining = Math.floor(
        (assignment.deadline - now) / (1000 * 60 * 60)
      );

      await EnhancedNotificationService.notifyDeadlineApproaching(
        assignment._id,
        assignment.surveyorId._id,
        assignment.surveyorId.email,
        hoursRemaining
      );

      // Mark as notified
      assignment.deadlineNotificationSent = true;
      await assignment.save();
    }

    console.log(`Sent ${assignments.length} deadline notifications`);
  } catch (error) {
    console.error('Deadline notification job error:', error);
  }
});
```

## Example 6: Payment Required

```javascript
// When policy is approved and payment is needed
router.post('/admin/policy/:policyId/approve', authenticateToken, async (req, res) => {
  try {
    const { policyId } = req.params;
    const { reviewNotes } = req.body;

    const policy = await PolicyRequest.findById(policyId);
    policy.status = 'approved';
    policy.adminNotes = reviewNotes;
    await policy.save();

    // Calculate payment amount
    const paymentAmount = calculatePremium(policy);

    // Get user
    const user = await User.findById(policy.userId);

    // Notify user about approval
    await EnhancedNotificationService.create({
      recipientId: policy.userId,
      recipientType: 'user',
      type: 'policy_approved',
      title: 'Policy Approved!',
      message: 'Your policy has been approved. Please proceed with payment to activate.',
      priority: 'high',
      actionUrl: `/dashboard/policies/${policyId}`,
      actionLabel: 'View Policy',
      metadata: {
        policyId: policyId,
        icon: 'CheckCircle',
        color: 'green'
      },
      sendEmail: true,
      recipientEmail: user.email
    });

    // Notify about payment
    await EnhancedNotificationService.notifyPaymentRequired(
      policyId,
      policy.userId,
      user.email,
      paymentAmount
    );

    res.json({ success: true, policy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

## Example 7: Conflict Detected

```javascript
// When report merger detects conflicts
async function mergeReports(ammcSubmission, niaSubmission) {
  try {
    // Merge logic...
    const conflicts = detectConflicts(ammcSubmission, niaSubmission);

    if (conflicts.length > 0) {
      // Get all admins
      const admins = await Employee.find({ 
        employeeRole: { $in: await getAdminRoleIds() },
        deleted: false 
      });

      // Notify admins about conflicts
      const notifications = admins.map(admin => ({
        recipientId: admin._id.toString(),
        recipientType: 'admin',
        type: 'conflict_detected',
        title: 'Report Conflict Detected',
        message: `Conflicts found in survey reports for policy ${policyId}. Manual review required.`,
        priority: 'urgent',
        actionUrl: `/admin/reports/${mergedReportId}/conflicts`,
        actionLabel: 'Review Conflicts',
        metadata: {
          policyId: policyId,
          reportId: mergedReportId,
          conflictCount: conflicts.length,
          icon: 'AlertTriangle',
          color: 'red'
        }
      }));

      await EnhancedNotificationService.createBulk(notifications);
    }

    return mergedReport;
  } catch (error) {
    console.error('Merge error:', error);
    throw error;
  }
}
```

## Example 8: Assignment Reassignment

```javascript
// When reassigning an assignment
router.patch('/admin/assignment/:assignmentId/reassign', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { newSurveyorId, reason } = req.body;

    const assignment = await Assignment.findById(assignmentId)
      .populate('surveyorId');
    
    const oldSurveyor = assignment.surveyorId;
    const newSurveyor = await Employee.findById(newSurveyorId);

    // Update assignment
    assignment.surveyorId = newSurveyorId;
    assignment.status = 'assigned';
    await assignment.save();

    // Notify old surveyor
    await EnhancedNotificationService.create({
      recipientId: oldSurveyor._id.toString(),
      recipientType: 'surveyor',
      type: 'assignment_reassigned',
      title: 'Assignment Reassigned',
      message: `Assignment has been reassigned. Reason: ${reason}`,
      priority: 'medium',
      metadata: {
        assignmentId: assignmentId,
        icon: 'UserX',
        color: 'orange'
      },
      sendEmail: true,
      recipientEmail: oldSurveyor.email
    });

    // Notify new surveyor
    await EnhancedNotificationService.notifyPolicyAssigned(
      assignment.ammcId,
      newSurveyorId,
      newSurveyor.email,
      assignmentId
    );

    res.json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

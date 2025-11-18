/**
 * Status Propagation Service
 * 
 * This service handles the propagation of broker claim status changes
 * across all dashboards (User Portal, NIA Admin, AMMC Admin)
 */

const PolicyRequest = require('../models/PolicyRequest');

/**
 * Propagate broker status change to all dashboards
 * @param {string} claimId - The claim ID
 * @param {string} newStatus - The new broker status
 * @param {Object} metadata - Additional metadata about the change
 * @returns {Promise<Object>} - Propagation result
 */
const propagateBrokerStatusChange = async (claimId, newStatus, metadata = {}) => {
    try {
        console.log(`📡 Propagating broker status change for claim ${claimId} to ${newStatus}`);

        const propagationResult = {
            claimId,
            newStatus,
            timestamp: new Date(),
            dashboards: {
                userPortal: { success: false, message: '' },
                niaAdmin: { success: false, message: '' },
                ammcAdmin: { success: false, message: '' }
            },
            retries: 0,
            errors: []
        };

        // Get the claim to verify it exists
        const claim = await PolicyRequest.findById(claimId);
        if (!claim) {
            throw new Error('Claim not found');
        }

        // In a real-world scenario, this would use WebSockets, Server-Sent Events,
        // or a message queue (like Redis Pub/Sub, RabbitMQ, or AWS SQS)
        // For now, we'll simulate the propagation with database updates and logging

        try {
            // Propagate to User Portal
            // In production: emit WebSocket event or publish to message queue
            propagationResult.dashboards.userPortal = await propagateToUserPortal(claim, newStatus, metadata);
        } catch (error) {
            console.error('❌ Failed to propagate to User Portal:', error.message);
            propagationResult.errors.push({
                dashboard: 'userPortal',
                error: error.message
            });
        }

        try {
            // Propagate to NIA Admin Dashboard
            // In production: emit WebSocket event or publish to message queue
            propagationResult.dashboards.niaAdmin = await propagateToNIAAdmin(claim, newStatus, metadata);
        } catch (error) {
            console.error('❌ Failed to propagate to NIA Admin:', error.message);
            propagationResult.errors.push({
                dashboard: 'niaAdmin',
                error: error.message
            });
        }

        try {
            // Propagate to AMMC Admin Dashboard
            // In production: emit WebSocket event or publish to message queue
            propagationResult.dashboards.ammcAdmin = await propagateToAMMCAdmin(claim, newStatus, metadata);
        } catch (error) {
            console.error('❌ Failed to propagate to AMMC Admin:', error.message);
            propagationResult.errors.push({
                dashboard: 'ammcAdmin',
                error: error.message
            });
        }

        // Log propagation result
        console.log('✅ Status propagation completed:', {
            claimId,
            newStatus,
            successCount: Object.values(propagationResult.dashboards).filter(d => d.success).length,
            errorCount: propagationResult.errors.length
        });

        return propagationResult;
    } catch (error) {
        console.error('❌ Status propagation failed:', error);
        throw error;
    }
};

/**
 * Propagate status to User Portal
 */
const propagateToUserPortal = async (claim, newStatus, metadata) => {
    try {
        // In production: Use WebSocket or SSE to push real-time updates
        // For now, we'll just log and mark as successful

        console.log(`📱 User Portal: Claim ${claim._id} status updated to ${newStatus}`);

        // Simulate notification to user
        // In production: Send email, SMS, or push notification
        if (claim.contactDetails && claim.contactDetails.email) {
            console.log(`📧 Notification sent to user: ${claim.contactDetails.email}`);
        }

        return {
            success: true,
            message: 'Status propagated to User Portal',
            timestamp: new Date()
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            timestamp: new Date()
        };
    }
};

/**
 * Propagate status to NIA Admin Dashboard
 */
const propagateToNIAAdmin = async (claim, newStatus, metadata) => {
    try {
        // In production: Use WebSocket or SSE to push real-time updates
        // For now, we'll just log and mark as successful

        console.log(`🏢 NIA Admin: Claim ${claim._id} status updated to ${newStatus}`);

        // Update any NIA-specific tracking or notifications
        // In production: Emit event to NIA admin dashboard WebSocket room

        return {
            success: true,
            message: 'Status propagated to NIA Admin Dashboard',
            timestamp: new Date()
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            timestamp: new Date()
        };
    }
};

/**
 * Propagate status to AMMC Admin Dashboard
 */
const propagateToAMMCAdmin = async (claim, newStatus, metadata) => {
    try {
        // In production: Use WebSocket or SSE to push real-time updates
        // For now, we'll just log and mark as successful

        console.log(`🏢 AMMC Admin: Claim ${claim._id} status updated to ${newStatus}`);

        // Update any AMMC-specific tracking or notifications
        // In production: Emit event to AMMC admin dashboard WebSocket room

        return {
            success: true,
            message: 'Status propagated to AMMC Admin Dashboard',
            timestamp: new Date()
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            timestamp: new Date()
        };
    }
};

/**
 * Retry failed propagations
 * @param {Object} propagationResult - The result from propagateBrokerStatusChange
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Object>} - Updated propagation result
 */
const retryFailedPropagations = async (propagationResult, maxRetries = 3) => {
    if (propagationResult.errors.length === 0 || propagationResult.retries >= maxRetries) {
        return propagationResult;
    }

    console.log(`🔄 Retrying failed propagations (attempt ${propagationResult.retries + 1}/${maxRetries})`);

    const claim = await PolicyRequest.findById(propagationResult.claimId);
    if (!claim) {
        throw new Error('Claim not found for retry');
    }

    // Retry failed dashboards
    for (const error of propagationResult.errors) {
        try {
            let result;
            switch (error.dashboard) {
                case 'userPortal':
                    result = await propagateToUserPortal(claim, propagationResult.newStatus, {});
                    propagationResult.dashboards.userPortal = result;
                    break;
                case 'niaAdmin':
                    result = await propagateToNIAAdmin(claim, propagationResult.newStatus, {});
                    propagationResult.dashboards.niaAdmin = result;
                    break;
                case 'ammcAdmin':
                    result = await propagateToAMMCAdmin(claim, propagationResult.newStatus, {});
                    propagationResult.dashboards.ammcAdmin = result;
                    break;
            }

            if (result && result.success) {
                // Remove from errors array
                propagationResult.errors = propagationResult.errors.filter(e => e.dashboard !== error.dashboard);
            }
        } catch (retryError) {
            console.error(`❌ Retry failed for ${error.dashboard}:`, retryError.message);
        }
    }

    propagationResult.retries++;

    // If there are still errors and we haven't reached max retries, schedule another retry
    if (propagationResult.errors.length > 0 && propagationResult.retries < maxRetries) {
        // In production: Use a job queue like Bull or Agenda for delayed retries
        setTimeout(() => {
            retryFailedPropagations(propagationResult, maxRetries);
        }, 5000 * propagationResult.retries); // Exponential backoff
    }

    return propagationResult;
};

/**
 * Get propagation status for a claim
 * @param {string} claimId - The claim ID
 * @returns {Promise<Object>} - Propagation status
 */
const getPropagationStatus = async (claimId) => {
    try {
        const claim = await PolicyRequest.findById(claimId)
            .select('brokerStatus brokerStatusHistory')
            .lean();

        if (!claim) {
            throw new Error('Claim not found');
        }

        const latestStatusChange = claim.brokerStatusHistory && claim.brokerStatusHistory.length > 0
            ? claim.brokerStatusHistory[claim.brokerStatusHistory.length - 1]
            : null;

        return {
            claimId,
            currentStatus: claim.brokerStatus,
            lastStatusChange: latestStatusChange,
            propagationComplete: true, // In production: check actual propagation status
            dashboards: {
                userPortal: { synced: true, lastSync: latestStatusChange?.changedAt },
                niaAdmin: { synced: true, lastSync: latestStatusChange?.changedAt },
                ammcAdmin: { synced: true, lastSync: latestStatusChange?.changedAt }
            }
        };
    } catch (error) {
        console.error('Error getting propagation status:', error);
        throw error;
    }
};

module.exports = {
    propagateBrokerStatusChange,
    retryFailedPropagations,
    getPropagationStatus
};

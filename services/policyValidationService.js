const PolicyRequest = require('../models/PolicyRequest');

/**
 * Validate policy exists and retrieve details
 * @param {string} policyNumber - The policy number to validate
 * @param {string} userId - Optional user ID to verify ownership
 * @returns {Promise<{isValid: boolean, policy: Object|null, error: string|null}>}
 */
const validatePolicy = async (policyNumber, userId = null) => {
    try {
        // Query PolicyRequest by policy number
        // Note: In the current system, PolicyRequest doesn't have a policyNumber field by default
        // We'll need to search by referenceNumber or add policyNumber field
        const policy = await PolicyRequest.findOne({
            $or: [
                { referenceNumber: policyNumber },
                { 'propertyDetails.address': { $regex: policyNumber, $options: 'i' } }
            ]
        }).populate('propertyId');

        if (!policy) {
            return {
                isValid: false,
                policy: null,
                error: 'Policy number not found'
            };
        }

        // If userId is provided, verify the policy belongs to the user
        if (userId && policy.userId !== userId) {
            return {
                isValid: false,
                policy: null,
                error: 'Policy does not belong to this user'
            };
        }

        // Check if policy is in a valid state (not rejected or cancelled)
        const invalidStatuses = ['rejected'];
        if (invalidStatuses.includes(policy.status)) {
            return {
                isValid: false,
                policy: null,
                error: `Policy is ${policy.status} and cannot be used for claims`
            };
        }

        // Return policy details
        return {
            isValid: true,
            policy: {
                _id: policy._id,
                policyNumber: policy.referenceNumber || policyNumber,
                userId: policy.userId,
                policyType: policy.requestDetails?.coverageType || 'N/A',
                coverageType: policy.requestDetails?.coverageType,
                policyDuration: policy.requestDetails?.policyDuration,
                additionalCoverage: policy.requestDetails?.additionalCoverage || [],
                propertyDetails: {
                    address: policy.propertyDetails?.address,
                    propertyType: policy.propertyDetails?.propertyType,
                    constructionType: policy.propertyDetails?.constructionMaterial,
                    yearBuilt: policy.propertyDetails?.yearBuilt,
                    squareFootage: policy.propertyDetails?.squareFootage,
                    buildingValue: policy.propertyDetails?.buildingValue
                },
                contactDetails: {
                    name: policy.contactDetails?.fullName,
                    email: policy.contactDetails?.email,
                    phone: policy.contactDetails?.phoneNumber
                },
                status: policy.status,
                createdAt: policy.createdAt
            },
            error: null
        };
    } catch (error) {
        console.error('Policy validation error:', error);
        return {
            isValid: false,
            policy: null,
            error: 'An error occurred while validating the policy'
        };
    }
};

/**
 * Search user's policies
 * @param {string} userId - The user ID to search policies for
 * @param {string} query - The search query (partial policy number or address)
 * @returns {Promise<Array>} Array of matching policies
 */
const searchUserPolicies = async (userId, query) => {
    try {
        // Search for policies belonging to the user
        // Match by reference number or property address
        const searchRegex = new RegExp(query, 'i');

        const policies = await PolicyRequest.find({
            userId: userId,
            status: { $nin: ['rejected'] }, // Exclude rejected policies
            $or: [
                { referenceNumber: searchRegex },
                { 'propertyDetails.address': searchRegex }
            ]
        })
            .select('referenceNumber requestDetails.coverageType requestDetails.policyDuration propertyDetails.address status createdAt')
            .limit(10)
            .sort({ createdAt: -1 });

        // Format results for frontend
        return policies.map(policy => ({
            _id: policy._id,
            policyNumber: policy.referenceNumber,
            policyType: policy.requestDetails?.coverageType || 'N/A',
            coverageType: policy.requestDetails?.coverageType,
            policyDuration: policy.requestDetails?.policyDuration,
            address: policy.propertyDetails?.address,
            status: policy.status,
            createdAt: policy.createdAt
        }));
    } catch (error) {
        console.error('Policy search error:', error);
        return [];
    }
};

module.exports = {
    validatePolicy,
    searchUserPolicies
};

const PolicyRequest = require('../models/PolicyRequest');

/**
 * Generate unique reference number for claim
 * Format: CLM-YYYYMMDD-XXXX
 * @returns {Promise<string>} Unique reference number
 */
const generateReferenceNumber = async () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Find the highest sequence number for today
    const prefix = `CLM-${dateStr}`;
    const existingClaims = await PolicyRequest.find({
        referenceNumber: { $regex: `^${prefix}` }
    })
        .select('referenceNumber')
        .sort({ referenceNumber: -1 })
        .limit(1);

    let sequence = 1;
    if (existingClaims.length > 0) {
        const lastRef = existingClaims[0].referenceNumber;
        const lastSequence = parseInt(lastRef.split('-')[2]);
        sequence = lastSequence + 1;
    }

    const sequenceStr = String(sequence).padStart(4, '0');
    return `${prefix}-${sequenceStr}`;
};

/**
 * Create new claim request
 * @param {Object} data - Claim data
 * @param {string} data.userId - User ID submitting the claim
 * @param {string} data.policyNumber - Policy number being claimed
 * @param {string} data.claimReason - Reason for the claim
 * @param {Object} data.policyDetails - Complete policy information
 * @param {Array} data.documents - Array of document metadata
 * @returns {Promise<{success: boolean, claimId: string, referenceNumber: string}>}
 */
const createClaimRequest = async (data) => {
    try {
        const { userId, policyNumber, claimReason, policyDetails, documents = [] } = data;

        // Generate unique reference number
        const referenceNumber = await generateReferenceNumber();

        // Create claim request using PolicyRequest model
        const claimRequest = new PolicyRequest({
            userId,
            referenceNumber,
            claimReason,
            claimRequested: true,
            claimRequestedAt: new Date(),

            // Copy property details from policy
            propertyDetails: {
                address: policyDetails.propertyDetails?.address || '',
                propertyType: policyDetails.propertyDetails?.propertyType || '',
                buildingValue: policyDetails.propertyDetails?.buildingValue || 0,
                yearBuilt: policyDetails.propertyDetails?.yearBuilt || new Date().getFullYear(),
                squareFootage: policyDetails.propertyDetails?.squareFootage || 0,
                constructionMaterial: policyDetails.propertyDetails?.constructionType || 'Concrete Block'
            },

            // Copy contact details from policy
            contactDetails: {
                fullName: policyDetails.contactDetails?.name || '',
                email: policyDetails.contactDetails?.email || '',
                phoneNumber: policyDetails.contactDetails?.phone || '',
                alternatePhone: '',
                rcNumber: policyDetails.contactDetails?.rcNumber || 'N/A'
            },

            // Copy request/coverage details from policy
            requestDetails: {
                coverageType: policyDetails.coverageType || 'Contract Works Coverage',
                policyDuration: policyDetails.policyDuration || '1 Year',
                additionalCoverage: policyDetails.additionalCoverage || [],
                specialRequests: `Claim for policy: ${policyNumber}`
            },

            // Set initial status
            status: 'submitted',
            submittedAt: new Date(),

            // Store documents metadata
            documents: documents.map(doc => ({
                fileName: doc.fileName,
                fileType: doc.fileType,
                fileSize: doc.fileSize,
                cloudinaryUrl: doc.cloudinaryUrl,
                cloudinaryPublicId: doc.cloudinaryPublicId,
                category: 'supporting_documents',
                documentType: 'other',
                uploadedBy: userId,
                uploadedAt: new Date(),
                isRequired: false,
                isVerified: false
            })),

            // Initialize status history
            statusHistory: [{
                status: 'submitted',
                changedAt: new Date(),
                reason: 'Claim submitted by user'
            }],

            // Set priority and deadline
            priority: 'medium',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        });

        // Save to database
        await claimRequest.save();

        console.log(`Claim created successfully: ${referenceNumber} for user ${userId}`);

        return {
            success: true,
            claimId: claimRequest._id.toString(),
            referenceNumber: referenceNumber,
            claim: claimRequest
        };
    } catch (error) {
        console.error('Claim creation error:', error);
        return {
            success: false,
            claimId: null,
            referenceNumber: null,
            error: error.message
        };
    }
};

module.exports = {
    generateReferenceNumber,
    createClaimRequest
};

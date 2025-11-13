const PolicyRequest = require('../models/PolicyRequest');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');
const { validatePolicy } = require('../services/policyValidationService');
const { createClaimRequest } = require('../services/claimCreationService');
const { uploadDocuments, validateFiles } = require('../services/fileUploadService');

// Submit new claim
const submitClaim = async (req, res) => {
    try {
        const { policyNumber, claimReason } = req.body;
        const userId = req.user.userId.toString();

        // Validate required fields
        if (!policyNumber || !policyNumber.trim()) {
            throw new BadRequestError('Policy number is required');
        }

        if (!claimReason || !claimReason.trim()) {
            throw new BadRequestError('Claim reason is required');
        }

        if (claimReason.trim().length < 20) {
            throw new BadRequestError('Claim reason must be at least 20 characters');
        }

        // Sanitize user input
        const sanitizedPolicyNumber = policyNumber.trim();
        const sanitizedClaimReason = claimReason.trim().substring(0, 1000); // Limit to 1000 chars

        // Validate policy number
        const policyValidation = await validatePolicy(sanitizedPolicyNumber, userId);

        if (!policyValidation.isValid) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                error: policyValidation.error
            });
        }

        // Validate uploaded files (if any)
        let uploadedDocuments = [];
        if (req.files && req.files.length > 0) {
            const fileValidation = validateFiles(req.files);
            if (!fileValidation.isValid) {
                throw new BadRequestError(fileValidation.errors.join('; '));
            }
        }

        // Create claim request
        const claimResult = await createClaimRequest({
            userId,
            policyNumber: sanitizedPolicyNumber,
            claimReason: sanitizedClaimReason,
            policyDetails: policyValidation.policy,
            documents: []
        });

        if (!claimResult.success) {
            throw new Error(claimResult.error || 'Failed to create claim request');
        }

        // Upload files if present
        if (req.files && req.files.length > 0) {
            try {
                uploadedDocuments = await uploadDocuments(req.files, claimResult.claimId);

                // Update claim with document metadata
                const claim = await PolicyRequest.findById(claimResult.claimId);
                claim.documents = uploadedDocuments.map(doc => ({
                    fileName: doc.fileName,
                    fileType: doc.fileType,
                    fileSize: doc.fileSize,
                    cloudinaryUrl: doc.cloudinaryUrl,
                    cloudinaryPublicId: doc.cloudinaryPublicId,
                    category: 'supporting_documents',
                    documentType: 'other',
                    uploadedBy: userId,
                    uploadedAt: doc.uploadedAt,
                    isRequired: false,
                    isVerified: false
                }));
                await claim.save();
            } catch (uploadError) {
                console.error('File upload error:', uploadError);
                // Don't fail the claim submission if file upload fails
            }
        }

        console.log(`Claim submitted successfully: ${claimResult.referenceNumber} by user ${userId}`);

        res.status(StatusCodes.CREATED).json({
            success: true,
            message: 'Claim submitted successfully',
            claimId: claimResult.claimId,
            referenceNumber: claimResult.referenceNumber,
            documentsUploaded: uploadedDocuments.length
        });
    } catch (error) {
        console.error('Submit claim error:', error);

        if (error instanceof BadRequestError || error instanceof NotFoundError) {
            throw error;
        }

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to submit claim',
            error: error.message
        });
    }
};

// Get user's claims
const getUserClaims = async (req, res) => {
    const { userId } = req.params;

    // Verify user can only access their own claims (unless admin)
    if (req.user.model === 'User' && req.user.userId.toString() !== userId) {
        throw new UnauthenticatedError('You can only access your own claims');
    }

    const claims = await PolicyRequest.find({ userId })
        .sort({ createdAt: -1 })
        .select('policyNumber claimReason referenceNumber status submittedAt createdAt requestDetails.coverageType');

    res.status(StatusCodes.OK).json({
        success: true,
        count: claims.length,
        claims
    });
};

// Get claim details
const getClaimDetails = async (req, res) => {
    const { claimId } = req.params;

    const claim = await PolicyRequest.findById(claimId);

    if (!claim) {
        throw new NotFoundError(`Claim with ID ${claimId} not found`);
    }

    // Verify user can only access their own claims (unless admin)
    if (req.user.model === 'User' && req.user.userId.toString() !== claim.userId) {
        throw new UnauthenticatedError('You can only access your own claims');
    }

    res.status(StatusCodes.OK).json({
        success: true,
        claim,
        statusHistory: claim.statusHistory
    });
};

// Download document
const downloadDocument = async (req, res) => {
    res.status(StatusCodes.OK).json({
        success: true,
        message: 'Document download endpoint - to be implemented'
    });
};

module.exports = {
    submitClaim,
    getUserClaims,
    getClaimDetails,
    downloadDocument
};

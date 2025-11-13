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
    try {
        const { userId } = req.params;

        // Verify user can only access their own claims (unless admin)
        if (req.user.model === 'User' && req.user.userId.toString() !== userId) {
            throw new UnauthenticatedError('You can only access your own claims');
        }

        // Query claims for the user, filtering by claimReason field to identify claims
        const claims = await PolicyRequest.find({
            userId,
            claimReason: { $exists: true, $ne: null } // Only get records that are claims
        })
            .sort({ createdAt: -1 }) // Most recent first
            .select('referenceNumber claimReason status createdAt requestDetails.coverageType propertyDetails.address documents');

        // Format claims for response
        const formattedClaims = claims.map(claim => ({
            _id: claim._id,
            policyNumber: claim.referenceNumber,
            claimReason: claim.claimReason ? claim.claimReason.substring(0, 100) + (claim.claimReason.length > 100 ? '...' : '') : '',
            referenceNumber: claim.referenceNumber,
            status: claim.status,
            submissionDate: claim.createdAt,
            coverageType: claim.requestDetails?.coverageType || 'N/A',
            address: claim.propertyDetails?.address || 'N/A',
            documentsCount: claim.documents?.length || 0
        }));

        res.status(StatusCodes.OK).json({
            success: true,
            count: formattedClaims.length,
            claims: formattedClaims
        });
    } catch (error) {
        console.error('Get user claims error:', error);

        if (error instanceof UnauthenticatedError) {
            throw error;
        }

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to retrieve claims',
            error: error.message
        });
    }
};

// Get claim details
const getClaimDetails = async (req, res) => {
    try {
        const { claimId } = req.params;

        const claim = await PolicyRequest.findById(claimId);

        if (!claim) {
            throw new NotFoundError(`Claim with ID ${claimId} not found`);
        }

        // Verify this is actually a claim (has claimReason)
        if (!claim.claimReason) {
            throw new NotFoundError('This is not a claim request');
        }

        // Verify user can only access their own claims (unless admin)
        if (req.user.model === 'User' && req.user.userId.toString() !== claim.userId) {
            throw new UnauthenticatedError('You can only access your own claims');
        }

        // Format claim details for response
        const claimDetails = {
            _id: claim._id,
            referenceNumber: claim.referenceNumber,
            policyNumber: claim.referenceNumber,
            claimReason: claim.claimReason,
            status: claim.status,
            submissionDate: claim.createdAt,
            lastUpdated: claim.updatedAt,
            policyType: claim.requestDetails?.coverageType || 'N/A',
            coverageType: claim.requestDetails?.coverageType,
            policyDuration: claim.requestDetails?.policyDuration,
            additionalCoverage: claim.requestDetails?.additionalCoverage || [],
            propertyDetails: {
                address: claim.propertyDetails?.address,
                propertyType: claim.propertyDetails?.propertyType,
                buildingValue: claim.propertyDetails?.buildingValue,
                yearBuilt: claim.propertyDetails?.yearBuilt,
                squareFootage: claim.propertyDetails?.squareFootage,
                constructionMaterial: claim.propertyDetails?.constructionMaterial
            },
            contactDetails: {
                name: claim.contactDetails?.fullName,
                email: claim.contactDetails?.email,
                phone: claim.contactDetails?.phoneNumber
            },
            documents: claim.documents?.map(doc => ({
                _id: doc._id,
                fileName: doc.fileName,
                fileType: doc.fileType,
                fileSize: doc.fileSize,
                uploadedAt: doc.uploadedAt,
                cloudinaryPublicId: doc.cloudinaryPublicId
            })) || [],
            statusHistory: claim.statusHistory?.map(history => ({
                status: history.status,
                timestamp: history.changedAt,
                reason: history.reason,
                changedBy: history.changedBy
            })) || []
        };

        res.status(StatusCodes.OK).json({
            success: true,
            claim: claimDetails,
            statusHistory: claimDetails.statusHistory
        });
    } catch (error) {
        console.error('Get claim details error:', error);

        if (error instanceof NotFoundError || error instanceof UnauthenticatedError) {
            throw error;
        }

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to retrieve claim details',
            error: error.message
        });
    }
};

// Download document
const downloadDocument = async (req, res) => {
    try {
        const { claimId, documentId } = req.params;

        // Find the claim
        const claim = await PolicyRequest.findById(claimId);

        if (!claim) {
            throw new NotFoundError(`Claim with ID ${claimId} not found`);
        }

        // Verify user can only access their own claim documents (unless admin)
        if (req.user.model === 'User' && req.user.userId.toString() !== claim.userId) {
            throw new UnauthenticatedError('You can only access your own claim documents');
        }

        // Find the document in the claim
        const document = claim.documents?.find(doc => doc._id.toString() === documentId);

        if (!document) {
            throw new NotFoundError(`Document with ID ${documentId} not found in this claim`);
        }

        // Return the Cloudinary URL for direct download
        // The client can download directly from Cloudinary
        res.status(StatusCodes.OK).json({
            success: true,
            document: {
                fileName: document.fileName,
                fileType: document.fileType,
                fileSize: document.fileSize,
                downloadUrl: document.cloudinaryUrl,
                uploadedAt: document.uploadedAt
            }
        });
    } catch (error) {
        console.error('Download document error:', error);

        if (error instanceof NotFoundError || error instanceof UnauthenticatedError) {
            throw error;
        }

        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to retrieve document',
            error: error.message
        });
    }
};

module.exports = {
    submitClaim,
    getUserClaims,
    getClaimDetails,
    downloadDocument
};

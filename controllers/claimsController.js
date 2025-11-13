const PolicyRequest = require('../models/PolicyRequest');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, NotFoundError, UnauthenticatedError } = require('../errors');

// Submit new claim
const submitClaim = async (req, res) => {
    res.status(StatusCodes.OK).json({
        success: true,
        message: 'Claim submission endpoint - to be implemented'
    });
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

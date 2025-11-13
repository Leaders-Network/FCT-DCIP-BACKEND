const express = require('express');
const router = express.Router();
const {
    submitClaim,
    getUserClaims,
    getClaimDetails,
    downloadDocument
} = require('../controllers/claimsController');
const { protect, allowUserOrAdmin } = require('../middlewares/authentication');

// All routes require authentication
router.use(protect);

// Submit new claim - users and admins can submit
router.post('/submit', allowUserOrAdmin, submitClaim);

// Get user's claims - users can get their own, admins can get any
router.get('/user/:userId', allowUserOrAdmin, getUserClaims);

// Get claim details - users can get their own, admins can get any
router.get('/:claimId', allowUserOrAdmin, getClaimDetails);

// Download document - users can download their own claim docs, admins can download any
router.get('/:claimId/documents/:documentId', allowUserOrAdmin, downloadDocument);

module.exports = router;

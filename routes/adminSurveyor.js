const express = require('express');
const { createSurveyor, getAllSurveyors, getSurveyorById, updateSurveyor, deleteSurveyor } = require('../controllers/adminSurveyor');
const auth = require('../middlewares/authentication');

const router = express.Router();

// All routes require authentication and admin role (add admin check as needed)
router.use(auth);

router.post('/', createSurveyor); // Create surveyor
router.get('/', getAllSurveyors); // Get all surveyors
router.get('/:id', getSurveyorById); // Get surveyor by ID
router.patch('/:id', updateSurveyor); // Update surveyor
router.delete('/:id', deleteSurveyor); // Delete surveyor

module.exports = router;

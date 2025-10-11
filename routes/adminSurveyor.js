const express = require('express');
const { createSurveyor, getAllSurveyors, getSurveyorById, updateSurveyor, deleteSurveyor } = require('../controllers/adminSurveyor');
const { protect, restrictTo } = require('../middlewares/authentication');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(restrictTo('Admin', 'Super-admin'));

router.post('/', createSurveyor); // Create surveyor
router.get('/', getAllSurveyors); // Get all surveyors
router.get('/:id', getSurveyorById); // Get surveyor by ID
router.patch('/:id', updateSurveyor); // Update surveyor
router.delete('/:id', deleteSurveyor); // Delete surveyor

// Update only availability
router.patch('/:id/availability', protect, restrictTo('Admin', 'Super-admin'), async (req, res) => {
	const { id } = req.params;
	const { availability } = req.body;
	if (!['available', 'busy', 'on-leave'].includes(availability)) {
		return res.status(400).json({ success: false, message: 'Invalid availability value' });
	}
	try {
		const surveyor = await require('../models/Surveyor').findByIdAndUpdate(
			id,
			{ 'profile.availability': availability },
			{ new: true, runValidators: true }
		);
		if (!surveyor) return res.status(404).json({ success: false, message: 'Surveyor not found' });
		res.status(200).json({ success: true, data: surveyor });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
});

module.exports = router;

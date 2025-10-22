const express = require('express');
const { 
  getUserProperties, 
  deleteProperty 
} = require('../controllers/property');
const { protect, restrictToModel, allowUserOrAdmin } = require('../middlewares/authentication');

const router = express.Router();

// All routes require authentication
router.use(protect);

// User property routes
router.get('/user', allowUserOrAdmin, getUserProperties);
router.delete('/:propertyId', deleteProperty); // Both users and admins can delete

module.exports = router;
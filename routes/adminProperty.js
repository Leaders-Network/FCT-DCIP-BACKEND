const express = require('express');
const { 
  adminGetAllProperties, 
  deleteProperty, 
  restoreProperty 
} = require('../controllers/property');
const { protect, restrictTo } = require('../middlewares/authentication');

const router = express.Router();

router.use(protect);
router.use(restrictTo('Admin', 'Super-admin'));

router.get('/', adminGetAllProperties);
router.delete('/:propertyId', deleteProperty);
router.patch('/:propertyId/restore', restoreProperty);

module.exports = router;

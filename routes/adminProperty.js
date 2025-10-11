const express = require('express');
const { adminGetAllProperties } = require('../controllers/property');
const { protect, restrictTo } = require('../middlewares/authentication');

const router = express.Router();

router.use(protect);
router.use(restrictTo('Admin', 'Super-admin'));

router.get('/', adminGetAllProperties);

module.exports = router;

const express = require('express');
const { adminGetAllProperties } = require('../controllers/property');
const auth = require('../middlewares/authentication');
const adminOnly = require('../middlewares/adminOnly');

const router = express.Router();

router.use(auth);
router.use(adminOnly);

router.get('/', adminGetAllProperties);

module.exports = router;

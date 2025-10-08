const express = require('express');
const { getAllEmployees } = require('../controllers/adminEmployee');
const auth = require('../middlewares/authentication');
const adminOnly = require('../middlewares/adminOnly');

const router = express.Router();

router.use(auth);
router.use(adminOnly);

router.get('/', getAllEmployees);

module.exports = router;

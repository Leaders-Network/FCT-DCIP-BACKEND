const express = require('express');
const {
  createAdministrator,
  getAllAdministrators,
} = require('../controllers/adminAdministrator');
const auth = require('../middlewares/authentication');
const adminOnly = require('../middlewares/adminOnly');

const router = express.Router();

// All routes require authentication and admin role
router.use(auth);
router.use(adminOnly);

router.post('/', createAdministrator);
router.get('/', getAllAdministrators);

module.exports = router;

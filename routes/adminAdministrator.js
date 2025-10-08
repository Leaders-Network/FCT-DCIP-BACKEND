const express = require('express');
const {
  createAdministrator,
  getAllAdministrators,
  deleteAdministrator,
  updateAdministratorStatus,
} = require('../controllers/adminAdministrator');
const auth = require('../middlewares/authentication');
const adminOnly = require('../middlewares/adminOnly');

const router = express.Router();

// All routes require authentication and admin role
router.use(auth);
router.use(adminOnly);

router.post('/', createAdministrator);
router.get('/', getAllAdministrators);
router.delete('/:id', deleteAdministrator);
router.patch('/:id/status', updateAdministratorStatus);

module.exports = router;

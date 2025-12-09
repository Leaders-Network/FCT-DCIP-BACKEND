const express = require('express');
const {
  createAdministrator,
  getAllAdministrators,
  updateAdministrator,
  deleteAdministrator,
  updateAdministratorStatus,
} = require('../controllers/adminAdministrator');
const { protect, restrictTo } = require('../middlewares/authentication');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(restrictTo('Admin', 'Super-admin', 'NIA-Admin'));

router.post('/', createAdministrator);
router.get('/', getAllAdministrators);
router.patch('/:id', updateAdministrator);
router.delete('/:id', deleteAdministrator);
router.patch('/:id/status', updateAdministratorStatus);

module.exports = router;

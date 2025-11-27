const express = require('express');
const { getAllEmployees, deleteEmployee, updateEmployeeStatus } = require('../controllers/adminEmployee');
const { protect, restrictTo } = require('../middlewares/authentication');

const router = express.Router();

router.use(protect);
router.use(restrictTo('Admin', 'Super-admin'));

router.get('/', getAllEmployees);
router.delete('/:id', deleteEmployee);
router.patch('/:id/status', updateEmployeeStatus);

module.exports = router;

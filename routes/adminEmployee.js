const express = require('express');
const { getAllEmployees, deleteEmployee, updateEmployeeStatus } = require('../controllers/adminEmployee');
const auth = require('../middlewares/authentication');
const adminOnly = require('../middlewares/adminOnly');

const router = express.Router();

router.use(auth);
router.use(adminOnly);

router.get('/', getAllEmployees);
router.delete('/:id', deleteEmployee);
router.patch('/:id/status', updateEmployeeStatus);

module.exports = router;

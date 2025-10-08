const { StatusCodes } = require('http-status-codes');
const { Employee } = require('../models/Employee');

// Get all employees
const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ deleted: false }).populate('employeeRole employeeStatus');
    res.status(StatusCodes.OK).json({ success: true, data: employees });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllEmployees,
};

const { StatusCodes } = require('http-status-codes');
const { Employee, Status } = require('../models/Employee');
const { NotFoundError } = require('../errors');

// Get all employees
const getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ deleted: false }).populate('employeeRole employeeStatus');
    res.status(StatusCodes.OK).json({ success: true, data: employees });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

// Delete an employee
const deleteEmployee = async (req, res) => {
  try {
    const { id: employeeId } = req.params;
    const employee = await Employee.findByIdAndUpdate(employeeId, { deleted: true }, { new: true });

    if (!employee) {
      throw new NotFoundError(`Employee with id ${employeeId} not found`);
    }

    res.status(StatusCodes.OK).json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

// Update employee status
const updateEmployeeStatus = async (req, res) => {
  try {
    const { id: employeeId } = req.params;
    const { status } = req.body;

    const statusObj = await Status.findOne({ status: status });
    if (!statusObj) {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Invalid status' });
    }

    const employee = await Employee.findByIdAndUpdate(
      employeeId,
      { employeeStatus: statusObj._id },
      { new: true }
    ).populate('employeeRole employeeStatus');

    if (!employee) {
      throw new NotFoundError(`Employee with id ${employeeId} not found`);
    }

    res.status(StatusCodes.OK).json({ success: true, data: employee });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};


module.exports = {
  getAllEmployees,
  deleteEmployee,
  updateEmployeeStatus,
};

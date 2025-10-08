const { StatusCodes } = require('http-status-codes');
const { Employee, Role, Status } = require('../models/Employee');
const { BadRequestError, NotFoundError } = require('../errors');

// Create a new administrator (Super-admin only)
const createAdministrator = async (req, res) => {
  try {
    const { firstname, lastname, email, phonenumber } = req.body;

    // Check if employee exists
    let employee = await Employee.findOne({ email });
    if (employee) {
      throw new BadRequestError('Employee with this email already exists');
    }

    const adminRole = await Role.findOne({ role: 'Admin' });
    if (!adminRole) {
      throw new Error('Admin role not found');
    }

    const activeStatus = await Status.findOne({ status: 'Active' });
    if (!activeStatus) {
      throw new Error('Active status not found');
    }

    employee = await Employee.create({
      firstname,
      lastname,
      email,
      phonenumber,
      employeeRole: adminRole._id,
      employeeStatus: activeStatus._id,
    });

    res.status(StatusCodes.CREATED).json({ success: true, data: employee });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

// Get all administrators
const getAllAdministrators = async (req, res) => {
  try {
    const adminRole = await Role.findOne({ role: 'Admin' });
    const superAdminRole = await Role.findOne({ role: 'Super-admin' });

    const administrators = await Employee.find({
      employeeRole: { $in: [adminRole._id, superAdminRole._id] },
      deleted: false,
    }).populate('employeeRole employeeStatus');

    res.status(StatusCodes.OK).json({ success: true, data: administrators });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

// Delete an administrator
const deleteAdministrator = async (req, res) => {
    try {
        const { id: adminId } = req.params;
        const administrator = await Employee.findByIdAndUpdate(adminId, { deleted: true }, { new: true });

        if (!administrator) {
            throw new NotFoundError(`Administrator with id ${adminId} not found`);
        }

        res.status(StatusCodes.OK).json({ success: true, message: 'Administrator deleted successfully' });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
};

// Update administrator status
const updateAdministratorStatus = async (req, res) => {
    try {
        const { id: adminId } = req.params;
        const { status } = req.body;

        const statusObj = await Status.findOne({ status: status });
        if (!statusObj) {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'Invalid status' });
        }

        const administrator = await Employee.findByIdAndUpdate(
            adminId,
            { employeeStatus: statusObj._id },
            { new: true }
        ).populate('employeeRole employeeStatus');

        if (!administrator) {
            throw new NotFoundError(`Administrator with id ${adminId} not found`);
        }

        res.status(StatusCodes.OK).json({ success: true, data: administrator });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
    }
};

module.exports = {
  createAdministrator,
  getAllAdministrators,
  deleteAdministrator,
  updateAdministratorStatus,
};

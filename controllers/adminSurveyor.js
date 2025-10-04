const { StatusCodes } = require('http-status-codes');
const Surveyor = require('../models/Surveyor');
const Employee = require('../models/Employee');
const { BadRequestError, NotFoundError } = require('../errors');

// Create a new surveyor (admin only)
const createSurveyor = async (req, res) => {
  try {
    const { firstname, lastname, email, phonenumber, specializations, licenseNumber, address, emergencyContact, notes } = req.body;
    // Check if employee exists
    let employee = await Employee.findOne({ email });
    if (!employee) {
      employee = await Employee.create({ firstname, lastname, email, phonenumber, employeeRole: req.body.employeeRole || null, employeeStatus: req.body.employeeStatus || null });
    }
    // Create surveyor profile
    const surveyor = await Surveyor.create({
      userId: employee._id,
      profile: {
        specialization: specializations || [],
        certifications: [],
        experience: 0,
        location: {},
        availability: 'available',
      },
      status: 'active',
      settings: {},
      statistics: {},
    });
    res.status(StatusCodes.CREATED).json({ success: true, data: surveyor });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

// Get all surveyors
const getAllSurveyors = async (req, res) => {
  try {
    const surveyors = await Surveyor.find({}).populate('userId', 'firstname lastname email phonenumber');
    res.status(StatusCodes.OK).json({ success: true, data: surveyors });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

// Get surveyor by ID
const getSurveyorById = async (req, res) => {
  try {
    const { id } = req.params;
    const surveyor = await Surveyor.findById(id).populate('userId', 'firstname lastname email phonenumber');
    if (!surveyor) throw new NotFoundError('Surveyor not found');
    res.status(StatusCodes.OK).json({ success: true, data: surveyor });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

// Update surveyor
const updateSurveyor = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const surveyor = await Surveyor.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!surveyor) throw new NotFoundError('Surveyor not found');
    res.status(StatusCodes.OK).json({ success: true, data: surveyor });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

// Delete surveyor
const deleteSurveyor = async (req, res) => {
  try {
    const { id } = req.params;
    const surveyor = await Surveyor.findByIdAndDelete(id);
    if (!surveyor) throw new NotFoundError('Surveyor not found');
    res.status(StatusCodes.OK).json({ success: true, message: 'Surveyor deleted' });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

module.exports = {
  createSurveyor,
  getAllSurveyors,
  getSurveyorById,
  updateSurveyor,
  deleteSurveyor,
};

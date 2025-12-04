const { StatusCodes } = require('http-status-codes');
const Surveyor = require('../models/Surveyor');
const { Employee, Status, Role } = require('../models/Employee');
const { BadRequestError, NotFoundError } = require('../errors');

// Create a new surveyor (admin only)
const createSurveyor = async (req, res) => {
  try {
    const { firstname, lastname, email, phonenumber, specializations, licenseNumber, address, emergencyContact, notes, role, status, rating, organization } = req.body;

    // Create a new object without the 'role' property from req.body
    const employeeDataFromReqBody = { ...req.body };
    delete employeeDataFromReqBody.role; // <--- Add this line

    // Check if employee exists
    let employee = await Employee.findOne({ email });
    if (!employee) {
      // Get surveyor role and default status
      const surveyorRole = await Role.findOne({ role: 'Surveyor' });
      const activeStatus = await Status.findOne({ status: 'Active' });

      if (!surveyorRole) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Surveyor role not found. Please contact system administrator.'
        });
      }

      if (!activeStatus) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          message: 'Active status not found. Please contact system administrator.'
        });
      }

      employee = await Employee.create({
        firstname,
        lastname,
        email,
        phonenumber,
        employeeRole: surveyorRole._id,
        employeeStatus: activeStatus._id
      });
    }

    // Check if surveyor profile already exists
    const existingSurveyor = await Surveyor.findOne({ userId: employee._id });
    if (existingSurveyor) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Surveyor profile already exists for this employee.'
      });
    }

    // Create surveyor profile
    const surveyor = await Surveyor.create({
      userId: employee._id,
      profile: {
        specialization: specializations ?
          specializations.map(spec => spec.toLowerCase()) :
          ['residential'],
        certifications: [],
        experience: 0,
        location: {
          state: address?.state || '',
          city: address?.city || '',
          area: address?.area || []
        },
        availability: 'available',
      },
      emergencyContact: emergencyContact || '',
      address: typeof address === 'string' ? address : address?.state || '',
      licenseNumber: licenseNumber || '',
      role: role || 'Surveyor',
      rating: rating || 0,
      status: status || 'active',
      organization: organization || 'AMMC', // Default to AMMC if not specified
      settings: {
        notifications: {
          email: true,
          sms: false,
          pushNotifications: true
        },
        workingHours: {
          start: '09:00',
          end: '17:00',
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      },
      statistics: {
        totalAssignments: 0,
        completedSurveys: 0,
        pendingAssignments: 0,
        averageRating: 0,
        totalRatings: 0
      },
    });

    // Populate the response with employee data
    const populatedSurveyor = await Surveyor.findById(surveyor._id).populate('userId', 'firstname lastname email phonenumber');

    // Send credentials email to surveyor
    const sendEmail = require('../utils/sendEmail');
    const objectId = employee._id.toString();
    const credentialsHtml = `<div>
      <h2>Welcome to DCIP!</h2>
      <p>Your account has been created as a surveyor.</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Default Password:</b> ${objectId}</p>
      <p>Please log in at <a href="http://localhost:3000/surveyor">http://localhost:3000/surveyor</a> and change your password after first login.</p>
    </div>`;
    await sendEmail(email, 'surveyorCredentials', credentialsHtml);

    // Send credentials email to admin
    const adminEmail = req.user?.email || process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const adminHtml = `<div>
          <h2>New Surveyor Created</h2>
          <p>A new surveyor account has been created.</p>
          <p><b>Surveyor Email:</b> ${email}</p>
          <p><b>Default Password:</b> ${objectId}</p>
        </div>`;
      await sendEmail(adminEmail, 'surveyorCredentials', adminHtml);
    }

    res.status(StatusCodes.CREATED).json({ success: true, data: populatedSurveyor });
  } catch (error) {
    console.error('Create surveyor error:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: error.message });
  }
};

// Get all surveyors
const getAllSurveyors = async (req, res) => {
  try {
    const { status, organization, search, specialization } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }
    if (organization) {
      query.organization = organization;
    }
    if (specialization) {
      query['profile.specialization'] = { $in: [specialization.toLowerCase()] };
    }

    // Get surveyors first
    let surveyors = await Surveyor.find(query).populate('userId', 'firstname lastname email phonenumber');

    // Apply search filter on populated data (since we need to search employee fields)
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      surveyors = surveyors.filter(surveyor => {
        const user = surveyor.userId;
        return (
          (user?.firstname || '').toLowerCase().includes(searchLower) ||
          (user?.lastname || '').toLowerCase().includes(searchLower) ||
          (user?.email || '').toLowerCase().includes(searchLower) ||
          (surveyor.licenseNumber || '').toLowerCase().includes(searchLower) ||
          (surveyor.organization || '').toLowerCase().includes(searchLower)
        );
      });
    }

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
    const { firstname, lastname, email, phonenumber, ...surveyorUpdates } = req.body;

    // Find the surveyor and the associated employee
    const surveyor = await Surveyor.findById(id);
    if (!surveyor) {
      throw new NotFoundError('Surveyor not found');
    }

    const employee = await Employee.findById(surveyor.userId);
    if (!employee) {
      throw new NotFoundError('Associated employee not found');
    }

    // Update employee fields
    if (firstname) employee.firstname = firstname;
    if (lastname) employee.lastname = lastname;
    if (email) employee.email = email;
    if (phonenumber) employee.phonenumber = phonenumber;
    await employee.save();

    // Update surveyor fields
    if (surveyorUpdates.profile?.specialization) {
      surveyorUpdates.profile.specialization = surveyorUpdates.profile.specialization.map(spec => spec.toLowerCase());
    }

    Object.assign(surveyor, surveyorUpdates);
    await surveyor.save();

    const populatedSurveyor = await Surveyor.findById(id).populate('userId', 'firstname lastname email phonenumber');

    res.status(StatusCodes.OK).json({ success: true, data: populatedSurveyor });
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

const jwt = require('jsonwebtoken')
const { UnauthenticatedError } = require('../errors')
const { Employee } = require('../models/Employee')
const User = require('../models/User') // Import User model

const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    throw new UnauthenticatedError('Authentication invalid')
  }
  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    
    let userObject;
    let modelName;

    // Determine if the user is an Employee based on the role in the token payload
    if (payload.role && (payload.role === 'Admin' || payload.role === 'Super-admin' || payload.role === 'Staff' || payload.role === 'Surveyor')) {
      userObject = await Employee.findOne({ _id: payload.userId });
      modelName = 'Employee';
    } else {
      userObject = await User.findOne({ _id: payload.userId });
      modelName = 'User';
    }

    if (!userObject) {
      throw new UnauthenticatedError('Authentication invalid: User not found');
    }
    
    if(modelName === 'Employee'){ 
      await userObject.populate(['employeeRole', 'employeeStatus']);
      const role = userObject.employeeRole?.role || undefined;
      const status = userObject.employeeStatus?.status || undefined;
      req.user = { userId: userObject._id, fullname: userObject.firstname + ' ' + userObject.lastname, status, role, model: "Employee" } 
    }
    else{ 
      req.user = { userId: payload.userId, fullname: payload.fullname, model: "User" } 
    }    
    next()
  } catch (error) {
    throw new UnauthenticatedError('Authentication invalid')
  }
}

module.exports = auth
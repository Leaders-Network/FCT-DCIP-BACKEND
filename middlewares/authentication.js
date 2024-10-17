const jwt = require('jsonwebtoken')
const { UnauthenticatedError } = require('../errors')
const { Employee } = require('../models/Employee')
const { getModelById } = require('../controllers/auth')

const auth = async (req, res, next) => {
  
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    throw new UnauthenticatedError('Authentication invalid')
  }
  const token = authHeader.split(' ')[1]

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const { model, userObject } = await getModelById(payload.userId)
    
    if(model === Employee){ 
        req.user = { userId: payload.userId, fullname: payload.fullname, status: payload.status, role: payload.role, model: "Employee" } 
    }
    else{ req.user = { userId: payload.userId, fullname: payload.fullname, model } }
    
    next()
  } catch (error) {
    throw new UnauthenticatedError('Authentication invalid')
  }
}

module.exports = auth

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')


const StatusSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Inactive'
  }
})

const RoleSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['Super-admin', 'Admin', 'Staff', 'Surveyor'],
    default: 'Staff'
  }
})

const EmployeeSchema = new mongoose.Schema({
  firstname: {
    type: String,
    required: [true, 'Please provide first-name'],
  },
  lastname: {
    type: String,
    required: [true, 'Please provide last-name'],
  },
  phonenumber: {
    type: String,
    match: [/^(?:\+234\d{10}|234\d{10}|0\d{10})$/, 'Please provide a valid phone number'],
    required: [true, 'Please provide phone-number']
  },
  email: {
    type: String,
    required: [true, 'Please provide email'],
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please provide a valid email',
    ],
    unique: true
  },
  password: {
    type: String
  },
  employeeStatus: {
    type: mongoose.Types.ObjectId,
    ref: 'Status',
    required: [true, 'Please provide status']
  },
  employeeRole: {
    type: mongoose.Types.ObjectId,
    ref: 'Role',
    required: [true, 'Please provide role']
  },
  deleted: { 
    type: Boolean, 
    default: false 
  },
}, {timestamps: true})


EmployeeSchema.pre('save', async function () {
    const salt = await bcrypt.genSalt(10)
    if(this.isNew){
        const objectId = this._id.toString()
        this.password = await bcrypt.hash(objectId, salt)
    }
})

EmployeeSchema.methods.createToken = function () {
  return jwt.sign(
    { userId: this._id, fullname: `${this.firstname} ${this.lastname}`, status: this.employeeStatus, role: this.employeeRole },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_LIFETIME,
    }
  )
}

EmployeeSchema.methods.comparePassword = async function (canditatePassword) {
  const isMatch = await bcrypt.compare(canditatePassword, this.password)
  return isMatch
}

EmployeeSchema.methods.createJWT = async function () {
  // Populate role name
  let roleName = "";
  if (this.employeeRole && typeof this.employeeRole === "object" && this.employeeRole.role) {
    roleName = this.employeeRole.role;
  } else {
    // If not populated, fetch from DB
    const roleDoc = await mongoose.model('Role').findById(this.employeeRole);
    roleName = roleDoc ? roleDoc.role : "";
  }
  return jwt.sign(
    { userId: this._id, fullname: `${this.firstname} ${this.lastname}`, status: this.employeeStatus, role: roleName },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_LIFETIME,
    }
  );
}


const Employee =  mongoose.model('Employee', EmployeeSchema)
const Status = mongoose.model('Status', StatusSchema)
const Role = mongoose.model('Role', RoleSchema)

module.exports = { Employee, Status, Role }


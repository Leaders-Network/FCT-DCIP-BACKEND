const User = require('../models/User')
const { Employee, Role, Status } = require('../models/Employee')
const Otp = require('../models/OTP')
const sendEmail = require("../utils/sendEmail");
const bcrypt = require('bcryptjs')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, UnauthenticatedError } = require('../errors');
const { default: mongoose } = require('mongoose');


const createStatuses = async () => {
    const existingStatuses = await Status.find({})
    if(existingStatuses.length === 0){
        await Status.create([{ status: 'Active' }, { status: 'Inactive' }])
    }
}

const createRoles = async () => {
    const existingRoles = await Role.find({})
    if(existingRoles.length === 0){
        await Role.create([{ role: 'Super-admin' }, { role: 'Admin' }, { role: 'Staff' }])
    }
}

const createFirstSuperAdmin = async () => {
    let superAdminRole = await Role.findOne({ role: 'Super-admin' })
    let superAdminStatus = await Status.findOne({ status: 'Active' })
    const firstSuperAdmin = { firstname: "Babasola", lastname: "Oso", phonenumber: "08157230348", email: "easybabasola@gmail.com", employeeStatus: superAdminStatus._id, employeeRole: superAdminRole._id }
    const { email } = firstSuperAdmin
    const superAdminExists = await Employee.findOne({ email });

    if(superAdminExists === null){ 
        try{
            await Employee.create(firstSuperAdmin)
            console.log("Database Initialized Successfully !")
        }
        catch(error){
            console.error("Error Initializing Database !")
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error});
        }
    }
}

const requestOtp =  async (req, res) => {
    const { email } = req.body;

    const userExists = await User.findOne({email})
    if(userExists){ return res.status(StatusCodes.BAD_REQUEST).json({success: false, message: "This Email Is Already Registered !"}) }
    try {
        await sendEmail(email, "verifyemail");
        res.status(StatusCodes.OK).json({success: true, message: 'OTP sent successfully!' });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false,  message: `Error sending OTP: ${error}` });
    }
};

const sendResetPasswordOtp = async (req, res) => {
    try {
      let userDoc = null
      const {model} = req.user
      if(model == "Employee"){ userDoc = await Employee.findById({ _id: req.user.userId }) }
      else{ userDoc = await User.findById({ _id: req.user.userId }) }
      
      await sendEmail(userDoc.email, "resetpassword");
      res.status(StatusCodes.OK).json({
        success: true,
        message: "Password reset otp sent to your email successfully",
      });
    } 
    catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false,  message: `${error}` });
    }
};

const getModelById = async (userId) => {
    const userObject = await User.findOne({ _id: userId })
    if(userObject){ return { model: User, userObject } }

    const employee = await Employee.findOne({ _id: userId })
    if(employee){ return { model: Employee, userObject: employee } }

    return null
}

// const resetPassword = async (req, res) => {
//     const {
//         user: { userId },
//         body: { newpassword, otp }
//     } = req

//     try {
//       const userDoc = await User.findOne({_id: userId})
//       const otpData = await Otp.findOne({ email: userDoc.email, otp });

//       if (userDoc && otpData) {
//         await Otp.deleteOne({email: userDoc.email})
//         const salt = await bcrypt.genSalt(10)
//         const hashedPassword = await bcrypt.hash(newpassword, salt);
//         await User.findByIdAndUpdate({ _id: userId }, { password: hashedPassword }, { new: true, runValidators: true });
//         res.status(StatusCodes.OK).json({ success: true, message: "Password reset successfull" });
//       } 
//       else {
//         res.json({ success: false, message: "Invalid Credentials" });
//       }
//     } 
//     catch (error) {
//       res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
//     }
// };

const resetPassword = async (req, res) => {
    const {
        user: { userId },
        body: { newpassword, otp }
    } = req

    try {
      const { model, userObject } = await getModelById(userId)
      const otpData = await Otp.findOne({ email: userObject.email, otp })

      if (userObject && otpData) {
        await Otp.deleteOne({email: userObject.email})
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(newpassword, salt);
        await model.findOneAndUpdate({ _id: userId, email: userObject.email }, { password: hashedPassword }, { new: true, runValidators: true });
        res.status(StatusCodes.OK).json({ success: true, message: "Password reset successfull" });
      } 
      else {
        res.json({ success: false, message: "Invalid Credentials" });
      }
    } 
    catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
    }
};


const verifyOtp = async(req, res) => {
    const { email, otp } = req.body;

    try{
        const otpData = await Otp.findOne({ email, otp });

        if (otpData) {
            res.status(StatusCodes.OK).json({success: true, message: 'OTP verified successfully!'});
        } else {
            res.status(StatusCodes.BAD_REQUEST).json({success: false,  message: 'Invalid Credentials'});
        }
    }
    catch(error){
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error});
    }
};

const register = async (req, res) => {
    const confirmPassword = req.body['confirm password'] || req.body['confirmPassword'] || req.body['confirmpassword']
    const { email } = req.body;
    const otpData = await Otp.findOne({ email });

    if(otpData){
        try{
            await Otp.deleteOne({email})
            if(!confirmPassword || confirmPassword !== req.body.password){
                throw new BadRequestError('Please provide a matching confirm-password')
            }
            else{
                const user = await User.create({ ...req.body })
                const token = user.createJWT()
                res.status(StatusCodes.CREATED).json({ success: true, user: { name: user.fullname }, token })
            }
        }
        catch(error){
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error});
        }
    }
    else{
        throw new BadRequestError('You need to verify your email first')
    }
};

const login = async (req, res) => {
    const { email, password } = req.body
  
    try{
        if (!email || !password) {
            throw new BadRequestError('Please provide email and password')
        }
        const user = await User.findOne({ email })
        if (!user) {
            throw new UnauthenticatedError('Invalid Credentials')
        }
        const isPasswordCorrect = await user.comparePassword(password)
        if (!isPasswordCorrect) {
            throw new UnauthenticatedError('Invalid Credentials')
        }
        console.log("Password Correct")
        const token = user.createJWT()
        res.status(StatusCodes.OK).json({ success: true, user: { name: user.fullname }, token })
    }
    catch(error){
        res.status(error.error.statusCode).json({error});
    }
};

const loginEmployee = async (req, res) => {
    const { email, password } = req.body
  
    try{
        if (!email || !password || email === "" || password === "") {
            throw new BadRequestError('Please provide email and password')
        }
        const employee = await Employee.findOne({ email })
        if (!employee) {
            throw new UnauthenticatedError('Invalid Credentials')
        }
        const isPasswordCorrect = await employee.comparePassword(password)
        if (!isPasswordCorrect) {
            throw new UnauthenticatedError('Invalid Credentials')
        }
        const token = employee.createJWT()
        res.status(StatusCodes.OK).json({ success: true, employee: { name: `${employee.firstname} ${employee.lastname}` }, token })
    }
    catch(error){
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error});
    }
};


const registerEmployee = async (req, res) => {
    const { userId } = req.user
    const { firstname, lastname, phonenumber, email, statusId, roleId } = req.body

    try{
        const creator = await Employee.findById({ _id: userId }).populate(['employeeRole', 'employeeStatus'])
        if(!creator){ return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Employee not found" }) }

        const creatorRole = creator.employeeRole.role
        const creatorStatus = creator.employeeStatus.status
        if(creatorStatus === 'Active'){
            if(creatorRole === 'Super-admin'){
        
            }
            else if(creatorRole === 'Admin'){
                const { role: roleToBeCreated } =  await Role.findById({_id: roleId})
                if(roleToBeCreated === 'Super-admin'){ return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Admins cannot create Super-admins" }) } 
            }
            else if(creatorRole === 'Staff'){
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Staff cannot create an employee" })
            }

            const employeeExists = await Employee.findOne({ email });
            const employeeData = { firstname, lastname, phonenumber, email, employeeStatus: statusId, employeeRole: roleId }
        
            if(employeeExists === null){ 
                try{
                        const employeeObject = await Employee.create(employeeData)
                        const token = employeeObject.createToken()
                        const {status} = await Status.findById({_id: statusId})
                        const {role} =  await Role.findById({_id: roleId})
                        return res.status(StatusCodes.CREATED).json({ success: true, employee: { name: `${employeeObject.firstname} ${employeeObject.lastname}`, status, role }, token })
                }
                catch(error){
                    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error});
                }
            }
            else{
                throw new BadRequestError('This Employee Already Exists') 
            }
        }
        else{
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Employee has not been activated" })
        }
    }
    catch(error){
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error})
    }
};






module.exports = {
    requestOtp,
    verifyOtp,
    register,
    login,
    sendResetPasswordOtp,
    resetPassword,
    loginEmployee,
    registerEmployee,
    createStatuses,
    createRoles,
    getModelById,
    createFirstSuperAdmin,
}
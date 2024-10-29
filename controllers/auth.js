const User = require('../models/User')
const { Employee, Role, Status } = require('../models/Employee')
const Otp = require('../models/OTP')
const { Property, PropertyCategory } = require('../models/Property')
const sendEmail = require("../utils/sendEmail");
const bcrypt = require('bcryptjs')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, UnauthenticatedError, NotFoundError } = require('../errors');


let emailTokenStoreEmployee = {}
let emailTokenStoreUser = {}
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

const createPropertyCategories = async () => {
    const existingCategories = await PropertyCategory.find({})
    if(existingCategories.length === 0){
        await PropertyCategory.create([{ category: "Single Occupier Office Building" }, { category: "Single Occupier Residential Building" }, { category: "Hotel/Hostel/Guest House" }, { category: "Recreation Centre/Club House/Cinema Hall" }, { category: "School/Training Institute" }, { category: "Petrol/Gas Station" }, { category: "Hospital/Clinic/Health Centre" }, { category: "Multi Occupier/Multi Purpose Business Building" }, { category: "Multi Occupier/Mixed Use Residential Building" }, { category: "Others" }])
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
    const generatedOtp = Math.floor(10000 + Math.random() * 90000).toString();
    emailTokenStoreUser[generatedOtp] = email
    try {
        await sendEmail(email, "verifyemail", generatedOtp);
        res.status(StatusCodes.OK).json({success: true, message: 'OTP sent successfully!' });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false,  message: `Error sending OTP: ${error}` });
    }
};

const verifyOtp = async(req, res) => {
    const { otp } = req.body;
    const email = emailTokenStoreUser[otp]

    try{
        const otpData = await Otp.findOne({ email, otp });

        if (otpData) {
            // await Otp.deleteOne({ email })
            res.status(StatusCodes.OK).json({success: true, message: 'OTP verified successfully!'});
        } else {
            res.status(StatusCodes.BAD_REQUEST).json({success: false,  message: 'Invalid Credentials'});
        }
    }
    catch(error){
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error});
    }
};

const sendResetPasswordOtpUser = async (req, res, next) => {
    const { email } = req.body

    try {
      const userDoc = await User.findOne({ email })
      if(!userDoc){ throw new NotFoundError("No User With That Email !") }
      const generatedOtp = Math.floor(10000 + Math.random() * 90000).toString();
      emailTokenStoreUser[generatedOtp] = email

      await sendEmail(userDoc.email, "resetpassword", generatedOtp);
      res.status(StatusCodes.OK).json({
        success: true,
        message: "Password reset otp sent to your email successfully",
      });
    } 
    catch (error) {
        next(error)
    }
};

const verifyPasswordResetOtpUser = async (req, res) => {
    const {
        body: { otp }
    } = req
    const email = emailTokenStoreUser[otp]

    try {
      const userObject = await User.findOne({ email })
      const otpData = await Otp.findOne({ email: userObject.email, otp })

      if (userObject && otpData) {
        await Otp.deleteOne({email: userObject.email})
        const token = userObject.createJWT()
        return res.status(StatusCodes.OK).json({ success: true, message: "OTP Verified Successfully !", token });
      } 
      else {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Invalid Credentials" });
      }
    } 
    catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
    }
};

const resetPasswordUser = async (req, res) => {
    const {
        body: { newpassword },
        user: { userId }
    } = req
    const theKeys = Object.keys(emailTokenStoreUser)

    if(theKeys.length > 0){
        const email = emailTokenStoreUser[theKeys[0]]

        try {
          const userObject = await User.findOne({ email, _id: userId })
          if (userObject) {
            const salt = await bcrypt.genSalt(10)
            const hashedPassword = await bcrypt.hash(newpassword, salt);
            await User.findOneAndUpdate({ _id: userId }, { password: hashedPassword }, { new: true, runValidators: true });

            delete emailTokenStoreUser[theKeys[0]]
            return res.status(StatusCodes.OK).json({ success: true, message: "Password reset successfull" });
          } 
          else {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Unable To Find User With Specified Email !" })
          }
        } 
        catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error)
        }
    }
    else{
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json("Something Went Wrong, Please Try Again !");
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
                const userObject = user.toObject()
                delete userObject.password
                delete userObject.__v
                res.status(StatusCodes.CREATED).json({ success: true, user: userObject, token })
            }
        }
        catch(error){
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error});
        }
    }
    else{
        throw new BadRequestError('You Need A Verified OTP Firstly !')
    }
};

const login = async (req, res, next) => {
    const { email, password } = req.body
  
    try{
        if (!email || !password) {
            throw new BadRequestError('Please Provide Email And Password !')
        }
        let user = await User.findOne({ email })
        if (!user) {
            throw new UnauthenticatedError('Invalid Credentials !')
        }
        const isPasswordCorrect = await user.comparePassword(password)
        if (!isPasswordCorrect) {
            throw new UnauthenticatedError('Invalid Credentials !')
        }

        const token = user.createJWT()
        const userDisplay = user.toObject()
        delete userDisplay.password
        delete userDisplay.__v
        res.status(StatusCodes.OK).json({ success: true,  user: userDisplay, token })
    }
    catch(error){
        next(error)
    }
};

const addProperty = async (req, res, next) => {
    try {
        req.body.ownedBy = req.user.userId
        const images = req.body.images

        const imagesArray = Array.isArray(images) ? images : [images]
        const base64Regex = /^data:image\/(png|jpeg|jpg|gif);base64,[A-Za-z0-9+/=]+$/

        const formattedImages = imagesArray.filter(image => base64Regex.test(image))
        if(formattedImages.length === 0){
            throw new BadRequestError('No valid base64 images found.')
        }
        req.body.images = formattedImages

        const property = await Property.create(req.body)
        const populatedProperty = await Property.findById(property._id).populate('ownedBy')

        return res.status(StatusCodes.OK).json({ success: true, message: 'Property added successfully!', populatedProperty })
    } 
    catch (error) {
        next(error)
    }
}

const deleteUser = async (req, res, next) => {
    const userId = req.user.userId
    try {
        const user = await UserSchema.findById(userId)
        if (!user || user.deleted) {
            throw new NotFoundError('User Not Found Or Already Deleted !')
        }

        user.deleted = true
        await user.save();

        await Property.updateMany({ ownedBy: userId }, { deleted: true });
        return res.status(StatusCodes.OK).json({ success: true, message: 'User Deleted Successfully !' })
    } catch (error) {
        next(error);
    }
};

const removeProperty = async (req, res, next) => {
    const {
        user: { userId },
        params: { id: propertyId },
    } = req

    try {
        const property = await Property.findById({
        _id: propertyId,
        ownedBy: userId,
      })
      if (!property || property.deleted) {
        throw new NotFoundError(`Property Not Found Or Already Deleted !`)
      }
      property.deleted = true
      await property.save()

      return res.status(StatusCodes.OK).json({ success: true, message: 'Property Deleted Successfully !' })
    }
    catch(error){
        next(error)
    }
}

const updateUser = async (req, res) => {

}

const getAllUsers = async (req, res) => {

}

const getUserById = async (req, res) => {

}

const getAllProperties = async (req, res, message = null) => {
    const properties = await Property.find({ ownedBy: req.user.userId }).populate('ownedBy')
    if(!properties){ return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "User Has No Properties !" }) }
    if(message){ return res.status(StatusCodes.OK).json({ success: true, message, allProperties: { count: properties.length, properties } }) }
    return res.status(StatusCodes.OK).json({ success: true, allProperties: { count: properties.length, properties } })
}

const getPropertyById = async () => {

}

const updateProperty = async (req, res, next) => {
      const {
        body: { category, address, phonenumber },
        user: { userId },
        params: { id: propertyId },
      } = req

      const updateData = { category, address, phonenumber }

  try {      
        const property = await Property.findById(propertyId);
        if (!property) {
            throw new NotFoundError('Property Not Found !');
        }

        if(req.body.removeImages){
                const toRemove = req.body.removeImages
                const imagesToRemove = Array.isArray(toRemove) ? toRemove : [toRemove]

            property.images = property.images.filter(image => !imagesToRemove.includes(image))
        }
        
        if(req.body.images){
            const toAdd = req.body.images
            const imagesToAdd = Array.isArray(toAdd) ? toAdd : [toAdd]

            updateData.images = property.images || []
            updateData.images.push(...imagesToAdd)
        }
        else{ updateData.images = property.images }


        const updatedProperty = await Property.findByIdAndUpdate(
            { _id: propertyId, ownedBy: userId },
            updateData,
            { new: true, runValidators: true }
        )
        if (!updatedProperty) {
            throw new NotFoundError(`Could Not Update Property !`)
        }

        const message = "Property Updated Successfully !"
        await getAllProperties(req, res, message)
    }
    catch(error){
        next(error)
    }
}



const sendResetPasswordOtpEmployee = async (req, res) => {
    const { email } = req.body
    try {
      const userDoc = await Employee.findOne({ email })
      const generatedOtp = Math.floor(10000 + Math.random() * 90000).toString();
      emailTokenStoreEmployee[generatedOtp] = email

      await sendEmail(userDoc.email, "resetpassword", generatedOtp);
      res.status(StatusCodes.OK).json({
        success: true,
        message: "Password reset otp sent to your email successfully",
      });
    } 
    catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false,  message: `${error}` });
    }
};

const verifyOtpEmployee = async (req, res) => {
    const {
        body: { otp }
    } = req
    const email = emailTokenStoreEmployee[otp]

    try {
      const userObject = await Employee.findOne({ email })
      const otpData = await Otp.findOne({ email: userObject.email, otp })

      if (userObject && otpData) {
        await Otp.deleteOne({email: userObject.email})
        return res.status(StatusCodes.OK).json({ success: true, message: "OTP Verified Successfully !" });
      } 
      else {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Invalid Credentials" });
      }
    } 
    catch (error) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
    }
};

const resetPasswordEmployee = async (req, res) => {
    const {
        body: { newpassword }
    } = req
    const theKeys = Object.keys(emailTokenStoreEmployee)
    if(theKeys.length > 0){
        const email = emailTokenStoreEmployee[theKeys[0]]

        try {
          const userObject = await Employee.findOne({ email })
    
          if (userObject) {
            const salt = await bcrypt.genSalt(10)
            const hashedPassword = await bcrypt.hash(newpassword, salt);
            const status = 'Active'
            const activeStatus = await Status.findOne({status})
            await Employee.findOneAndUpdate({ email: userObject.email }, { password: hashedPassword, employeeStatus: activeStatus._id }, { new: true, runValidators: true });
            delete emailTokenStoreEmployee[theKeys[0]]
            return res.status(StatusCodes.OK).json({ success: true, message: "Password reset successfull" });
          } 
          else {
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Unable To Find User With Specified Email !" });
          }
        } 
        catch (error) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error)
        }
    }
    else{
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json("Something Went Wrong, Please Try Again !");
    }
};


const getModelById = async (userId) => {
    const userObject = await User.findOne({ _id: userId })
    if(userObject){ return { model: User, userObject } }

    const employee = await Employee.findOne({ _id: userId })
    if(employee){ return { model: Employee, userObject: employee } }

    return null
}


const loginEmployee = async (req, res, next) => {
    const { email, password } = req.body
  
    try{
        if (!email || !password || email === "" || password === "") {
            throw new BadRequestError('Please provide email and password')
        }
        const employee = await Employee.findOne({ email }).populate(['employeeRole', 'employeeStatus'])
        if (!employee) {
            throw new UnauthenticatedError('Invalid Credentials')
        }
        const isPasswordCorrect = await employee.comparePassword(password)
        if (!isPasswordCorrect) {
            throw new UnauthenticatedError('Invalid Credentials')
        }
        const token = employee.createJWT()
        const employeeDisplay = employee.toObject()
        delete employeeDisplay.password
        delete employeeDisplay.__v
        res.status(StatusCodes.OK).json({ success: true, employee: employeeDisplay, token })
    }
    catch(error){
        next(error)
    }
};

const omitFields = (obj, fieldsToOmit) => {
    const newObj = { ...obj }
    fieldsToOmit.forEach(field => delete newObj[field])
    return newObj
};


const registerEmployee = async (req, res) => {
    const { userId } = req.user
    const { firstname, lastname, phonenumber, email, statusId, roleId } = req.body

    try{
        const creator = await Employee.findById({ _id: userId }).populate(['employeeRole', 'employeeStatus'])
        if(!creator){ return res.status(StatusCodes.NOT_FOUND).json({ message: "Employee Not Found !" }) }

        const creatorRole = creator.employeeRole.role
        const creatorStatus = creator.employeeStatus.status
        if(creatorStatus === 'Active'){
            if(creatorRole === 'Super-admin'){
        
            }
            else if(creatorRole === 'Admin'){
                const { role: roleToBeCreated } =  await Role.findById({_id: roleId})
                if(roleToBeCreated === 'Super-admin'){ return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Admins Cannot Create Super-admins !" }) } 
            }
            else if(creatorRole === 'Staff'){
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: "Staff Cannot Create An Employee !" })
            }

            const employeeExists = await Employee.findOne({ email });
            const employeeData = { firstname, lastname, phonenumber, email, employeeStatus: statusId, employeeRole: roleId }
        
            if(employeeExists === null){ 
                try{
                        const employeeObject = await Employee.create(employeeData)
                        const token = employeeObject.createToken()
                        const {status} = await Status.findById({_id: statusId})
                        const {role} =  await Role.findById({_id: roleId})

                        const fieldsToOmit = ['password', '__v', 'employeeStatus', 'createdAt', 'updatedAt', 'employeeRole']

                        const employeeDisplay = omitFields(employeeObject.toObject(), fieldsToOmit)
                        return res.status(StatusCodes.CREATED).json({ success: true, employee: { employeeDisplay, status, role }, token })
                }
                catch(error){
                    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error});
                }
            }
            else{
                throw new BadRequestError('This Employee Already Exists !') 
            }
        }
        else{
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Employee Has Not Been Activated !" })
        }
    }
    catch(error){
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({error})
    }
};

const deleteEmployee = async (req, res) => {

}

const returnAvailableRoles = async (req, res) => {
    const { userId } = req.user

    try{
        const loggedInEmployee = await Employee.findById({ _id: userId }).populate(['employeeRole', 'employeeStatus'])
        if(!loggedInEmployee){ return res.status(StatusCodes.NOT_FOUND).json({ message: "Employee Not Found !" }) }

        const employeeRole = loggedInEmployee.employeeRole.role
        const employeeStatus = loggedInEmployee.employeeStatus.status

        const allRoles = await Role.find()
        const mappedRoles = allRoles.map(role => ({
            _id: role._id,
            role: role.role,
        }))
        const superAdmin = mappedRoles.find(mapped => mapped.role === "Super-admin")
        const admin = mappedRoles.find(mapped => mapped.role === "Admin")
        const staff = mappedRoles.find(mapped => mapped.role === "Staff")

        if(employeeStatus === 'Active'){
            if(employeeRole === 'Super-admin'){
                return res.status(StatusCodes.OK).json({ success: true, availableRoles: [superAdmin, admin, staff] })
            }
            else if(employeeRole === 'Admin'){
                return res.status(StatusCodes.OK).json({ success: true, availableRoles: [admin, staff] })
            }
            else{ return res.status(StatusCodes.OK).json({ success: true, message: "As A Staff You Don't Have Enough Permission" }) }
        }
    }
    catch(error){
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error })
    }
}

const returnAvailableCategories = async (req, res) => {
    try{
        const allCategories = await PropertyCategory.find()
        const mappedCategories = allCategories.map(category => ({
            _id: category._id,
            category: category.category,
        }))
        return res.status(StatusCodes.OK).json({ success: true, mappedCategories })
    }
    catch(error){
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error })
    }
}

const updateEmployee = async (req, res) => {

}

const getAllEmployees = async (req, res) => {
    const { userId } = req.user

    try{
        const loggedInEmployee = await Employee.findById({ _id: userId }).populate(['employeeRole', 'employeeStatus'])
        if(!loggedInEmployee){ return res.status(StatusCodes.NOT_FOUND).json({ message: "Employee Not Found !" }) }

        const employeeRole = loggedInEmployee.employeeRole.role
        const employeeStatus = loggedInEmployee.employeeStatus.status
        if(employeeStatus === 'Active'){
            if(employeeRole === 'Super-admin' || employeeRole === 'Admin'){
                const allEmployees = await Employee.find({ }).populate(['employeeRole', 'employeeStatus'])
                if(!allEmployees){ return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Could Not Find Any Employee !" }) }

                const fieldsToOmit = ['password', '__v'];
                const sanitizedEmployees = allEmployees.map(employee => omitFields(employee.toObject(), fieldsToOmit));
                return res.status(StatusCodes.OK).json({ success: true, allStaff: { count: allEmployees.length, sanitizedEmployees } })
            }
        }
    }
    catch(error){
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error })
    }
}

const getEmployeeById = async (req, res) => {

}











module.exports = {
    requestOtp,
    verifyOtp,
    register,
    login,
    sendResetPasswordOtpUser,
    sendResetPasswordOtpEmployee,
    verifyOtpEmployee,
    verifyPasswordResetOtpUser,
    resetPasswordUser,
    resetPasswordEmployee,
    loginEmployee,
    registerEmployee,
    createStatuses,
    createRoles,
    createPropertyCategories,
    getModelById,
    createFirstSuperAdmin,
    addProperty,
    deleteUser,
    removeProperty,
    getAllProperties,
    updateProperty,
    getAllEmployees,
    returnAvailableRoles,
    returnAvailableCategories,
}
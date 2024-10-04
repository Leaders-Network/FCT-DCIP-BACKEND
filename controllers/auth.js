const User = require('../models/User')
const Otp = require('../models/OTP')
const sendEmail = require("../utils/sendEmail");
const bcrypt = require('bcryptjs')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, UnauthenticatedError } = require('../errors')


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
      const userDoc = await User.findById({ _id: req.user.userId });
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

const resetPassword = async (req, res) => {
    const {
        user: { userId },
        body: { newpassword, otp }
    } = req

    try {
      const userDoc = await User.findOne({_id: userId})
      const otpData = await Otp.findOne({ email: userDoc.email, otp });

      if (userDoc && otpData) {
        await Otp.deleteOne({email: userDoc.email})
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(newpassword, salt);
        await User.findByIdAndUpdate({ _id: userId }, { password: hashedPassword }, { new: true, runValidators: true });
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
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error);
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
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error);
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
          
          const token = user.createJWT()
          res.status(StatusCodes.OK).json({ success: true, user: { name: user.fullname }, token })
    }
    catch(error){
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send(error);
    }
};






module.exports = {
    requestOtp,
    verifyOtp,
    register,
    login,
    sendResetPasswordOtp,
    resetPassword
}
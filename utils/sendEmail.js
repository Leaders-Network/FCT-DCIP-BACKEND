require('dotenv').config();
const nodemailer = require("nodemailer");
const Otp = require("../models/OTP");

module.exports = async (email, mailType) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: true,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const generatedOtp = Math.floor(10000 + Math.random() * 90000).toString();

    let emailContent, mailOptions;

    if (mailType == "verifyemail") {
      emailContent = `<div><h1>Please verify your email with this OTP:</h1> <h4><b>${generatedOtp}</b></h4></div>`;
      mailOptions = {
        from: `${process.env.EMAIL_FROM}  <${process.env.EMAIL}>`,
        to: email,
        subject: "Verify Your Email",
        html: emailContent,
      };
    } 
    else {
      emailContent = `<div><h1>Please reset your password with this OTP:</h1> <h4><b>${generatedOtp}</b></h4></div>`;
      mailOptions = {
        from: `${process.env.EMAIL_FROM}  <${process.env.EMAIL}>`,
        to: email,
        subject: "Reset Your Password",
        html: emailContent,
      };
    }

    await transporter.sendMail(mailOptions);
    await Otp.findOneAndUpdate({email}, {otp: generatedOtp, createdAt: Date.now()}, {upsert: true});
  } 
  catch (error) {
    console.log(error);
  }
};


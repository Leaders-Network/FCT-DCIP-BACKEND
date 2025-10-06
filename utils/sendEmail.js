require('dotenv').config();
const nodemailer = require("nodemailer");
const Otp = require("../models/OTP");


module.exports = async (email, mailType, content) => {
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

    let mailOptions;
    if (mailType === "verifyemail") {
      mailOptions = {
        from: `${process.env.EMAIL_FROM}  <${process.env.EMAIL}>`,
        to: email,
        subject: "Verify Your Email",
        html: content,
      };
    } else if (mailType === "surveyorCredentials") {
      mailOptions = {
        from: `${process.env.EMAIL_FROM}  <${process.env.EMAIL}>`,
        to: email,
        subject: "Your DCIP Surveyor Account Credentials",
        html: content,
      };
    } else {
      mailOptions = {
        from: `${process.env.EMAIL_FROM}  <${process.env.EMAIL}>`,
        to: email,
        subject: "Reset Your Password",
        html: content,
      };
    }

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.log(error);
  }
};


require('dotenv').config();
const nodemailer = require("nodemailer");
const Otp = require("../models/OTP");


module.exports = async (email, mailType, content) => {
  nodemailer.createTestAccount(async (err, account) => {
    if (err) {
      console.error('Failed to create a testing account. ' + err.message);
      return process.exit(1);
    }

    console.log('Credentials obtained, sending message...');

    const transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: {
        user: account.user,
        pass: account.pass
      }
    });

    let mailOptions;
    if (mailType === "verifyemail") {
      mailOptions = {
        from: `"${process.env.EMAIL_FROM}" <${process.env.EMAIL}>`,
        to: email,
        subject: "Verify Your Email",
        html: content,
      };
    } else if (mailType === "surveyorCredentials") {
      mailOptions = {
        from: `"${process.env.EMAIL_FROM}" <${process.env.EMAIL}>`,
        to: email,
        subject: "Your DCIP Surveyor Account Credentials",
        html: content,
      };
    } else {
      mailOptions = {
        from: `"${process.env.EMAIL_FROM}" <${process.env.EMAIL}>`,
        to: email,
        subject: "Reset Your Password",
        html: content,
      };
    }

    let info = await transporter.sendMail(mailOptions);

    console.log('\n✅ ===== EMAIL SENT SUCCESSFULLY =====');
    console.log('📧 Message ID:', info.messageId);
    console.log('📧 Recipient:', email);
    console.log('📧 Type:', mailType);
    console.log('\n🔗 ===== ETHEREAL PREVIEW LINK =====');
    console.log('🌐 View email in browser:');
    console.log('🔗', nodemailer.getTestMessageUrl(info));
    console.log('=====================================\n');
  });
};


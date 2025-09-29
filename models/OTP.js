const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
        type: String,
        required: [true, 'Please provide email'],
        match: [
          /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
          'Please provide a valid email',
        ],
        unique: true
    },
    otp: {
      type: String,
      // required: true,
    },
    createdAt: {
        type: Date,
        expires: '15m',
        default: Date.now()
    }
  }
);


const Otp = mongoose.model("otp", otpSchema);

module.exports = Otp;
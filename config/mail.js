const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: "primo.aishwaryabairagi@gmail.com",
    pass: "wbdvxextsssyyytb"
  },
  connectionTimeout: 10000, // 10 sec
  greetingTimeout: 10000
});

module.exports = transporter;
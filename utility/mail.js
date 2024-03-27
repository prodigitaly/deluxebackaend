const nodemailer = require("nodemailer");
exports.main = async (email, message, subject, text) => {
    try {
        console.log("execute0")
        // Generate test SMTP service account from ethereal.email
        // Only needed if you don't have a real mail account for testing
        let testAccount = await nodemailer.createTestAccount();

        // create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER, // generated ethereal user
                pass: process.env.PASSWORD, // generated ethereal password
            },
        });

        // send mail with defined transport object
        let info = await transporter.sendMail({
            from: 'itsme@gmail.com', // sender address
            to: email, // list of receivers
            subject: subject != undefined ? subject : "Sparkle Up Otp", // Subject line
            text: text != undefined ? text : "Here is Your Otp For Sparkle Up service", // plain text body
            html: message, // html body
        });

        console.log("Message sent: %s", info.messageId);
        // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

        // Preview only available when sending through an Ethereal account
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
        // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
    }
    catch (error) {
        console.log(error)
    }
}
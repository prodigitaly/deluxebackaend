const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const adminSchema = mongoose.Schema({
    name: {
        type: String
    },
    mobileNo: {
        type: String
    },
    email: {
        type: String
    },
    gender: {
        type: String,
        default: "Male",
        enum: ["Male", "Female", "Other"]
    },
    role: {
        type: String,
        enum: ["superAdmin", "admin", "employee"],
        default: "employee"
    },
    password: {
        type: String
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isMobileVerified: {
        type: Boolean,
        default: false
    },
    otp: String,
    generatedTime: [String],
    countryCode: String,
    birthDate: String,
    fatherName: {
        type: String,
        default: ""
    },
    bloodGroup: {
        type: String,
        default: ""
    },
    alternativeMobile: {
        type: String,
        default: ""
    },
    //0==active
    //1==inactive
    //2==banned
    status: {
        type: Number,
        default: 0
    },
    reason: {
        type: String,
        default: ""
    },
    note: {
        type: String,
        default: ""
    }
}, { timestamps: true });

adminSchema.pre('save', async function (next) {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedpassword = await bcrypt.hash(this.password, salt);
        this.password = hashedpassword;
        next();
        //console.log("before called");
    }
    catch (error) {
        next(error)
    }
});
module.exports = mongoose.model("admin", adminSchema);
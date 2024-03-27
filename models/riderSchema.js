const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const riderSchema = mongoose.Schema({
    name: {
        type: String,
        default: ""
    },
    username: {
        type: String,
        default: ""
    },
    dob: {
        type: String,
        default: ""
    },
    image: {
        type: String,
        default: ""
    },
    email: {
        type: String,
        default: ""
    },
    mobileNo: {
        type: String,
        default: ""
    },
    gender: {
        type: String,
        enum: ["Male", "Female", "Other"]
    },
    otp: String,
    generatedTime: [String],
    countryCode: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        enum: ["rider"],
        default: "rider"
    },
    jobStatus: {
        type: Boolean,
        default: false
    },
    bloodGroup: {
        type: String,
        default: ""
    },
    alternativeMobile: {
        type: String,
        default: ""
    },
    //0==on
    //1==leave
    //2==removed
    //3==bann
    activeStatus: {
        type: Number,
        default: 2
    },
    fatherName: {
        type: String,
        default: ""
    },
    insurance: {
        type: Boolean,
        default: false
    },
    riderInsurance: {
        type: String,
        default: ""
    },
    riderExpiry: {
        type: String,
        default: ""
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

module.exports = mongoose.model("rider", riderSchema);
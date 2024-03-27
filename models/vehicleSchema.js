const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const vehicleSchema = mongoose.Schema({
    registrationNo: {
        type: String,
        default: ""
    },
    registrationDate: {
        type: String,
        default: ""
    },
    chassisNo: {
        type: String,
        default: ""
    },
    engineNo: {
        type: String,
        default: ""
    },
    ownerName: {
        type: String,
        default: ""
    },
    vehicleClass: {
        type: String,
        default: ""
    },
    fuel: {
        type: String,
        default: ""
    },
    model: {
        type: String,
        default: ""
    },
    manufacturer: {
        type: String,
        default: ""
    },
    vehicleInsurance: {
        type: Boolean,
        default: false
    },
    insuranceNumber: {
        type: String,
        default: ""
    },
    insuranceExpiry: {
        type: String,
        default: ""
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "riders"
    }
}, { timestamps: true });

module.exports = mongoose.model("vehicle", vehicleSchema);
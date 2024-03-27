const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const riderOrderOtp = mongoose.Schema({
    otp: {
        type: String,
        default: ""
    },
    rideId: {
        type: mongoose.Types.ObjectId,
        ref: "pickupdeliveries"
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    generatedTime: {
        type: Number,
        default: 0
    },
    orderId: {
        type: mongoose.Types.ObjectId,
        ref: "invoices"
    }
}, { timestamps: true });

module.exports = mongoose.model("rideOtps", riderOrderOtp);
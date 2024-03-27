const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const riderNotification = mongoose.Schema({
    riderId: {
        type: mongoose.Types.ObjectId,
        ref: "riders"
    },
    title: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    rideId: {
        type: mongoose.Types.ObjectId,
        ref: "riders"
    },
    isSeen: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model("ridernotification", riderNotification);
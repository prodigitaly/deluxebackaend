const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const fcmToken = mongoose.Schema({
    fcm: {
        type: String,
        default: ""
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    status: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("fcmtoken", fcmToken);
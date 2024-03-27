const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const userRefer = mongoose.Schema({
    referral: {
        type: String,
        default: ""
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "riders"
    }
}, { timestamps: true });

module.exports = mongoose.model("userrefer", userRefer);
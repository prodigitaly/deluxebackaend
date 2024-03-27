const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const referred = mongoose.Schema({
    referredBy: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    referredTo: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    }
}, { timestamps: true });

module.exports = mongoose.model("referred", referred);
const mongoose = require('mongoose');
const deleteUser = mongoose.Schema({
    email: {
        type: String,
        default: ""
    },
    mobileNo: {
        type: String,
        default: ""
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    }
}, { timestamps: true });

module.exports = mongoose.model("deleteuser", deleteUser);
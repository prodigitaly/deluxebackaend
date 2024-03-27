const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const bodySchema = mongoose.Schema({
    token: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model("body", bodySchema);
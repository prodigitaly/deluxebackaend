const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const apkLinkSchema = mongoose.Schema({
    apkLink: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model("apkLink", apkLinkSchema);
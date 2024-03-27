const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const taxSchema = mongoose.Schema({
    isSubscription: {
        type: Boolean,
        default: false
    },
    isMember: {
        type: Boolean,
        default: false
    },
    taxes: {}
}, { timestamps: true });

module.exports = mongoose.model("tax", taxSchema);
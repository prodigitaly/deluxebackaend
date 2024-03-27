const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const timeSchema = mongoose.Schema({
    start: {
        type: String,
        default: ""
    },
    end: {
        type: String,
        default: ""
    },
    isActive: {
        type: Boolean,
        default: false
    },
    priority: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("time", timeSchema);
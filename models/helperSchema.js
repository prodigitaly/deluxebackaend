const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const helperSchema = mongoose.Schema({
    title: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    icon: {
        type: String,
        default: ""
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    categoryId: {
        type: mongoose.Types.ObjectId,
        ref: "categories"
    }
}, { timestamps: true });

module.exports = mongoose.model("helper", helperSchema);
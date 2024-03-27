const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const categorySchema = mongoose.Schema({
    name: {
        type: String,
        default: ""
    },
    icon: {
        type: String,
        default: ""
    },
    //description to discount
    description: {
        type: String,
        default: ""
    },
    isSubscription: {
        type: Boolean,
        default: false
    },
    isVisible: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model("category", categorySchema);
const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const subscriptionStripe = mongoose.Schema({
    planId: {
        type: String,
        default: ""
    },
    type: {
        type: String,
        default: "month",
        enum: ["month", "quarter", "year"]
    },
    subscriptionId: {
        type: mongoose.Types.ObjectId,
        ref: "subscriptions"
    },
    price: {
        type: Number,
        default: 0
    },
    isChanged: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model("subscriptionstripe", subscriptionStripe);
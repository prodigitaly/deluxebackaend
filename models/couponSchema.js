const mongoose = require('mongoose');
const couponSchema = mongoose.Schema({
    name: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    discount: {
        type: Number,
        default: 0
    },
    start: {
        type: Date
    },
    end: {
        type: Date
    },
    isOnce: {
        type: Boolean,
        default: true
    },
    percentage: {
        type: Boolean,
        default: true
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    isExpired: {
        type: Boolean,
        default: false
    },
    isExist: {
        type: Boolean,
        default: false
    },
    isNewOnly: {
        type: Boolean,
        default: false
    },
    isSpecial: {
        type: Boolean,
        default: false
    },
    minimumAmount: {
        type: Number,
        default: 0
    },
    terms: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model("coupon", couponSchema);
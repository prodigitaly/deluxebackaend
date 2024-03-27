const mongoose = require('mongoose');
const couponUsers = mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    couponId: {
        type: mongoose.Types.ObjectId,
        ref: "coupons"
    },
    status: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("userCoupon", couponUsers);
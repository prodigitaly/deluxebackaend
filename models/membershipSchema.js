const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const membershipSchema = mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    orderId: {
        type: String,
        default: ""
    },
    duration: {
        type: Number,
        default: 0
    },
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    price: {
        type: Number,
        default: 0
    },
    usedDays: {
        type: Number,
        default: 0
    },
    pendingDays: {
        type: Number,
        default: 0
    },
    paymentId: {
        type: String,
        default: ""
    },
    note: {
        type: String,
        default: ""
    },
    membershipId: {
        type: mongoose.Types.ObjectId,
        ref: "membershipdetails"
    },
    //0==pending
    //1==paid
    //2==expired
    //3==payment failed
    //4==renew expired
    //5==used
    status: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("membership", membershipSchema);
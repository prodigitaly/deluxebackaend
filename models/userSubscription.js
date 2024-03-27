const mongoose = require('mongoose');
const client = require('../utility/setup/redis');
// const bcrypt = require('bcrypt');
const userSubscription = mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    orderId: {
        type: String,
        default: ""
    },
    planId: {
        type: mongoose.Types.ObjectId,
        ref: "subscription"
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
    duration: {
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
    note: {
        type: String,
        default: ""
    },
    pickup: {
        type: Number,
        default: 0
    },
    delivery: {
        type: Number,
        default: 0
    },
    paymentId: {
        type: String,
        default: ""
    },
    //0==pending
    //1==paid/active
    //2==expired
    //3==payment failed
    //4==renew expired
    //5==used
    //6==purchased
    status: {
        type: Number,
        default: 0
    }
}, { timestamps: true });
// Post hook for save and findOneAndUpdate operations
userSubscription.post(['save', 'findOneAndUpdate'], async function (doc, next) {
    try {
        const subscription = doc;
        if ('userId' in subscription) {
            await client.del(subscription.userId.toString())
        }
    } catch (error) {
        next(error);
    }
});
module.exports = mongoose.model("usersubsciption", userSubscription);
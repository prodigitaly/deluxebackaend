const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const userSubscriptionStripe = mongoose.Schema({
    planId: {
        type: String,
        default: ""
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: 'users'
    },
    planSubscriptionId: {
        type: mongoose.Types.ObjectId,
        required: true,
        default: ""
    },
    subscriptionId: {
        type: mongoose.Types.ObjectId,
        required: true,
        default: ""
    },
    subscription: {
        type: String,
        required: true,
        default: ""
    },
    isCancelled: {
        type: Boolean,
        default: false
    },
    paymentMethodId: {
        type: String,
        default: ""
    },
    nextRenew: {
        type: Date,
        default: Date.now()
    },
    pendingBag: {
        type: Number,
        default: 0
    },
    pendingBagDel: {
        type: Number,
        default: 0
    },
    isSubscription: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model("usersubscriptionstripe", userSubscriptionStripe);
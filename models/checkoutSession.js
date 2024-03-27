const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const checkoutSession = mongoose.Schema({
    orderId: {
        type: mongoose.Types.ObjectId,
        ref: "invoices"
    },
    paymentId: {
        type: String,
        default: ""
    },
    sessionData: {
        type: mongoose.SchemaTypes.Mixed
    },
    status: {
        type: Number,
        default: 0
    },
    url: {
        type: String,
        default: ""
    },
    orderType: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("checkoutsession", checkoutSession);
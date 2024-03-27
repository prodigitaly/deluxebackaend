const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const refundPayment = mongoose.Schema({
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
    refundTime: {
        type: Date
    }
}, { timestamps: true });

module.exports = mongoose.model("refundpayment", refundPayment);
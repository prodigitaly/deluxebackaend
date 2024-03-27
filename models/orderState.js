const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const orderState = mongoose.Schema({
    from: {
        type: Number
    },
    to: {
        type: Number
    },
    orderId: {
        type: mongoose.Types.ObjectId,
        ref: "invoices"
    }
}, { timestamps: true });

module.exports = mongoose.model("orderState", orderState);
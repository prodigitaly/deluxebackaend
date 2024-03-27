const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const orderSchema = mongoose.Schema({
    orderAmount: {
        type: Number,
        default: 0
    },
    date: {
        type: String,
        default: ""
    },
    taxes: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    }
}, { timestamps: true });

module.exports = mongoose.model("order", orderSchema);
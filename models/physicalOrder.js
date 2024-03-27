const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const physicalOrder = mongoose.Schema({
    orderId: {
        type: mongoose.Types.ObjectId,
        ref: "invoices"
    }
}, { timestamps: true });

module.exports = mongoose.model("physicalOrder", physicalOrder);
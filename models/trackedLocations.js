const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const trackedLocations = mongoose.Schema({
    riderId: {
        type: mongoose.Types.ObjectId,
        ref: "riders"
    },
    rideId: {
        type: mongoose.Types.ObjectId,
        ref: "pickupdelivery"
    },
    orderId: {
        type: mongoose.Types.ObjectId,
        ref: "invoices"
    },
    location: [Number]
}, { timestamps: true });

module.exports = mongoose.model("tackedlocation", trackedLocations);
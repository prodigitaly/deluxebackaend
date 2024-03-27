const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const addressSchema = mongoose.Schema({
    addressType: {
        type: String,
        enum: ["Home", "Office", "Other"]
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    pincode: {
        type: String
    },
    houseNo: {
        type: String
    },
    street: {
        type: String
    },
    placeName: {
        type: String
    },
    placeAddress: {
        type: String
    },
    district: {
        type: String
    },
    locality: {
        type: String
    },
    landmark: {
        type: String
    },
    mobileNo: {
        type: String,
        default: ""
    },
    countryCode: {
        type: String,
        default: "+1"
    },
    lat: Number,
    long: Number,
    city: String,
    region: String,
    country: String,
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model("address", addressSchema);
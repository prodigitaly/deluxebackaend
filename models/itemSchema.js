const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const itemSchema = mongoose.Schema({
    name: {
        type: String,
        default: ""
    },
    icon: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    mrp: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        default: 0
    },
    isBag: {
        type: Boolean,
        default: false
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    categoryId: {
        type: mongoose.Types.ObjectId,
        ref: "categories"
    },
    priceTag: {
        type: String,
        default: ""
    },
    unitType: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model("item", itemSchema);
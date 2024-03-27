const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const proofSchema = mongoose.Schema({
    image: {
        type: String,
        default: ""
    },
    userId: {
        type: mongoose.Types.ObjectId
    },
    title: {
        type: String,
        default: ""
    },
    isVerified: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model("proof", proofSchema);
const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const bannerSchema = mongoose.Schema({
    banner: {
        type: String
    },
    priority: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("banner", bannerSchema);
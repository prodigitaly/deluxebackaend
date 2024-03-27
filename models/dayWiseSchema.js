const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const dayWiseSchema = mongoose.Schema({
    date: {
        type: String
    },
    timeSlotId: {
        type: mongoose.Types.ObjectId,
        ref: "daywise"
    },
    timeSlot: {
        type: String,
        default: ""
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isHalfHoliday: {
        type: Boolean,
        default: false
    },
    isFullHoliday: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model("daywise", dayWiseSchema);
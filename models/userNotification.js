const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const userNotification = mongoose.Schema({
    userId: {
        type: mongoose.Types.ObjectId,
        ref: "users"
    },
    title: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    targetId: {
        type: mongoose.Types.ObjectId,
        ref: "invoices"
    },
    //0==order
    //1==subscription
    //2==membership
    notificationType: {
        type: Number,
        default: 0
    },
    isSeen: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model("usernotification", userNotification);
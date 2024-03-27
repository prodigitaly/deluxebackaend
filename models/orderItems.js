const mongoose = require('mongoose');
const client = require('../utility/setup/redis');
const categorySchema = require('./categorySchema');

// const bcrypt = require('bcrypt');
const orderItems = mongoose.Schema({
    itemId: {
        type: mongoose.Types.ObjectId,
        ref: "item"
    },
    qty: {
        type: Number,
        default: 0,
        min: [0, 'cannot have nagative qty']
    },
    amount: {
        type: Number,
        default: 0,
        min: [0, 'cannot have nagative amount']
    },
    categoryId: {
        type: mongoose.Types.ObjectId,
        ref: "categories"
    },
    orderId: {
        type: mongoose.Types.ObjectId,
        ref: "invoices"
    }
}, { timestamps: true });
orderItems.pre('validate', async function (next) {
    // let getUserId = await client.get(this.userId.toString());
    // const categoryIds = await getCategory();
    // if (getUserId != null && getUserId != undefined && categoryIds.includes(this.categoryId)) {
    //     this.amount = 0;
    // }
    next();
});
orderItems.pre('save', async function (next) {
    // let getUserId = await client.get(this.userId.toString());
    // const caytegoryIds = await getCategory();
    // console.log('this executed')
    // console.log(caytegoryIds)

    next()
});
orderItems.pre('findOneAndUpdate', async function (next) {
    // console.log("updated")
    // const docToUpdate = await this.model.findOne(this.getQuery());
    // let getUserId = await client.get(docToUpdate.userId.toString());
    // if (getUserId != null && getUserId != undefined && this.categoryId in getCategory) {
    //     this.amount = 0
    // }
    // your code here
    next();
});

module.exports = mongoose.model("orderitem", orderItems);
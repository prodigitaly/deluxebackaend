const mongoose = require("mongoose");
const client = require("../utility/setup/redis");
const categorySchema = require("./categorySchema");
const orderItems = require("./orderItems");
const taxSchema = require("./taxSchema");
const userSubscription = require("./userSubscription");
const getCategory = async () => {
  const categories = await categorySchema.find({
    name: { $in: ["Dry Cleaning", "Washing"] },
  });
  return categories.map((e) => e._id);
};

// const bcrypt = require('bcrypt');
const invoiceSchema = mongoose.Schema(
  {
    dayWiseId: {
      type: mongoose.Types.ObjectId,
      ref: "daywises",
    },
    pickupTimeId: {
      type: mongoose.Types.ObjectId,
      ref: "daywises",
    },
    deliveryTimeId: {
      type: mongoose.Types.ObjectId,
      ref: "daywises",
    },
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "users",
    },
    pickupInstruction: {
      type: String,
      default: "",
    },
    deliveryInstruction: {
      type: String,
      default: "",
    },
    pickupId: {
      type: mongoose.Types.ObjectId,
      ref: "addresses",
    },
    deliveryId: {
      type: mongoose.Types.ObjectId,
      ref: "addresses",
    },
    //0==initiated
    //1==pending
    //2==booking confirm pickup pending
    //3==pickup initiated
    //4==pickup failed
    //5==pickup complete
    //6==processing
    //7==complete cleaning
    //8==delivery intiated
    //9==delivery failed
    //10==delivery completed& order completed
    //11==cancelled
    //12==refund initiated
    //13==refund completed
    //14==payment failed
    status: {
      type: Number,
      default: 0,
    },
    isSubscribed: {
      type: Boolean,
      default: false,
    },
    isMember: {
      type: Boolean,
      default: false,
    },
    orderAmount: {
      type: Number,
      default: 0,
      min: [0, "cannot have nagative amount"],
    },
    taxes: {
      type: Map,
      of: Number,
    },
    couponId: {
      type: mongoose.Types.ObjectId,
      ref: "coupons",
    },
    finalAmount: {
      type: Number,
      default: 0,
      min: [0, "cannot have nagative amount"],
    },
    orderTotalAmount: {
      type: Number,
      default: 0,
      min: [0, "cannot have nagative amount"],
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "cannot have nagative amount"],
    },
    pendingAmount: {
      type: Number,
      default: 0,
      min: [0, "cannot have nagative amount"],
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: [0, "cannot have nagative amount"],
    },
    orderId: {
      type: String,
      default: "",
    },
    invoiceId: {
      type: String,
      default: "",
    },
    paymentId: [String],
    note: String,
    pickupAddressId: {
      type: mongoose.Types.ObjectId,
      ref: "address",
    },
    deliveryAddressId: {
      type: mongoose.Types.ObjectId,
      ref: "address",
    },
  },
  { timestamps: true }
);
// Function to update invoice with order details
const updateInvoiceWithOrderDetails = async function (docToUpdate) {
  console.log("function before");
  console.log(docToUpdate);
  let getUserId = await client.get(`${docToUpdate.userId.toString()}-EX`);
  if (getUserId != null && getUserId != undefined) {
    const category = await getCategory();
    const itemsUpdate = await orderItems.updateMany(
      {
        orderId: mongoose.Types.ObjectId(docToUpdate._id),
        categoryId: { $in: category },
      },
      { amount: 0 }
    );
    const orderId = docToUpdate._id;
    const result = await orderItems.aggregate([
      // match the documents with the given orderId
      { $match: { orderId: mongoose.Types.ObjectId(orderId) } },
      // group the documents by orderId and get the sum of the amount field
      { $group: { _id: "$orderId", totalAmount: { $sum: "$amount" } } },
    ]);
    const getAmount = result.length > 0 ? result[0].totalAmount : 0;
    taxApplied = docToUpdate["taxes"];
    payableAmount = getAmount;
    let taxes = await taxSchema.findOne({
      isSubscription: docToUpdate["isSubscribed"],
      isMember: docToUpdate["isMember"],
    });
    console.log(taxes);
    if (taxes != undefined && taxes != null) {
      taxApplied = taxes.taxes;
      console.log(Object.values(taxApplied));
      payableAmount =
        parseFloat(payableAmount) +
        parseFloat(Object.values(taxApplied).reduce((a, b) => a + b, 0)) -
        taxApplied.tax;
    } else {
      payableAmount = parseFloat(payableAmount);
    }
    taxApplied["tax"] = getAmount * (taxApplied["tax"] / 100) || 0;
    payableAmount = payableAmount + taxApplied["tax"];
    docToUpdate["taxes"] = taxApplied;
    docToUpdate["finalAmount"] = parseFloat(payableAmount).toFixed(2);
    docToUpdate["orderAmount"] = parseFloat(getAmount).toFixed(2);
    docToUpdate["orderTotalAmount"] = parseFloat(payableAmount).toFixed(2);
    docToUpdate["amountPaid"] = parseFloat(0).toFixed(2);
    docToUpdate["pendingAmount"] = parseFloat(payableAmount).toFixed(2);
    docToUpdate["refundAmount"] = parseFloat(0).toFixed(2);
    return docToUpdate;
  }
};

// Pre save hook
invoiceSchema.pre("save", async function (next) {
  console.log("save");
  console.log(this);
  await updateInvoiceWithOrderDetails(this);
  console.log("after");
  console.log(this);
  next();
});

// Pre findOneAndUpdate hook
invoiceSchema.pre("findOneAndUpdate", async function (next) {
  console.log("findone and update");
  await updateInvoiceWithOrderDetails(
    await this.model.findOne(this.getQuery())
  );
  next();
});

module.exports = mongoose.model("invoice", invoiceSchema);

const mongoose = require("mongoose");
// const bcrypt = require('bcrypt');
const userStripe = mongoose.Schema(
  {
    customerId: {
      type: String,
      default: "",
    },
    paymentMethodId: [String],
    userId: {
      type: mongoose.Types.ObjectId,
      ref: "users",
    },
  },
  { timestamps: true }
);
const schemaName =
  process.env.NODE_ENV === "production" ? "userstripe" : "userstripetest";
module.exports = mongoose.model(schemaName, userStripe);

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const client = require("../utility/setup/redis");
const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      default: "",
    },
    mobileNo: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      default: "Other",
      enum: ["Male", "Female", "Other"],
    },
    email: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    password: {
      type: String,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isMobileVerified: {
      type: Boolean,
      default: false,
    },
    currentPlan: String,
    otp: String,
    generatedTime: [String],
    countryCode: {
      type: String,
      default: "+507",
    },
    dob: String,
    //0==active
    //1==banned
    status: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      default: "",
    },
    note: {
      type: String,
      default: "",
    },
    preferrdPickupTime: {
      type: mongoose.Types.ObjectId,
      ref: "pickups",
    },
    preferrdDeliveryTime: {
      type: mongoose.Types.ObjectId,
      ref: "pickups",
    },
    pickupAddressId: {
      type: mongoose.Types.ObjectId,
      ref: "address",
    },
    deliveryAddressId: {
      type: mongoose.Types.ObjectId,
      ref: "address",
    },
    preferrdPickupId: {
      type: mongoose.Types.ObjectId,
      ref: "daywise",
    },
    preferrdDeliveryId: {
      type: mongoose.Types.ObjectId,
      ref: "daywise",
    },
    pickupInstruction: {
      type: String,
      default: "",
    },
    deliveryInstruction: {
      type: String,
      ref: "",
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  try {
    if (this.password != undefined) {
      const salt = await bcrypt.genSalt(10);
      const hashedpassword = await bcrypt.hash(this.password, salt);
      this.password = hashedpassword;
    }
    next();
    //console.log("before called");
  } catch (error) {
    next(error);
  }
});
userSchema.post("save", async function (doc) {
  try {
    const userId = doc._id.toString();
    // await client.set(userId, userId, 'Ex', 604800);
    await client.set(`${userId}-EX`, userId, { EX: 604800 });
  } catch (error) {
    console.error(error);
  }
});

module.exports = mongoose.model("users", userSchema);

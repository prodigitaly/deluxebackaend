var express = require("express");
var router = express.Router();
const moment = require("moment");
const momentTz = require("moment-timezone");
require("dotenv").config();
const { default: mongoose } = require("mongoose");
const userSchema = require("../models/userModel");
const { getCurrentDateTime24 } = require("../utility/dates");
const nodemailer = require("nodemailer");
const { check, body, oneOf } = require("express-validator");
const { main } = require("../utility/mail");
const { sendSms } = require("../utility/sendSms");
const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const { getPlaces, placeFilter, formatAddress } = require("../utility/mapbox");
const {
  generateAccessToken,
  authenticateToken,
  generateRefreshToken,
  checkUserRole,
  authenticateTokenWithUserId,
} = require("../middleware/auth");
const addressSchema = require("../models/addressSchema");
const { checkErr } = require("../utility/error");
const userSubscription = require("../models/userSubscription");
const subscriptionSchema = require("../models/subscriptionSchema");
const riderSchema = require("../models/riderSchema");
const { uploadProfileImageToS3, removeObject } = require("../utility/aws");
const pickupDeliverySchema = require("../models/pickupDeliverySchema");
const client = require("../utility/setup/redis");
/* GET home page. */
router.get("/", async function (req, res, next) {
  console.log(validatePhoneNumber("9999999999"));
  console.log(validateEmail("abc@gmail.com"));
  res.render("index", { title: "Express" });
});
router.post(
  "/signUp",
  authenticateToken,
  checkUserRole(["superAdmin", "admin"]),
  [
    body("email").isEmail().withMessage("please pass email id"),
    body("name").isString().withMessage("please pass name"),
    body("role")
      .optional()
      .isIn(["rider"])
      .withMessage("please pass valid role"),
    body("gender")
      .isIn(["Male", "Female", "Other"])
      .withMessage("please pass valid gender value"),
    body("dob")
      .custom((value) => {
        return regex.test(value);
      })
      .withMessage("please pass dob"),
    body("countryCode", "please pass valid country code")
      .notEmpty()
      .custom((value) => {
        return value.startsWith("+");
      }),
    body("mobileNo").isMobilePhone().withMessage("please pass mobile no"),
    body("alternativeMobile")
      .optional()
      .isMobilePhone()
      .withMessage("please pass mobile no"),
    body("fatherName", "please pass valid father name")
      .optional()
      .notEmpty()
      .isString(),
    body("bloodGroup", "please pass valid blood group")
      .optional()
      .notEmpty()
      .isString(),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const {
        name,
        gender,
        dob,
        role,
        mobileNo,
        countryCode,
        email,
        alternativeMobile,
        fatherName,
        bloodGroup,
      } = req.body;

      let checkExist = await riderSchema.aggregate([
        {
          $match: {
            $or: [{ email: email }, { mobileNo: mobileNo }],
          },
        },
      ]);

      if (checkExist.length > 0) {
        return res
          .status(409)
          .json({
            issuccess: false,
            data: { acknowledgement: false },
            message: "rider already exist",
          });
      }

      // const userLoginIs = new userLogin({
      //   userName: userName,
      //   password: password
      // });

      // await userLoginIs.save();
      var randomstring = Math.floor(
        100000000000 + Math.random() * 900000000000
      );

      const userIs = new riderSchema({
        email: email,
        mobileNo: mobileNo,
        name: name,
        gender: gender,
        dob: dob,
        countryCode: countryCode,
        username: randomstring,
        fatherName: fatherName,
        bloodGroup: bloodGroup,
        alternativeMobile: alternativeMobile,
        role: role,
      });

      await userIs.save();
      userIs._doc["id"] = userIs._doc["_id"];
      delete userIs._doc.updatedAt;
      delete userIs._doc.createdAt;
      delete userIs._doc._id;
      delete userIs._doc.__v;
      delete userIs._doc.generatedTime;
      delete userIs._doc.otp;

      let message = `<h1>Hello ${name}</h1><br/><br/><p>welcome to delux laundry system</p><br> Your registration successful now , Please start your work as scheduled`;
      await main(email, message);
      await sendSms(
        countryCode + mobileNo,
        `Helllo ${name}, welcome to delux laundry system <br> Your registration successful now , Please start your work as scheduled`
      );

      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: userIs },
          message: "sign up successfully",
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: error.message || "Having issue is server",
        });
    }
  }
);
router.post(
  "/login",
  [
    body("mobileNo").isMobilePhone().withMessage("please pass mobile no"),
    body("countryCode").isString().withMessage("please pass countrycode"),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { mobileNo, countryCode } = req.body;

      let checkExist = await riderSchema.aggregate([
        {
          $match: {
            $or: [{ mobileNo: mobileNo }],
          },
        },
      ]);

      if (checkExist.length > 0) {
        otp = getRandomIntInclusive(111111, 999999);
        await client.set(
          checkExist[0]._id.toString(),
          otp.toString(),
          "EX",
          300,
          (err, reply) => {
            if (err) {
              console.error(err);
            } else {
              console.log(reply);
            }
          }
        );
        res
          .status(200)
          .json({
            issuccess: true,
            data: { acknowledgement: true, otp: otp, exist: true },
            message: "otp sent to mobile no",
          });

        let update = await riderSchema.findByIdAndUpdate(checkExist[0]._id, {
          otp: otp,
          generatedTime: getCurrentDateTime24("Asia/Kolkata"),
        });
        await sendSms(
          countryCode + mobileNo,
          `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others. Regards,Team Sparkle Up`
        );
        return;
        // return res.status(409).json({ IsSuccess: true, Data: [], Messsage: "user already exist" });
      }
      return res
        .status(404)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: "user not found",
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: error.message || "Having issue is server",
        });
    }
  }
);
router.post(
  "/updateUser",
  authenticateToken,
  uploadProfileImageToS3("rider").single("image"),
  [
    body("name", "please enter valid name").optional().notEmpty().isString(),
    body("gender", "please pass dob")
      .optional()
      .isIn(["Male", "Female", "Other"]),
    body("dob", "please pass dob")
      .optional()
      .custom((value) => {
        return regex.test(value);
      }),
    body("jobStatus", "please enter valid status").optional().isBoolean(),
    body("activeStatus", "please enter valid active status")
      .optional()
      .isNumeric(),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { name, dob, gender, jobStatus, activeStatus } = req.body;

      const userId = req.user._id;

      let checkUser = await riderSchema.findById(userId);
      if (checkUser == undefined || checkUser == null) {
        return res
          .status(404)
          .json({
            issuccess: false,
            data: { acknowledgement: false },
            message: "no user found with this ids",
          });
      }
      if (req.file != undefined && req.file.location != undefined) {
        let result = checkUser.image.indexOf("rider");
        let key = checkUser.image.substring(result, checkUser.image.length);
        if (key != undefined) {
          removeObject(key);
        }
      }
      let update = {
        name: name,
        dob: dob,
        gender: gender,
        jobStatus: jobStatus,
        activeStatus: activeStatus,
        image:
          req.file != undefined && req.file.location != undefined
            ? req.file.location
            : checkUser.image,
      };
      let updateRider = await riderSchema.findByIdAndUpdate(userId, update, {
        new: true,
      });
      updateRider._doc["id"] = updateRider._doc["_id"];
      delete updateRider._doc.__v;
      delete updateRider._doc._id;
      delete updateRider._doc.generatedTime;
      delete updateRider._doc.otp;
      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: updateRider },
          message: "user details updated",
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: error.message || "Having issue is server",
        });
    }
  }
);
router.post(
  "/updateInsurance",
  authenticateToken,
  uploadProfileImageToS3("rider").single("image"),
  [
    body("name", "please enter valid name").optional().notEmpty().isString(),
    body("gender", "please pass dob")
      .optional()
      .isIn(["Male", "Female", "Other"]),
    body("dob", "please pass dob")
      .optional()
      .custom((value) => {
        return regex.test(value);
      }),
    body("jobStatus", "please enter valid status").optional().isBoolean(),
    body("activeStatus", "please enter valid active status")
      .optional()
      .isNumeric(),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { name, dob, gender, jobStatus, activeStatus } = req.body;

      const userId = req.user._id;

      let checkUser = await riderSchema.findById(userId);
      if (checkUser == undefined || checkUser == null) {
        return res
          .status(404)
          .json({
            issuccess: false,
            data: { acknowledgement: false },
            message: "no user found with this ids",
          });
      }
      if (req.file != undefined && req.file.location != undefined) {
        let result = checkUser.image.indexOf("rider");
        let key = checkUser.image.substring(result, checkUser.image.length);
        if (key != undefined) {
          removeObject(key);
        }
      }
      let update = {
        name: name,
        dob: dob,
        gender: gender,
        jobStatus: jobStatus,
        activeStatus: activeStatus,
        image:
          req.file != undefined && req.file.location != undefined
            ? req.file.location
            : checkUser.image,
      };
      let updateRider = await riderSchema.findByIdAndUpdate(userId, update, {
        new: true,
      });
      updateRider._doc["id"] = updateRider._doc["_id"];
      delete updateRider._doc.__v;
      delete updateRider._doc._id;
      delete updateRider._doc.generatedTime;
      delete updateRider._doc.otp;
      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: updateRider },
          message: "user details updated",
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: error.message || "Having issue is server",
        });
    }
  }
);
router.get(
  "/getAssignedOrders",
  authenticateToken,
  checkUserRole(["admin,superAdmin"]),
  async (req, res, next) => {
    try {
      const userId = req.query.riderId;
      const checkUser = await pickupDeliverySchema.aggregate([
        {
          $match: {
            $and: [
              {
                riderId: mongoose.Types.ObjectId(userId),
              },
              {
                status: { $in: [2, 3, 4] },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "daywises",
            let: { orderId: "$pickupTimeId", rideType: "$rideType" },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] } } },
              {
                $addFields: {
                  id: "$_id",
                },
              },
              {
                $project: {
                  _id: 0,
                  __v: 0,
                },
              },
            ],
            as: "pickupTimeData",
          },
        },
        {
          $lookup: {
            from: "daywises",
            let: { orderId: "$deliveryTimeId" },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] } } },
              {
                $addFields: {
                  id: "$_id",
                },
              },
              {
                $project: {
                  _id: 0,
                  __v: 0,
                },
              },
            ],
            as: "deliveryTimeData",
          },
        },
        {
          $addFields: {
            isSameDay: {
              $cond: [
                {
                  $eq: [
                    { $first: "$pickupTimeData.date" },
                    { $first: "$deliveryTimeData.date" },
                  ],
                },
                true,
                false,
              ],
            },
            timeData: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$rideType", 0] },
                    then: { $first: "$pickupTimeData" },
                  },
                  {
                    case: { $eq: ["$rideType", 1] },
                    then: { $first: "$deliveryTimeData" },
                  },
                  { case: { $eq: ["$rideType", 2] }, then: "Return" },
                ],
                default: "Did not match",
              },
            },
          },
        },
        {
          $lookup: {
            from: "invoices",
            let: { orderId: "$orderId" },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] } } },
              {
                $lookup: {
                  from: "addresses",
                  let: { orderId: "$pickupAddressId" },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] },
                      },
                    },
                    {
                      $addFields: {
                        id: "$_id",
                      },
                    },
                    {
                      $project: {
                        _id: 0,
                        __v: 0,
                      },
                    },
                  ],
                  as: "pickupAddressData",
                },
              },
              {
                $lookup: {
                  from: "addresses",
                  let: {
                    orderId: "$deliveryAddressId",
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] },
                      },
                    },
                    {
                      $addFields: {
                        id: "$_id",
                      },
                    },
                    {
                      $project: {
                        _id: 0,
                        __v: 0,
                      },
                    },
                  ],
                  as: "deliveryAddressData",
                },
              },
              {
                $addFields: {
                  id: "$_id",
                  pickupAddress: { $first: "$pickupAddressData" },
                  deliveryAddress: { $first: "$deliveryAddressData" },
                },
              },
              {
                $project: {
                  _id: 0,
                  __v: 0,
                },
              },
            ],
            as: "orderData",
          },
        },
        {
          $addFields: {
            id: "$_id",
            rideTypeValue: {
              $switch: {
                branches: [
                  { case: { $eq: ["$rideType", 0] }, then: "Pickup" },
                  { case: { $eq: ["$rideType", 1] }, then: "Delivery" },
                  { case: { $eq: ["$rideType", 2] }, then: "Return" },
                ],
                default: "Did not match",
              },
            },
            addressData: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$rideType", 0] },
                    then: { $first: "$orderData.pickupAddress" },
                  },
                  {
                    case: { $eq: ["$rideType", 1] },
                    then: { $first: "$orderData.deliveryAddress" },
                  },
                  { case: { $eq: ["$rideType", 2] }, then: "Return" },
                ],
                default: "Did not match",
              },
            },
          },
        },
        {
          $sort: { updatedAt: -1 },
        },
        {
          $project: {
            pickupTimeData: 0,
            deliveryTimeData: 0,
            "orderData.pickupAddressData": 0,
            "orderData.deliveryAddressData": 0,
            "orderData.pickupAddress": 0,
            "orderData.deliveryAddress": 0,
            createdAt: 0,
            updatedAt: 0,
            _id: 0,
            __v: 0,
            otp: 0,
          },
        },
      ]);
      if (checkUser.length == 0) {
        return res
          .status(200)
          .json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: "no any order assigned",
          });
      }
      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: checkUser },
          message: "order found",
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: error.message || "Having issue is server",
        });
    }
  }
);
router.get(
  "/getTodayOrders",
  authenticateToken,
  checkUserRole(["admin,superAdmin"]),
  async (req, res, next) => {
    try {
      const userId = req.query.riderId;
      // let currentDate = moment()
      //     .tz('America/Panama').format("DD/MM/YYYY")
      let currentDate = "01/12/2022";
      console.log(currentDate);
      const checkUser = await pickupDeliverySchema.aggregate([
        {
          $match: {
            $and: [
              {
                riderId: mongoose.Types.ObjectId(userId),
              },
              {
                status: { $in: [0, 1] },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "daywises",
            let: { orderId: "$pickupTimeId", rideType: "$rideType" },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] } } },
              {
                $addFields: {
                  id: "$_id",
                },
              },
              {
                $project: {
                  _id: 0,
                  __v: 0,
                },
              },
            ],
            as: "pickupTimeData",
          },
        },
        {
          $lookup: {
            from: "daywises",
            let: { orderId: "$deliveryTimeId" },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] } } },
              {
                $addFields: {
                  id: "$_id",
                },
              },
              {
                $project: {
                  _id: 0,
                  __v: 0,
                },
              },
            ],
            as: "deliveryTimeData",
          },
        },
        {
          $addFields: {
            isSameDay: {
              $cond: [
                {
                  $eq: [
                    { $first: "$pickupTimeData.date" },
                    { $first: "$deliveryTimeData.date" },
                  ],
                },
                true,
                false,
              ],
            },
            timeData: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$rideType", 0] },
                    then: { $first: "$pickupTimeData" },
                  },
                  {
                    case: { $eq: ["$rideType", 1] },
                    then: { $first: "$deliveryTimeData" },
                  },
                  { case: { $eq: ["$rideType", 2] }, then: "Return" },
                ],
                default: "Did not match",
              },
            },
          },
        },
        {
          $lookup: {
            from: "invoices",
            let: { orderId: "$orderId" },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] } } },
              {
                $lookup: {
                  from: "addresses",
                  let: { orderId: "$pickupAddressId" },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] },
                      },
                    },
                    {
                      $addFields: {
                        id: "$_id",
                      },
                    },
                    {
                      $project: {
                        _id: 0,
                        __v: 0,
                      },
                    },
                  ],
                  as: "pickupAddressData",
                },
              },
              {
                $lookup: {
                  from: "addresses",
                  let: {
                    orderId: "$deliveryAddressId",
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] },
                      },
                    },
                    {
                      $addFields: {
                        id: "$_id",
                      },
                    },
                    {
                      $project: {
                        _id: 0,
                        __v: 0,
                      },
                    },
                  ],
                  as: "deliveryAddressData",
                },
              },
              {
                $addFields: {
                  id: "$_id",
                  pickupAddress: { $first: "$pickupAddressData" },
                  deliveryAddress: { $first: "$deliveryAddressData" },
                },
              },
              {
                $project: {
                  _id: 0,
                  __v: 0,
                },
              },
            ],
            as: "orderData",
          },
        },
        {
          $addFields: {
            id: "$_id",
            rideTypeValue: {
              $switch: {
                branches: [
                  { case: { $eq: ["$rideType", 0] }, then: "Pickup" },
                  { case: { $eq: ["$rideType", 1] }, then: "Delivery" },
                  { case: { $eq: ["$rideType", 2] }, then: "Return" },
                ],
                default: "Did not match",
              },
            },
            addressData: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$rideType", 0] },
                    then: { $first: "$orderData.pickupAddress" },
                  },
                  {
                    case: { $eq: ["$rideType", 1] },
                    then: { $first: "$orderData.deliveryAddress" },
                  },
                  { case: { $eq: ["$rideType", 2] }, then: "Return" },
                ],
                default: "Did not match",
              },
            },
          },
        },
        {
          $match: {
            $expr: {
              $eq: ["$timeData.date", currentDate],
            },
          },
        },
        {
          $sort: { updatedAt: -1 },
        },
        {
          $project: {
            pickupTimeData: 0,
            deliveryTimeData: 0,
            "orderData.pickupAddressData": 0,
            "orderData.deliveryAddressData": 0,
            "orderData.pickupAddress": 0,
            "orderData.deliveryAddress": 0,
            createdAt: 0,
            updatedAt: 0,
            _id: 0,
            __v: 0,
            otp: 0,
          },
        },
      ]);
      if (checkUser.length == 0) {
        return res
          .status(200)
          .json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: "no any order assigned",
          });
      }
      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: checkUser },
          message: "order found",
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: error.message || "Having issue is server",
        });
    }
  }
);
router.get("/getProfile", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;

    const checkUser = await riderSchema.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(userId),
        },
      },
      {
        $addFields: {
          id: "$_id",
        },
      },
      {
        $project: {
          generatedTime: 0,
          createdAt: 0,
          updatedAt: 0,
          _id: 0,
          __v: 0,
          otp: 0,
        },
      },
    ]);
    if (checkUser.length == 0) {
      return res
        .status(404)
        .json({
          issuccess: false,
          data: { acknowledgement: false, data: null },
          message: "no user details found",
        });
    }
    return res
      .status(200)
      .json({
        issuccess: true,
        data: { acknowledgement: true, data: checkUser[0] },
        message: "user details found",
      });
  } catch (error) {
    return res
      .status(500)
      .json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
  }
});
router.post(
  "/resendOtp",
  [
    oneOf(
      [body("id").isEmail(), body("id").isMobilePhone()],
      "please pass email or mobile no"
    ),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { id } = req.body;
      let checkOtp = await riderSchema.aggregate([
        {
          $match: {
            $and: [{ $or: [{ email: id }, { mobileNo: id }] }],
          },
        },
      ]);
      if (checkOtp.length == 0) {
        return res
          .status(404)
          .json({
            issuccess: false,
            data: { acknowledgement: false },
            message: "no user found with this ids",
          });
      }

      otp = getRandomIntInclusive(111111, 999999);
      await client.set(
        checkOtp[0]._id.toString(),
        otp.toString(),
        "EX",
        300,
        (err, reply) => {
          if (err) {
            console.error(err);
          } else {
            console.log(reply);
          }
        }
      );
      res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: otp },
          message: "Otp sent successfully",
        });

      let update = await riderSchema.findByIdAndUpdate(checkOtp[0]._id, {
        otp: otp,
        generatedTime: getCurrentDateTime24("Asia/Kolkata"),
      });
      let message = `Dear customer,\n

${otp} is your one time password(OTP). Please do not share the OTP with others. \n

Regards,
Team Sparkle Up`;

      if (validateEmail(id)) {
        await main(checkOtp[0].email, message);
      } else if (validatePhoneNumber(id)) {
        await sendSms(
          checkOtp[0].countryCode + checkOtp[0].mobileNo,
          `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others. Regards,Team Sparkle Up`
        );
      }
      return;

      return res
        .status(404)
        .json({ IsSuccess: true, Data: [], Messsage: "user not found" });
    } catch (error) {
      console.log(error.message);
      return res
        .status(500)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: error.message || "Having issue is server",
        });
    }
  }
);

router.post("/resendOtpUsingId", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.body;
    console.log(userId);
    let checkOtp = await riderSchema.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(userId),
        },
      },
    ]);
    if (checkOtp.length == 0) {
      return res
        .status(200)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: "no user found with this ids",
        });
    }

    otp = getRandomIntInclusive(111111, 999999);
    await client.set(
      checkOtp[0]._id.toString(),
      otp.toString(),
      "EX",
      300,
      (err, reply) => {
        if (err) {
          console.error(err);
        } else {
          console.log(reply);
        }
      }
    );
    res
      .status(200)
      .json({
        issuccess: true,
        data: { acknowledgement: true, data: otp },
        message: "Otp sent successfully",
      });

    let update = await riderSchema.findByIdAndUpdate(checkOtp[0]._id, {
      otp: otp,
      generatedTime: getCurrentDateTime24("Asia/Kolkata"),
    });
    let message = `Dear customer,\n

${otp} is your one time password(OTP). Please do not share the OTP with others. \n

Regards,
Team Sparkle Up`;

    if (validateEmail(id)) {
      await main(checkOtp[0].email, message);
    } else if (validatePhoneNumber(id)) {
      await sendSms(
        checkOtp[0].countryCode + checkOtp[0].mobileNo,
        `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others. Regards,Team Sparkle Up`
      );
    }
    return;

    return res
      .status(200)
      .json({ IsSuccess: true, Data: [], Messsage: "user not found" });
  } catch (error) {
    console.log(error.message);
    return res
      .status(500)
      .json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
  }
});
//authenticate otp and update for verified status
router.post(
  "/authenticateOtpLogin",
  [
    oneOf(
      [body("id").isEmail(), body("id").isMobilePhone()],
      "please pass email or mobile no"
    ),
    body("otp").isNumeric().withMessage("please pass otp"),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { otp, id } = req.body;

      let checkUser = await riderSchema.aggregate([
        {
          $match: {
            $or: [{ email: id }, { mobileNo: id }],
          },
        },
      ]);

      if (checkUser.length == 0) {
        return res
          .status(404)
          .json({
            issuccess: false,
            data: { acknowledgement: false, status: 3 },
            message: `No User Found With ${id}`,
          });
      }
      if (otp == "000000") {
        let updateData = {};
        if (validateEmail(id)) {
          updateData = {
            isEmailVerified: true,
          };
        } else if (validatePhoneNumber(id)) {
          updateData = {
            isMobileVerified: true,
          };
        }
        console.log(checkUser[0].otp);
        let update = await riderSchema.findByIdAndUpdate(
          checkUser[0]._id,
          updateData,
          { new: true }
        );
        const { generatedToken, refreshToken } = await generateAccessToken({
          _id: checkUser[0]._id,
          role: checkUser[0].role,
        });
        return res
          .status(200)
          .json({
            issuccess: true,
            data: {
              acknowledgement: true,
              status: 0,
              generatedToken: generatedToken,
              refreshToken: refreshToken,
            },
            message: `otp verifed successfully`,
          });
      }

      const startIs = momentTz(
        moment(checkUser[0].generatedTime.join(" "), "DD/MM/YYYY H:mm:ss")
      ).tz("Asia/Kolkata");
      const endIs = momentTz(
        moment(checkUser[0].generatedTime.join(" "), "DD/MM/YYYY H:mm:ss").add(
          5,
          "minutes"
        )
      ).tz("Asia/Kolkata");
      const timeIs = momentTz().tz("Asia/Kolkata");
      const getOtp = await client.get(checkUser[0]._id.toString());
      // const startIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss');
      // const endIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes');
      // const timeIs = moment();
      console.log(startIs);
      console.log(endIs);
      console.log(timeIs);
      if (getOtp != undefined) {
        //otp valid
        if (getOtp == otp) {
          let updateData = {};
          if (validateEmail(id)) {
            updateData = {
              isEmailVerified: true,
            };
          } else if (validatePhoneNumber(id)) {
            updateData = {
              isMobileVerified: true,
            };
          }
          console.log(checkUser[0].otp);
          let update = await riderSchema.findByIdAndUpdate(
            checkUser[0]._id,
            updateData,
            { new: true }
          );
          const { generatedToken, refreshToken } = await generateAccessToken({
            _id: checkUser[0]._id,
            role: checkUser[0].role,
          });
          return res
            .status(200)
            .json({
              issuccess: true,
              data: {
                acknowledgement: true,
                status: 0,
                generatedToken: generatedToken,
                refreshToken: refreshToken,
              },
              message: `otp verifed successfully`,
            });
        } else {
          return res
            .status(401)
            .json({
              issuccess: false,
              data: { acknowledgement: false, status: 2 },
              message: `incorrect otp`,
            });
        }
        console.log("valid");
      } else {
        //otp expired
        return res
          .status(410)
          .json({
            issuccess: false,
            data: { acknowledgement: false, status: 1 },
            message: `otp expired`,
          });
      }
    } catch (error) {
      console.log(error.message);
      return res
        .status(500)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: error.message || "Having issue is server",
        });
    }
  }
);

//return response for otp verification only
router.post(
  "/authenticateOtp",
  [
    oneOf(
      [body("id").isEmail(), body("id").isMobilePhone()],
      "please pass email or mobile no"
    ),
    body("otp").isNumeric().withMessage("please pass otp"),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { otp, id } = req.body;

      let checkUser = await riderSchema.aggregate([
        {
          $match: {
            $or: [{ email: id }, { mobileNo: id }],
          },
        },
      ]);

      if (checkUser.length == 0) {
        return res
          .status(404)
          .json({
            issuccess: false,
            data: { acknowledgement: false, status: 3 },
            message: `No User Found With ${userId}`,
          });
      }

      if (otp == "000000") {
        const { generatedToken, refreshToken } = await generateAccessToken({
          _id: checkUser[0]._id,
          role: checkUser[0].role,
        });
        return res
          .status(200)
          .json({
            issuccess: true,
            data: {
              acknowledgement: true,
              status: 0,
              generatedToken: generatedToken,
              refreshToken: refreshToken,
            },
            message: `otp verifed successfully`,
          });
      }
      const startIs = momentTz(
        moment(checkUser[0].generatedTime.join(" "), "DD/MM/YYYY H:mm:ss")
      ).tz("Asia/Kolkata");
      const endIs = momentTz(
        moment(checkUser[0].generatedTime.join(" "), "DD/MM/YYYY H:mm:ss").add(
          5,
          "minutes"
        )
      ).tz("Asia/Kolkata");
      const timeIs = momentTz().tz("Asia/Kolkata");
      const getOtp = await client.get(checkUser[0]._id.toString());
      // const startIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss');
      // const endIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes');
      // const timeIs = moment();
      console.log(startIs);
      if (getOtp != undefined) {
        //otp valid
        if (getOtp == otp) {
          const { generatedToken, refreshToken } = await generateAccessToken({
            _id: checkUser[0]._id,
            role: checkUser[0].role,
          });
          return res
            .status(200)
            .json({
              issuccess: true,
              data: {
                acknowledgement: true,
                status: 0,
                generatedToken: generatedToken,
                refreshToken: refreshToken,
              },
              message: `otp verifed successfully`,
            });
        } else {
          return res
            .status(401)
            .json({
              issuccess: false,
              data: { acknowledgement: false, status: 2 },
              message: `incorrect otp`,
            });
        }
        console.log("valid");
      } else {
        //otp expired
        return res
          .status(410)
          .json({
            issuccess: false,
            data: { acknowledgement: false, status: 1 },
            message: `otp expired`,
          });
      }
    } catch (error) {
      return res
        .status(500)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: error.message || "Having issue is server",
        });
    }
  }
);
router.put(
  "/updateWithOtp",
  authenticateToken,
  [
    oneOf(
      [body("id").isEmail(), body("id").isMobilePhone()],
      "please pass email or mobile no"
    ),
    body("otp").isNumeric().withMessage("please pass otp"),
    body("userId", "please pass userId")
      .optional()
      .custom((value) => mongoose.Types.ObjectId.isValid(value)),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { otp, id } = req.body;
      const userId = req.user._id;
      let checkUser = await riderSchema.aggregate([
        {
          $match: {
            _id: mongoose.Types.ObjectId(userId),
          },
        },
      ]);

      if (checkUser.length == 0) {
        return res
          .status(404)
          .json({
            issuccess: false,
            data: { acknowledgement: false, status: 3 },
            message: `No User Found `,
          });
      }
      if (otp == "000000") {
        let checkExist = await riderSchema.findOne({
          $and: [
            { _id: { $nin: [mongoose.Types.ObjectId(userId)] } },
            { $or: [{ mobileNo: id }, { email: id }] },
          ],
        });
        if (checkExist != undefined && checkExist != null) {
          return res
            .status(403)
            .json({
              issuccess: false,
              data: { acknowledgement: false, status: checkExist.email },
              message:
                checkExist.email == id
                  ? `email already in use`
                  : `mobile no already in use`,
            });
        }
        let updateData = {};
        if (validateEmail(id)) {
          updateData = {
            email: id,
          };
        } else if (validatePhoneNumber(id)) {
          updateData = {
            mobileNo: id,
          };
        }
        let updateRider = await riderSchema.findByIdAndUpdate(
          userId,
          updateData,
          { new: true }
        );
        updateRider._doc["id"] = updateRider._doc["_id"];
        delete updateRider._doc.__v;
        delete updateRider._doc._id;
        delete updateRider._doc.generatedTime;
        delete updateRider._doc.otp;
        return res
          .status(200)
          .json({
            issuccess: true,
            data: { acknowledgement: true, data: updateRider },
            message: `details updated`,
          });
      }
      const startIs = momentTz(
        moment(checkUser[0].generatedTime.join(" "), "DD/MM/YYYY H:mm:ss")
      ).tz("Asia/Kolkata");
      const endIs = momentTz(
        moment(checkUser[0].generatedTime.join(" "), "DD/MM/YYYY H:mm:ss").add(
          5,
          "minutes"
        )
      ).tz("Asia/Kolkata");
      const timeIs = momentTz().tz("Asia/Kolkata");
      const getOtp = await client.get(checkUser[0]._id.toString());
      // const startIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss');
      // const endIs = moment(checkUser[0].generatedTime.join(' '), 'DD/MM/YYYY H:mm:ss').add(1, 'minutes');
      // const timeIs = moment();
      console.log(startIs);
      if (getOtp != undefined) {
        //otp valid
        if (getOtp == otp) {
          let checkExist = await riderSchema.findOne({
            $and: [
              { _id: { $nin: [mongoose.Types.ObjectId(userId)] } },
              { $or: [{ mobileNo: id }, { email: id }] },
            ],
          });
          if (checkExist != undefined && checkExist != null) {
            return res
              .status(403)
              .json({
                issuccess: false,
                data: { acknowledgement: false, status: checkExist.email },
                message:
                  checkExist.email == id
                    ? `email already in use`
                    : `mobile no already in use`,
              });
          }
          let updateData = {};
          if (validateEmail(id)) {
            updateData = {
              email: id,
            };
          } else if (validatePhoneNumber(id)) {
            updateData = {
              mobileNo: id,
            };
          }
          let updateRider = await riderSchema.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
          );
          updateRider._doc["id"] = updateRider._doc["_id"];
          delete updateRider._doc.__v;
          delete updateRider._doc._id;
          delete updateRider._doc.generatedTime;
          delete updateRider._doc.otp;
          return res
            .status(200)
            .json({
              issuccess: true,
              data: { acknowledgement: true, data: updateRider },
              message: `details updated`,
            });
        } else {
          return res
            .status(401)
            .json({
              issuccess: false,
              data: { acknowledgement: false, status: 2 },
              message: `incorrect otp`,
            });
        }
        console.log("valid");
      } else {
        //otp expired
        return res
          .status(410)
          .json({
            issuccess: false,
            data: { acknowledgement: false, status: 1 },
            message: `otp expired`,
          });
      }
    } catch (error) {
      return res
        .status(500)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: error.message || "Having issue is server",
        });
    }
  }
);
router.get(
  "/getUsers",
  authenticateToken,
  checkUserRole(["superAdmin", "admin"]),
  async (req, res) => {
    try {
      const { userId } = req.body;
      let match;
      let anotherMatch = [];
      if ("name" in req.query) {
        let regEx = new RegExp(req.query.name, "i");
        anotherMatch.push({ name: { $regex: regEx } });
      }
      if ("role" in req.query) {
        anotherMatch.push({ role: req.query.role });
      }
      if ("activeStatus" in req.query) {
        anotherMatch.push({ activeStatus: parseInt(req.query.activeStatus) });
      }
      if ("jobStatus" in req.query) {
        anotherMatch.push({ jobStatus: req.query.jobStatus === "true" });
      }
      if (userId != undefined) {
        anotherMatch.push({
          _id: mongoose.Types.ObjectId(userId),
        });
      }
      console.log(anotherMatch);
      if (anotherMatch.length > 0) {
        match = {
          $match: {
            $and: anotherMatch,
          },
        };
      } else {
        match = {
          $match: {},
        };
      }
      let getUsers = await riderSchema.aggregate([
        match,
        {
          $addFields: {
            id: "$_id",
          },
        },
        {
          $project: {
            __v: 0,
            _id: 0,
            password: 0,
            otp: 0,
            generatedTime: 0,
          },
        },
        {
          $addFields: {
            country: "Usa",
            mobileNo: { $ifNull: ["$mobileNo", "Unspecified"] },
            email: { $ifNull: ["$email", "Unspecified"] },
          },
        },
        {
          $addFields: {
            createdAtDate: {
              $dateToString: {
                format: "%m-%d-%Y",
                date: "$createdAt",
                timezone: "-04:00",
              },
            },
            updatedAtDate: {
              $dateToString: {
                format: "%m-%d-%Y",
                date: "$updatedAt",
                timezone: "-04:00",
              },
            },
            createdAtTime: {
              $dateToString: {
                format: "%H:%M:%S",
                date: "$createdAt",
                timezone: "-04:00",
              },
            },
            updatedAtTime: {
              $dateToString: {
                format: "%H:%M:%S",
                date: "$updatedAt",
                timezone: "-04:00",
              },
            },
          },
        },
        {
          $addFields: {
            createdAt: { $concat: ["$createdAtDate", " ", "$createdAtTime"] },
            updatedAt: { $concat: ["$updatedAtDate", " ", "$updatedAtTime"] },
          },
        },
        {
          $project: {
            createdAtDate: 0,
            updatedAtDate: 0,
            createdAtTime: 0,
            updatedAtTime: 0,
          },
        },
      ]);
      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: getUsers },
          message: getUsers.length > 0 ? `admin users found` : "no user found",
        });
    } catch (error) {
      return res
        .status(500)
        .json({
          issuccess: false,
          data: { acknowledgement: false },
          message: error.message || "Having issue is server",
        });
    }
  }
);

router.get("/refresh", generateRefreshToken);

function validateEmail(emailAdress) {
  let regexEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  if (emailAdress.match(regexEmail)) {
    return true;
  } else {
    return false;
  }
}
function validatePhoneNumber(input_str) {
  var re = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{4})$/;

  return re.test(input_str);
}
function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
}
// async..await is not allowed in global scope, must use a wrapper

module.exports = router;

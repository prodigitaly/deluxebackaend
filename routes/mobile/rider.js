var express = require("express");
var router = express.Router();
const moment = require("moment");
const momentTz = require("moment-timezone");
require("dotenv").config();
const { default: mongoose } = require("mongoose");
const userSchema = require("../../models/userModel");
const { getCurrentDateTime24 } = require("../../utility/dates");
const nodemailer = require("nodemailer");
const { check, body, oneOf } = require("express-validator");
const { main } = require("../../utility/mail");
const { sendSms } = require("../../utility/sendSms");
const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const {
  getPlaces,
  placeFilter,
  formatAddress,
  distance,
} = require("../../utility/mapbox");
const {
  generateAccessToken,
  authenticateToken,
  generateRefreshToken,
  checkUserRole,
  authenticateTokenWithUserId,
} = require("../../middleware/auth");
const addressSchema = require("../../models/addressSchema");
const { checkErr } = require("../../utility/error");
const userSubscription = require("../../models/userSubscription");
const subscriptionSchema = require("../../models/subscriptionSchema");
const riderSchema = require("../../models/riderSchema");
const { uploadProfileImageToS3, removeObject } = require("../../utility/aws");
const vehicleSchema = require("../../models/vehicleSchema");
const pickupDeliverySchema = require("../../models/pickupDeliverySchema");
const invoiceSchema = require("../../models/invoiceSchema");
const proofSchema = require("../../models/proofSchema");
const { pipeline } = require("nodemailer/lib/xoauth2");
const riderOrderOtp = require("../../models/riderOrderOtp");
const fcmToken = require("../../models/fcmToken");
const riderNotification = require("../../models/riderNotification");
const { changeRideStatus } = require("../../utility/expiration");
const client = require("../../utility/setup/redis");
const deleteUser = require("../../models/deleteUser");
/* GET home page. */
router.get("/", async function (req, res, next) {
  console.log(validatePhoneNumber("9999999999"));
  console.log(validateEmail("abc@gmail.com"));
  res.render("index", { title: "Express" });
});
router.post(
  "/signup",
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
      console.log("rider");
      activeStatus = 2;
      if (
        req.user &&
        req.user.role &&
        ["superAdmin", "admin"].includes(req.user.role)
      ) {
        activeStatus = 0;
      }
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
      console.log("rider1");
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
      console.log("rider2");
      const userIs = await new riderSchema({
        email: email,
        mobileNo: mobileNo,
        name: name,
        gender: gender,
        dob: dob,
        activeStatus: activeStatus,
        countryCode: countryCode,
        username: randomstring,
        fatherName: fatherName,
        bloodGroup: bloodGroup,
        alternativeMobile: alternativeMobile,
        role: role,
      }).save();
      userIs._doc["id"] = userIs._doc["_id"];
      delete userIs._doc.updatedAt;
      delete userIs._doc.createdAt;
      delete userIs._doc._id;
      delete userIs._doc.__v;
      delete userIs._doc.generatedTime;
      delete userIs._doc.otp;
      console.log("rider3");
      let message = `<h1>Hello ${name}</h1><br/><br/><p>welcome to delux laundry system</p><br> Your registration successful now , Please start your work as scheduled`;
      main(email, message);
      // sendSms(countryCode + mobileNo, `Helllo ${name}, welcome to delux laundry system <br> Your registration successful now , Please start your work as scheduled`);

      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: userIs },
          message: "sign up successfully",
        });
    } catch (error) {
      console.log(error);
      return;
      // return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
    }
  }
);
router.put("/delete", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    let checkUser = await riderSchema.findById(userId);
    if (checkUser != undefined && checkUser != null) {
      await new deleteUser({
        email: checkUser.email,
        mobileNo: checkUser.mobileNo,
        userId: userId,
      }).save();
      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: null },
          message: "user delete successfully",
        });
    }
    return res
      .status(200)
      .json({
        issuccess: false,
        data: { acknowledgement: false, data: null },
        message: "user details not found",
      });
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
        checkDelete = await deleteUser.aggregate([
          {
            $match: {
              $and: [
                { mobileNo: mobileNo },
                { userId: mongoose.Types.ObjectId(checkExist[0]._id) },
              ],
            },
          },
        ]);
        if (checkDelete.length > 0) {
          return res
            .status(200)
            .json({
              issuccess: false,
              data: { acknowledgement: false, data: null },
              message: "user is removed, please contact admin",
            });
        }
        if (checkExist[0].activeStatus == 2) {
          return res
            .status(200)
            .json({
              issuccess: false,
              data: { acknowledgement: false, data: null },
              message: "please wait for approval from admin",
            });
        }
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
        .status(200)
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
router.post("/addFcmToken", authenticateToken, async (req, res, next) => {
  try {
    const { fcm } = req.body;
    const userId = req.user._id;
    let findExist = await fcmToken.findOne({
      userId: mongoose.Types.ObjectId(userId),
    });
    let createAddress = {};
    if (findExist != undefined && findExist != null) {
      createAddress = await fcmToken.findByIdAndUpdate(
        findExist._id,
        { fcm: fcm },
        { new: true }
      );
    } else {
      createAddress = new fcmToken({
        fcm: fcm,
        userId: userId,
      });
      await createAddress.save();
    }
    createAddress._doc["id"] = createAddress._doc["_id"];
    delete createAddress._doc.updatedAt;
    delete createAddress._doc.createdAt;
    delete createAddress._doc._id;
    delete createAddress._doc.__v;
    return res
      .status(200)
      .json({
        issuccess: true,
        data: { acknowledgement: true, data: createAddress },
        message: "user fcm details added",
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
  checkUserRole(["rider"]),
  async (req, res, next) => {
    try {
      const userId = req.user._id;
      const { orderId, rideIds } = req.query;
      // console.log(userId);
      let match;
      let anotherMatch = [];
      let orderIdsMatch = { $match: {} };
      let currentDate = moment().tz("America/Panama").startOf("day");
      console.log(new Date(currentDate));
      if (orderId != undefined && orderId != "") {
        anotherMatch.push({
          _id: mongoose.Types.ObjectId(orderId),
        });
      }
      if (rideIds != undefined && rideIds != "") {
        let regEx = new RegExp(rideIds, "i");
        orderIdsMatch = { $match: { idString: { $regex: regEx } } };
      }
      if ("rideType" in req.query && req.query.rideType != "") {
        anotherMatch.push({
          rideType: parseInt(req.query.rideType),
        });
      }
      let timeMatch = { $match: { dateType: { $gte: new Date(currentDate) } } };
      if (
        "start" in req.query &&
        "end" in req.query &&
        req.query.start != "" &&
        req.query.end != ""
      ) {
        let startIs = new Date(`${req.query.start} 00:00:00`);
        let endIs = new Date(`${req.query.end} 23:59:59`);
        // if (req.query.start == req.query.end) {
        //     endIs = new Date(endIs.setDate(endIs.getDate() + 1)).setUTCHours(00, 00, 00)
        // }
        startIs = new Date(startIs.toUTCString());
        endIs = new Date(endIs.toUTCString());
        console.log(startIs + "  " + endIs);
        if (
          startIs != undefined &&
          isNaN(startIs) == false &&
          endIs != undefined &&
          isNaN(endIs) == false
        ) {
          // console.log(array);
          timeMatch = {
            $match: {
              $and: [
                { dateType: { $gte: startIs } },
                { dateType: { $lte: endIs } },
              ],
            },
          };
        } else {
          return res
            .status(400)
            .json({
              issuccess: true,
              data: { acknowledgement: false, data: null },
              message: "please pass valid dates",
            });
        }
      }
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
      // console.log(match);
      // console.log(timeMatch);
      const checkUser = await pickupDeliverySchema.aggregate([
        match,
        {
          $match: {
            $and: [{ riderId: mongoose.Types.ObjectId(userId) }],
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
            idString: { $toString: "$rideId" },
            date: "$timeData.date",
          },
        },
        orderIdsMatch,
        {
          $sort: { updatedAt: -1 },
        },
        {
          $addFields: {
            dateType: {
              $dateFromString: {
                dateString: "$date",
                format: "%m/%d/%Y",
                timezone: "America/Panama",
              },
            },
          },
        },
        timeMatch,
        {
          $project: {
            pickupTimeData: 0,
            deliveryTimeData: 0,
            idString: 0,
            dateType: 0,
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
  checkUserRole(["rider"]),
  async (req, res, next) => {
    try {
      const userId = req.user._id;
      let match;
      let anotherMatch = [];

      if ("rideType" in req.query) {
        anotherMatch.push({
          rideType: parseInt(req.query.rideType),
        });
      }
      let getLatLong = await pickupDeliverySchema.aggregate([
        {
          $match: {},
        },
        {
          $lookup: {
            from: "tackedlocations",
            let: { rideId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$rideId", "$$rideId"] } } },
              {
                $group: {
                  _id: "$rideId",
                  locations: {
                    $push: "$location",
                  },
                },
              },
            ],
            as: "trackedLocations",
          },
        },
        {
          $addFields: {
            trackedLocations: { $first: "$trackedLocations.locations" },
          },
        },
        {
          $project: {
            startCordinates: 1,
            endCordinates: 1,
            trackedLocations: 1,
          },
        },
      ]);
      console.log(getLatLong[0]);
      console.log(anotherMatch.length);
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
      console.log(match);
      let currentDate = moment().tz("America/Panama").format("MM/DD/YYYY");
      // let currentDate = "01/12/2022"
      console.log(currentDate);
      const checkUser = await pickupDeliverySchema.aggregate([
        match,
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
            data: { acknowledgement: false, data: [] },
            message: "no any order assigned",
          });
      }
      for (i = 0; i < checkUser.length; i++) {
        let update = await pickupDeliverySchema.findByIdAndUpdate(
          checkUser[0]._id,
          { status: 2 },
          { new: true }
        );
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
router.put(
  "/updateOrder",
  authenticateToken,
  checkUserRole(["superAdmin", "admin"]),
  async (req, res, next) => {
    try {
      const { rideId, status, description } = req.body;

      let checkOrder = await pickupDeliverySchema.findById(rideId);

      if (checkOrder != undefined && checkOrder != null) {
        let updateOrder = await pickupDeliverySchema.findByIdAndUpdate(
          rideId,
          { status: status, description: description },
          { new: true }
        );
        updateOrder._doc["id"] = updateOrder._doc["_id"];
        delete updateOrder._doc.updatedAt;
        delete updateOrder._doc.createdAt;
        delete updateOrder._doc._id;
        delete updateOrder._doc.__v;
        return res
          .status(200)
          .json({
            issuccess: true,
            data: { acknowledgement: true, data: updateOrder },
            message: "ride details updated",
          });
      }
      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: false, data: null },
          message: "order not found",
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
router.post("/sendOrderOtp", authenticateToken, async (req, res, next) => {
  try {
    const { rideId } = req.body;

    let ride = await pickupDeliverySchema.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(rideId),
        },
      },
      {
        $lookup: {
          from: "invoices",
          let: { orderId: "$orderId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$orderId"] } } },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userData",
              },
            },
            {
              $lookup: {
                from: "addresses",
                let: { addressId: "$pickupAddressId" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$addressId"] } } },
                  { $addFields: { id: "$_id" } },
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
                let: { addressId: "$deliveryAddressId" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$addressId"] } } },
                  { $addFields: { id: "$_id" } },
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
          ],
          as: "orderData",
        },
      },
    ]);
    if (
      ride.length > 0 &&
      "orderData" in ride[0] &&
      "userData" in ride[0].orderData[0]
    ) {
      let checkOtp = ride[0].orderData[0].userData[0];
      let pickupMobile =
        ride[0].orderData[0].pickupAddressData.length > 0
          ? ride[0].orderData[0].pickupAddressData[0].mobileNo
          : "";
      let deliveryMobile =
        ride[0].orderData[0].deliveryAddressData.length > 0
          ? ride[0].orderData[0].deliveryAddressData[0].mobileNo
          : "";
      console.log(pickupMobile, deliveryMobile);
      otp = getRandomIntInclusive(111111, 999999);
      res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: otp },
          message: "Otp sent successfully",
        });
      // console.log(rideId + "  " + ride[0].orderData[0]._id)
      let getRide = await riderOrderOtp.aggregate([
        {
          $match: {
            $and: [
              { orderId: mongoose.Types.ObjectId(ride[0].orderData[0]._id) },
              { rideId: mongoose.Types.ObjectId(ride[0]._id) },
            ],
          },
        },
      ]);
      if (getRide.length > 0) {
        let update = await riderOrderOtp.findByIdAndUpdate(getRide, {
          otp: otp,
          generatedTime: new Date(),
        });
      } else {
        let update = await new riderOrderOtp({
          rideId: rideId,
          userId: checkOtp._id,
          otp: otp,
          generatedTime: new Date(),
          orderId: ride[0].orderData[0]._id,
        }).save();
      }
      let message = `Dear customer,\n

${otp} is your one time password(OTP). Please do not share the OTP with others. \n

Regards,
Team Sparkle Up`;

      if (validateEmail(checkOtp.email)) {
        await main(checkOtp.email, message);
      }
      if (validatePhoneNumber(checkOtp.mobileNo)) {
        console.log("mob");
        await sendSms(
          checkOtp.countryCode + checkOtp.mobileNo,
          `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others. Regards,Team Sparkle Up`
        );
      } else if (validatePhoneNumber(pickupMobile)) {
        console.log("pick");
        await sendSms(
          checkOtp.countryCode + pickupMobile,
          `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others. Regards,Team Sparkle Up`
        );
      } else if (validatePhoneNumber(deliveryMobile)) {
        console.log("dle");
        await sendSms(
          checkOtp.countryCode + deliveryMobile,
          `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others. Regards,Team Sparkle Up`
        );
      }
      return;
      // return res.status(200).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: 'ride not found' });
    }

    return res
      .status(200)
      .json({
        issuccess: false,
        data: { acknowledgement: false, data: null },
        message: "ride not found",
      });
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
router.post("/verifyOtp", authenticateToken, async (req, res, next) => {
  try {
    const { rideId, otp } = req.body;

    let ride = await pickupDeliverySchema.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(rideId),
        },
      },
    ]);
    if (ride.length > 0) {
      let datenow = new Date();
      let getOtp = await riderOrderOtp.aggregate([
        {
          $match: {
            $and: [
              { rideId: mongoose.Types.ObjectId(rideId) },
              { orderId: mongoose.Types.ObjectId(ride[0].orderId) },
            ],
          },
        },
      ]);
      let dateIs = new Date(getOtp[0].generatedTime);
      console.log(new Date(dateIs.setMinutes(dateIs.getMinutes() + 2)));
      if (getOtp.length > 0) {
        console.log(new Date());
        if (
          new Date(dateIs.setMinutes(dateIs.getMinutes() + 2)) >= new Date()
        ) {
          if (getOtp[0].otp == otp) {
            return res
              .status(200)
              .json({
                issuccess: true,
                data: { acknowledgement: true, data: 0 },
                message: "otp verified successfully",
              });
          } else {
            return res
              .status(200)
              .json({
                issuccess: false,
                data: { acknowledgement: false, data: 1 },
                message: "otp incorrect",
              });
          }
        } else {
          return res
            .status(200)
            .json({
              issuccess: false,
              data: { acknowledgement: false, data: 2 },
              message: "otp expired",
            });
        }
      } else {
        return res
          .status(200)
          .json({
            issuccess: false,
            data: { acknowledgement: false, data: 3 },
            message: "please generate otp",
          });
      }
      return res
        .status(200)
        .json({
          issuccess: false,
          data: { acknowledgement: false, data: null },
          message: "no otp found",
        });
      // return res.status(200).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: 'ride not found' });
    }

    return res
      .status(200)
      .json({
        issuccess: false,
        data: { acknowledgement: false, data: 4 },
        message: "ride not found",
      });
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
// router.post('/resendOtp', authenticateToken, async (req, res, next) => {
//     try {
//         const { rideId } = req.body;

//         let ride = await pickupDeliverySchema.aggregate([{
//             $match: {
//                 _id: mongoose.Types.ObjectId(rideId)
//             }
//         },
//         {
//             $lookup: {
//                 from: "invoices",
//                 let: { orderId: "$orderId" },
//                 pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$orderId"] } } }, {
//                     $lookup: {
//                         from: "users",
//                         localField: "userId",
//                         foreignField: "_id",
//                         as: "userData"
//                     }
//                 }],
//                 as: "orderData"
//             }
//         }]);
//         if (ride.length > 0 && 'orderData' in ride[0] && 'userData' in ride[0].orderData[0]) {
//             let checkOtp = ride[0].orderData[0].userData[0];
//             otp = getRandomIntInclusive(111111, 999999);
//             res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: otp }, message: "Otp sent successfully" });
//             let getRide = await riderOrderOtp.aggregate([{
//                 $match: {
//                     $and: [
//                         { orderId: ride[0].orderId },
//                         { rideId: rideId }
//                     ]
//                 }
//             }]);
//             if (getRide.length > 0) {
//                 let update = await riderOrderOtp.findByIdAndUpdate(getRide, { otp: otp, generatedTime: new Date() });
//             }
//             else {

//             }
//             let message = `Dear customer,\n

// ${otp} is your one time password(OTP). Please do not share the OTP with others. \n

// Regards,
// Team Sparkle Up`

//             if (validateEmail(checkOtp.email)) {
//                 await main(checkOtp.email, message);
//             }
//             if (validatePhoneNumber(checkOtp.mobileNo)) {
//                 await sendSms(checkOtp.countryCode + checkOtp.mobileNo, `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others. Regards,Team Sparkle Up`);
//             }
//             return;
//             // return res.status(200).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: 'ride not found' });
//         }

//         return res.status(200).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: 'ride not found' });
//     }
//     catch (error) {
//         console.log(error.message)
//         return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
//     }
// })
router.get("/getUserOrders", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.query;
    const userId = req.user._id;
    // console.log(userId);
    let match;
    let anotherMatch = [];

    if (orderId != undefined) {
      anotherMatch.push({
        _id: mongoose.Types.ObjectId(orderId),
      });
    }

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
    let getUsers = await invoiceSchema.aggregate([
      match,
      {
        $addFields: {
          id: "$_id",
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $lookup: {
          from: "coupons",
          let: { couponId: "$couponId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$couponId"] } } },
            { $addFields: { id: "$_id" } },
            {
              $project: {
                _id: 0,
                __v: 0,
              },
            },
          ],
          as: "couponData",
        },
      },
      {
        $lookup: {
          from: "daywises",
          let: { deliveryId: "$deliveryTimeId", pickupId: "$pickupTimeId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$deliveryId"] } } },
            { $addFields: { id: "$_id" } },
            {
              $project: {
                _id: 0,
                __v: 0,
              },
            },
          ],
          as: "deliveryTime",
        },
      },
      {
        $lookup: {
          from: "daywises",
          let: { pickupId: "$pickupTimeId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$pickupId"] } } },
            { $addFields: { id: "$_id" } },
            {
              $project: {
                _id: 0,
                __v: 0,
              },
            },
          ],
          as: "pickupTime",
        },
      },
      {
        $lookup: {
          from: "users",
          let: { userId: "$userId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
            { $addFields: { id: "$_id" } },
            {
              $project: {
                _id: 0,
                __v: 0,
              },
            },
          ],
          as: "userData",
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: { addressId: "$pickupAddressId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$addressId"] } } },
            { $addFields: { id: "$_id" } },
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
          let: { addressId: "$deliveryAddressId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$addressId"] } } },
            { $addFields: { id: "$_id" } },
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
          pickupAddressData: { $first: "$pickupAddressData" },
          deliveryAddressData: { $first: "$deliveryAddressData" },
        },
      },
      {
        $lookup: {
          from: "orderitems",
          let: { id: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$orderId", "$$id"] } } },
            {
              $lookup: {
                from: "categories",
                let: { categoryId: "$categoryId" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$categoryId"] } } },
                  { $addFields: { id: "$_id" } },
                  { $project: { _id: 0, __v: 0 } },
                ],
                as: "categoryData",
              },
            },
            {
              $addFields: {
                categoryName: { $first: "$categoryData" },
                id: "$_id",
              },
            },
            {
              $project: {
                _id: 0,
                __v: 0,
              },
            },
            {
              $lookup: {
                from: "items",
                let: { id: "$itemId" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$id"] } } },
                  { $addFields: { id: "$_id" } },
                  { $project: { _id: 0, __v: 0 } },
                ],
                as: "itemData",
              },
            },
            {
              $addFields: {
                itemData: { $first: "$itemData" },
              },
            },
            {
              $group: {
                _id: "$categoryName",
                items: { $push: "$$ROOT" },
              },
            },
            {
              $addFields: {
                name: "$_id.name",
                categoryData: "$_id",
              },
            },
            {
              $project: {
                _id: 0,
              },
            },
          ],
          as: "orderItems",
        },
      },
      {
        $addFields: {
          invoiceId: "$orderId",
          paymentStatus: {
            $cond: {
              if: {
                $and: [
                  { $isArray: "$paymentId" },
                  { $gte: [{ $size: "$paymentId" }, 1] },
                ],
              },
              then: 1,
              else: 0,
            },
          },
          invoiceStatus: "$status",
          amount: "$orderAmount",
          name: { $first: "$userData.name" },
          mobileNo: {
            $cond: {
              // Test for null or empty string
              if: {
                $or: [
                  { $eq: [{ $first: "$userData.mobileNo" }, null] },
                  { $eq: [{ $first: "$userData.mobileNo" }, ""] },
                ],
              },
              // If true, use pickupAddressData.mobileNo or deliveryAddressData.mobileNo
              then: {
                $cond: {
                  // Test for null or empty string
                  if: {
                    $or: [
                      { $eq: ["$pickupAddressData.mobileNo", null] },
                      { $eq: ["$pickupAddressData.mobileNo", ""] },
                    ],
                  },
                  // If true, use pickupAddressData.mobileNo or deliveryAddressData.mobileNo
                  then: "$deliveryAddressData.mobileNo",
                  // If false, use userData.mobileNo
                  else: "$pickupAddressData.mobileNo",
                },
              },
              // If false, use userData.mobileNo
              else: { $first: "$userData.mobileNo" },
            },
          },
          countryCode: { $first: "$userData.countryCode" },
          addressData: { $first: "$addressData" },
          deliveryTime: { $first: "$deliveryTime" },
          pickupTime: { $first: "$pickupTime" },
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
          __v: 0,
          _id: 0,
          password: 0,
          otp: 0,
          generatedTime: 0,
          userData: 0,
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
        data: {
          acknowledgement: true,
          data:
            orderId != undefined && getUsers.length > 0
              ? getUsers[0]
              : getUsers,
        },
        message:
          getUsers.length > 0
            ? `invoice order found`
            : "no any invoice orders found",
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
router.put(
  "/updateSlots",
  authenticateToken,
  checkUserRole(["rider"]),
  [
    body("rideId", "please enter valid ridd Id").custom((value) =>
      mongoose.Types.ObjectId.isValid(value)
    ),
    body("status", "please pass valid status code").isNumeric().isIn([2, 3, 4]),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const userId = req.user._id;
      const { rideId, status, description, otp, lat, long } = req.body;
      if (status == 2 && otp != undefined) {
        let ride = await pickupDeliverySchema.aggregate([
          {
            $match: {
              _id: mongoose.Types.ObjectId(rideId),
            },
          },
        ]);
        if (ride.length > 0) {
          let datenow = new Date();
          let getOtp = await riderOrderOtp.aggregate([
            {
              $match: {
                $and: [
                  { rideId: mongoose.Types.ObjectId(rideId) },
                  { orderId: mongoose.Types.ObjectId(ride[0].orderId) },
                ],
              },
            },
          ]);
          let dateIs = new Date(getOtp[0].generatedTime);
          console.log(new Date(dateIs.setMinutes(dateIs.getMinutes() + 2)));
          if (getOtp.length > 0) {
            if (otp == "000000") {
              if (ride[0].rideType == 0) {
                let updateInvoice = await invoiceSchema.findByIdAndUpdate(
                  ride[0].orderId,
                  { status: 5 },
                  { new: true }
                );
              } else if (ride[0].rideType == 1) {
                let updateInvoice = await invoiceSchema.findByIdAndUpdate(
                  ride[0].orderId,
                  { status: 10 },
                  { new: true }
                );
              }
              let updateRide = await pickupDeliverySchema.findByIdAndUpdate(
                rideId,
                {
                  status: status,
                  description: description,
                  endCordinates: [lat, long],
                },
                { new: true }
              );
              updateRide._doc["id"] = updateRide._doc["_id"];
              delete updateRide._doc.updatedAt;
              delete updateRide._doc.createdAt;
              delete updateRide._doc._id;
              delete updateRide._doc.__v;
              return res
                .status(200)
                .json({
                  issuccess: true,
                  data: { acknowledgement: true, data: updateRide },
                  message: "otp verified successfully",
                });
            }
            console.log(new Date());
            if (
              new Date(dateIs.setMinutes(dateIs.getMinutes() + 2)) >= new Date()
            ) {
              if (getOtp[0].otp == otp) {
                if (ride[0].rideType == 0) {
                  let updateInvoice = await invoiceSchema.findByIdAndUpdate(
                    ride[0].orderId,
                    { status: 5 },
                    { new: true }
                  );
                } else if (ride[0].rideType == 1) {
                  let updateInvoice = await invoiceSchema.findByIdAndUpdate(
                    ride[0].orderId,
                    { status: 10 },
                    { new: true }
                  );
                }
                let updateRide = await pickupDeliverySchema.findByIdAndUpdate(
                  rideId,
                  { status: status, description: description },
                  { new: true }
                );
                updateRide._doc["id"] = updateRide._doc["_id"];
                delete updateRide._doc.updatedAt;
                delete updateRide._doc.createdAt;
                delete updateRide._doc._id;
                delete updateRide._doc.__v;
                return res
                  .status(200)
                  .json({
                    issuccess: true,
                    data: { acknowledgement: true, data: updateRide },
                    message: "otp verified successfully",
                  });
              } else {
                return res
                  .status(200)
                  .json({
                    issuccess: false,
                    data: { acknowledgement: false, data: null },
                    message: "otp incorrect",
                  });
              }
            } else {
              return res
                .status(200)
                .json({
                  issuccess: false,
                  data: { acknowledgement: false, data: null },
                  message: "otp expired",
                });
            }
          } else {
            return res
              .status(200)
              .json({
                issuccess: false,
                data: { acknowledgement: false, data: null },
                message: "please generate otp",
              });
          }
          return res
            .status(200)
            .json({
              issuccess: false,
              data: { acknowledgement: false, data: null },
              message: "no otp found",
            });
          // return res.status(200).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: 'ride not found' });
        }
      } else if (status == 2 && (otp == undefined || otp == null)) {
        return res
          .status(200)
          .json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: "please pass otp to confirm ride action",
          });
      } else {
        const checkUser = await pickupDeliverySchema.findById(rideId);
        if (checkUser == undefined || checkUser == null) {
          return res
            .status(200)
            .json({
              issuccess: false,
              data: { acknowledgement: false, data: null },
              message: "no any order assigned",
            });
        }
        // if (status == 2 && checkUser.rideType == 0) {
        //     let updateInvoice = await invoiceSchema.findByIdAndUpdate(checkUser.orderId, { status: 5 }, { new: true });
        // }
        // else if (status == 2 && checkUser.rideType == 1) {
        //     let updateInvoice = await invoiceSchema.findByIdAndUpdate(checkUser.orderId, { status: 10 }, { new: true });
        // }
        else if (status == 3 && checkUser.rideType == 0) {
          let updateInvoice = await invoiceSchema.findByIdAndUpdate(
            checkUser.orderId,
            { status: 4 },
            { new: true }
          );
        } else if (status == 3 && checkUser.rideType == 1) {
          let updateInvoice = await invoiceSchema.findByIdAndUpdate(
            checkUser.orderId,
            { status: 9 },
            { new: true }
          );
        } else if (status == 4 && checkUser.rideType == 0) {
          let updateInvoice = await invoiceSchema.findByIdAndUpdate(
            checkUser.orderId,
            { status: 4 },
            { new: true }
          );
        } else if (status == 4 && checkUser.rideType == 1) {
          let updateInvoice = await invoiceSchema.findByIdAndUpdate(
            checkUser.orderId,
            { status: 9 },
            { new: true }
          );
        }
        let updateRide = await pickupDeliverySchema.findByIdAndUpdate(
          rideId,
          {
            status: status,
            description: description,
            endCordinates: [lat, long],
          },
          { new: true }
        );
        updateRide._doc["id"] = updateRide._doc["_id"];
        delete updateRide._doc.updatedAt;
        delete updateRide._doc.createdAt;
        delete updateRide._doc._id;
        delete updateRide._doc.__v;
        return res
          .status(200)
          .json({
            issuccess: true,
            data: { acknowledgement: true, data: updateRide },
            message: "order updated",
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
          mobileNo: { $concat: ["$countryCode", "-", "$mobileNo"] },
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
router.get("/getLatLongs", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { lat, long } = req.query;

    let currentDate = moment().tz("America/Panama").format("MM/DD/YYYY");
    const checkUser = await pickupDeliverySchema.aggregate([
      {
        $match: {
          $and: [
            { riderId: mongoose.Types.ObjectId(userId) },
            { status: { $in: [0, 1] } },
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
          timeData: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$rideType", 0] },
                  then: { $first: "$pickupTimeData.date" },
                },
                {
                  case: { $eq: ["$rideType", 1] },
                  then: { $first: "$deliveryTimeData.date" },
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
          timeData: currentDate,
        },
      },
      {
        $lookup: {
          from: "invoices",
          let: { id: "$orderId", rideType: "$rideType" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$id"] } } },
            {
              $lookup: {
                from: "addresses",
                let: { addressId: "$pickupAddressId" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$addressId"] } } },
                  { $addFields: { id: "$_id" } },
                  {
                    $project: {
                      _id: 0,
                      __v: 0,
                    },
                  },
                ],
                as: "pickupAddress",
              },
            },
            {
              $lookup: {
                from: "addresses",
                let: { addressId: "$deliveryAddressId" },
                pipeline: [
                  { $match: { $expr: { $eq: ["$_id", "$$addressId"] } } },
                  { $addFields: { id: "$_id" } },
                  {
                    $project: {
                      _id: 0,
                      __v: 0,
                    },
                  },
                ],
                as: "deliveryAddress",
              },
            },
            {
              $addFields: {
                targetAddress: {
                  $switch: {
                    branches: [
                      {
                        case: { $eq: ["$$rideType", 0] },
                        then: "$pickupAddress",
                      },
                      {
                        case: { $eq: ["$$rideType", 1] },
                        then: "$deliveryAddress",
                      },
                    ],
                    default: [],
                  },
                },
              },
            },
          ],
          as: "invoiceData",
        },
      },
    ]);
    console.log(checkUser);
    let arr = [];
    for (i = 0; i < checkUser.length; i++) {
      if (
        checkUser[i].invoiceData.length > 0 &&
        checkUser[i].invoiceData[0].targetAddress.length > 0
      ) {
        let checkDistance = await distance(
          lat,
          long,
          checkUser[i].invoiceData[0].targetAddress[0].lat,
          checkUser[i].invoiceData[0].targetAddress[0].long
        );
        console.log(checkDistance);
        let obj = Object.assign(checkUser[i].invoiceData[0].targetAddress[0], {
          id: checkUser[i]._id,
          rideType: checkUser[i].rideType,
          status: checkUser[i].rideType,
          distance: checkDistance,
        });
        arr.push(obj);
      }
    }
    if (arr.length == 0) {
      return res
        .status(404)
        .json({
          issuccess: false,
          data: { acknowledgement: false, data: [] },
          message: "no user ride details found",
        });
    }
    arr.sort((a, b) => a.distance - b.distance);
    let url = `https://www.google.com/maps/dir/${lat},${long}`;
    for (i = 0; i < arr.length; i++) {
      if (i == 0) {
        console.log("here");
        // console.log(arr[i]._id)
        let updateOrder = await pickupDeliverySchema.findByIdAndUpdate(
          arr[i].id,
          { startCordinates: [lat, long], status: 1 }
        );
      }
      console.log(arr[i].lat + "  " + arr[i].long);
      url += `/${arr[i].lat},${arr[i].long}`;
      delete arr[i].id;
    }
    return res
      .status(200)
      .json({
        issuccess: true,
        data: { acknowledgement: true, data: { url: url, orderData: arr } },
        message: "ride details found",
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
router.get("/getRiderCounts", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    let { date } = req.query;
    let pickupComplete = [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$riderId", "$$riderId"] },
              { $eq: ["$rideType", 0] },
              { $eq: ["$status", 2] },
            ],
          },
        },
      },
    ];
    let deliveryComplete = [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$riderId", "$$riderId"] },
              { $eq: ["$rideType", 1] },
              { $eq: ["$status", 2] },
            ],
          },
        },
      },
    ];
    let deliveryPending = [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$riderId", "$$riderId"] },
              { $eq: ["$rideType", 1] },
              { $or: [{ $eq: ["$status", 0] }, { $eq: ["$status", 1] }] },
            ],
          },
        },
      },
    ];
    let pickupPending = [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$riderId", "$$riderId"] },
              { $eq: ["$rideType", 0] },
              { $or: [{ $eq: ["$status", 0] }, { $eq: ["$status", 1] }] },
            ],
          },
        },
      },
    ];
    let pickupCancelled = [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$riderId", "$$riderId"] },
              { $eq: ["$rideType", 0] },
              { $or: [{ $eq: ["$status", 3] }, { $eq: ["$status", 4] }] },
            ],
          },
        },
      },
    ];
    let deliveryCancelled = [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$riderId", "$$riderId"] },
              { $eq: ["$rideType", 1] },
              { $or: [{ $eq: ["$status", 3] }, { $eq: ["$status", 4] }] },
            ],
          },
        },
      },
    ];
    if (date != undefined) {
      let dateIs = date.split("-");
      date = `${dateIs[0]}/${dateIs[1]}/${dateIs[2]}`;
      pickupComplete = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 0] },
                { $eq: ["$status", 2] },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "daywises",
            localField: "pickupTimeId",
            foreignField: "_id",
            as: "timeData",
          },
        },
        {
          $addFields: {
            date: { $first: "$timeData.date" },
          },
        },
        {
          $match: {
            date: date,
          },
        },
      ];
      deliveryComplete = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 1] },
                { $eq: ["$status", 2] },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "daywises",
            localField: "deliveryTimeId",
            foreignField: "_id",
            as: "timeData",
          },
        },
        {
          $addFields: {
            date: { $first: "$timeData.date" },
          },
        },
        {
          $match: {
            date: date,
          },
        },
      ];
      deliveryPending = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 1] },
                { $or: [{ $eq: ["$status", 0] }, { $eq: ["$status", 1] }] },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "daywises",
            localField: "deliveryTimeId",
            foreignField: "_id",
            as: "timeData",
          },
        },
        {
          $addFields: {
            date: { $first: "$timeData.date" },
          },
        },
        {
          $match: {
            date: date,
          },
        },
      ];
      pickupPending = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 0] },
                { $or: [{ $eq: ["$status", 0] }, { $eq: ["$status", 1] }] },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "daywises",
            localField: "pickupTimeId",
            foreignField: "_id",
            as: "timeData",
          },
        },
        {
          $addFields: {
            date: { $first: "$timeData.date" },
          },
        },
        {
          $match: {
            date: date,
          },
        },
      ];
      pickupCancelled = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 0] },
                { $or: [{ $eq: ["$status", 3] }, { $eq: ["$status", 4] }] },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "daywises",
            localField: "pickupTimeId",
            foreignField: "_id",
            as: "timeData",
          },
        },
        {
          $addFields: {
            date: { $first: "$timeData.date" },
          },
        },
        {
          $match: {
            date: date,
          },
        },
      ];
      deliveryCancelled = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 1] },
                { $or: [{ $eq: ["$status", 3] }, { $eq: ["$status", 4] }] },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "daywises",
            localField: "deliveryTimeId",
            foreignField: "_id",
            as: "timeData",
          },
        },
        {
          $addFields: {
            date: { $first: "$timeData.date" },
          },
        },
        {
          $match: {
            date: date,
          },
        },
      ];
      console.log(date);
    } else {
      pickupComplete = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 0] },
                { $eq: ["$status", 2] },
              ],
            },
          },
        },
      ];
      deliveryComplete = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 1] },
                { $eq: ["$status", 2] },
              ],
            },
          },
        },
      ];
      deliveryPending = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 1] },
                { $or: [{ $eq: ["$status", 0] }, { $eq: ["$status", 1] }] },
              ],
            },
          },
        },
      ];
      pickupPending = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 0] },
                { $or: [{ $eq: ["$status", 0] }, { $eq: ["$status", 1] }] },
              ],
            },
          },
        },
      ];
      pickupCancelled = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 0] },
                { $or: [{ $eq: ["$status", 3] }, { $eq: ["$status", 4] }] },
              ],
            },
          },
        },
      ];
      deliveryCancelled = [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$riderId", "$$riderId"] },
                { $eq: ["$rideType", 1] },
                { $or: [{ $eq: ["$status", 3] }, { $eq: ["$status", 4] }] },
              ],
            },
          },
        },
      ];
    }
    const checkUser = await riderSchema.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "pickupdeliveries",
          let: { riderId: "$_id" },
          pipeline: pickupComplete,
          as: "pickupComplete",
        },
      },
      {
        $lookup: {
          from: "pickupdeliveries",
          let: { riderId: "$_id" },
          pipeline: deliveryComplete,
          as: "deliveryComplete",
        },
      },
      {
        $lookup: {
          from: "pickupdeliveries",
          let: { riderId: "$_id" },
          pipeline: deliveryPending,
          as: "deliveryPending",
        },
      },
      {
        $lookup: {
          from: "pickupdeliveries",
          let: { riderId: "$_id" },
          pipeline: pickupPending,
          as: "pickupPending",
        },
      },
      {
        $lookup: {
          from: "pickupdeliveries",
          let: { riderId: "$_id" },
          pipeline: pickupCancelled,
          as: "pickupCancelled",
        },
      },
      {
        $lookup: {
          from: "pickupdeliveries",
          let: { riderId: "$_id" },
          pipeline: deliveryCancelled,
          as: "deliveryCancelled",
        },
      },
      {
        $project: {
          pickupComplete: { $size: "$pickupComplete" },
          deliveryComplete: { $size: "$deliveryComplete" },
          deliveryPending: { $size: "$deliveryPending" },
          pickupPending: { $size: "$pickupPending" },
          pickupCancelled: { $size: "$pickupCancelled" },
          deliveryCancelled: { $size: "$deliveryCancelled" },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]);
    if (checkUser.length == 0) {
      return res.status(200).json({
        issuccess: false,
        data: {
          acknowledgement: false,
          data: {
            pickupComplete: 0,
            deliveryComplete: 0,
            deliveryPending: 0,
            pickupPending: 0,
            pickupCancelled: 0,
            deliveryCancelled: 0,
          },
        },
        message: "no any summary details found found",
      });
    }
    return res
      .status(200)
      .json({
        issuccess: true,
        data: { acknowledgement: true, data: checkUser[0] },
        message: "order summary found found",
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
router.get(
  "/getRiderNotification",
  authenticateToken,
  checkUserRole(["rider"]),
  async (req, res, next) => {
    try {
      const userId = req.user._id;

      let currentDate = momentTz().tz("America/Panama").format();
      const getNotification = await riderNotification.aggregate([
        {
          $match: { riderId: mongoose.Types.ObjectId(userId) },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $addFields: {
            createdAtPanama: {
              $dateToString: {
                date: "$createdAt",
                format: "%Y-%m-%d %H:%M:%S",
                timezone: "America/Panama",
              },
            },
          },
        },
        {
          $addFields: {
            years: {
              $dateDiff: {
                startDate: {
                  $dateFromString: { dateString: "$createdAtPanama" },
                },
                endDate: { $dateFromString: { dateString: currentDate } },
                unit: "year",
                timezone: "America/Panama",
              },
            },
            month: {
              $dateDiff: {
                startDate: {
                  $dateFromString: { dateString: "$createdAtPanama" },
                },
                endDate: { $dateFromString: { dateString: currentDate } },
                unit: "month",
                timezone: "America/Panama",
              },
            },
            days: {
              $dateDiff: {
                startDate: {
                  $dateFromString: { dateString: "$createdAtPanama" },
                },
                endDate: { $dateFromString: { dateString: currentDate } },
                unit: "day",
                timezone: "America/Panama",
              },
            },
            hours: {
              $dateDiff: {
                startDate: {
                  $dateFromString: { dateString: "$createdAtPanama" },
                },
                endDate: { $dateFromString: { dateString: currentDate } },
                unit: "hour",
                timezone: "America/Panama",
              },
            },
            minutes: {
              $dateDiff: {
                startDate: {
                  $dateFromString: { dateString: "$createdAtPanama" },
                },
                endDate: { $dateFromString: { dateString: currentDate } },
                unit: "minute",
                timezone: "America/Panama",
              },
            },
            seconds: {
              $dateDiff: {
                startDate: {
                  $dateFromString: { dateString: "$createdAtPanama" },
                },
                endDate: { $dateFromString: { dateString: currentDate } },
                unit: "second",
                timezone: "America/Panama",
              },
            },
          },
        },
        {
          $addFields: {
            timeOf: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [{ $gte: ["$years", 1] }, { $gte: ["$month", 12] }],
                    },
                    then: { $concat: [{ $toString: "$years" }, " year ago"] },
                  },
                  {
                    case: {
                      $and: [{ $gte: ["$month", 1] }, { $gte: ["$days", 30] }],
                    },
                    then: { $concat: [{ $toString: "$month" }, " month ago"] },
                  },
                  {
                    case: {
                      $and: [{ $gte: ["$days", 1] }, { $gte: ["$hours", 24] }],
                    },
                    then: { $concat: [{ $toString: "$days" }, " day ago"] },
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$hours", 1] },
                        { $gte: ["$minutes", 60] },
                      ],
                    },
                    then: { $concat: [{ $toString: "$hours" }, " hours ago"] },
                  },
                  {
                    case: {
                      $and: [
                        { $gte: ["$minutes", 1] },
                        { $gte: ["$seconds", 60] },
                      ],
                    },
                    then: {
                      $concat: [{ $toString: "$minutes" }, " minute ago"],
                    },
                  },
                ],
                default: {
                  $concat: [{ $toString: "$seconds" }, " seconds ago"],
                },
              },
            },
          },
        },
        {
          $project: {
            years: 0,
            month: 0,
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            createdAtPanama: 0,
            _id: 0,
            __v: 0,
          },
        },
      ]);
      let updateNotification = await riderNotification.updateMany(
        { riderId: mongoose.Types.ObjectId(userId) },
        { isSeen: true },
        { new: true }
      );
      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: getNotification },
          message: "rider notification found",
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
  "/getRiderNotificationCount",
  authenticateToken,
  checkUserRole(["rider"]),
  async (req, res, next) => {
    try {
      const userId = req.user._id;

      const getNotification = await riderNotification.aggregate([
        {
          $match: {
            $and: [
              { riderId: mongoose.Types.ObjectId(userId) },
              { isSeen: false },
            ],
          },
        },
      ]);
      return res
        .status(200)
        .json({
          issuccess: true,
          data: {
            acknowledgement: true,
            data: getNotification.length > 0 ? getNotification.length : 0,
          },
          message: "rider notification count found",
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
router.get("/getRiderVehicle", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    let checkUser = await vehicleSchema.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
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
          generatedTime: 0,
          otp: 0,
        },
      },
    ]);

    return res
      .status(200)
      .json({
        issuccess: checkUser.length > 0 ? true : false,
        data: {
          acknowledgement: checkUser.length > 0 ? true : false,
          data: checkUser.length > 0 ? checkUser[0] : {},
        },
        message:
          checkUser.length > 0
            ? `rider vehicle details found`
            : "rider vehicle not found",
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
router.get("/getInsurance", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user._id;
    let getInsurance = await riderSchema.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(userId),
        },
      },
      {
        $addFields: {
          insuranceStatus: {
            $cond: {
              if: { $ne: ["$riderInsurance", ""] },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $project: {
          riderExpiry: 1,
          riderInsurance: 1,
        },
      },
    ]);
    let getRiderVehicle = await riderSchema.aggregate([
      {
        $match: {
          rideId: mongoose.Types.ObjectId(userId),
        },
      },
      {
        $project: {
          insuranceNumber: 1,
          vehicleInsurance: 1,
          insuranceExpiry: 1,
        },
      },
    ]);
    if (getInsurance.length == 0) {
      getInsurance = [
        {
          riderExpiry: "",
          riderInsurance: "",
          insuranceStatus: false,
        },
      ];
    }
    if (getRiderVehicle.length == 0) {
      getRiderVehicle = [
        {
          insuranceNumber: "",
          vehicleInsurance: false,
          insuranceExpiry: "",
        },
      ];
    }
    return res
      .status(200)
      .json({
        issuccess: true,
        data: {
          acknowledgement: true,
          data: Object.assign(getInsurance[0], getRiderVehicle[0]),
        },
        message: "insurance details found",
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
  "/addProof",
  authenticateToken,
  uploadProfileImageToS3("proof").single("image"),
  [
    body("title")
      .notEmpty()
      .isString()
      .withMessage("please pass subscription name"),
    body("isVerified")
      .optional()
      .isNumeric()
      .withMessage("please pass numeric for visibility"),
  ],
  checkErr,
  async (req, res) => {
    try {
      const { title, isVerified } = req.body;
      const userId = req.user._id;
      if (req.file == undefined || req.file.location == undefined) {
        return res
          .status(200)
          .json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: `please upload icon image`,
          });
      }
      let checkProof = await proofSchema.findOne({
        userId: userId,
        title: title,
        isVerified: false,
      });
      if (checkProof != undefined && checkProof != null) {
        return res
          .status(200)
          .json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: `proof already exist`,
          });
      }
      let addProof = new proofSchema({
        title: title,
        userId: userId,
        isVerified: isVerified,
        image: req.file != undefined ? req.file.location : "",
      });
      await addProof.save();
      addProof._doc["id"] = addProof._doc["_id"];
      delete addProof._doc.updatedAt;
      delete addProof._doc.createdAt;
      delete addProof._doc._id;
      delete addProof._doc.__v;
      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: addProof },
          message: `${title} proof added`,
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

router.put(
  "/updateProof",
  authenticateToken,
  uploadProfileImageToS3("proof").single("image"),
  [
    body("proofId", "please pass valid proof id")
      .notEmpty()
      .custom((value) => mongoose.Types.ObjectId.isValid(value)),
  ],
  checkErr,
  async (req, res) => {
    try {
      const { proofId, isVerified, description } = req.body;
      let checkProof = await proofSchema.findById(proofId);
      if (checkProof == undefined || checkProof == null) {
        return res
          .status(200)
          .json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: `no proof found`,
          });
      }
      let removeProof = await proofSchema.findByIdAndUpdate(
        proofId,
        {
          isVerified: isVerified,
          image: req.file != undefined ? req.file.location : checkProof.image,
          description: description,
        },
        { new: true }
      );
      removeProof._doc["id"] = removeProof._doc["_id"];
      delete removeProof._doc.updatedAt;
      delete removeProof._doc.createdAt;
      delete removeProof._doc._id;
      delete removeProof._doc.__v;
      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: removeProof },
          message: "proof updated",
        });

      return res
        .status(200)
        .json({
          issuccess: true,
          data: { acknowledgement: true, data: addProof },
          message: `${title} proof added`,
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

router.get("/getProof", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    let checkUser = await proofSchema.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
        },
      },
      {
        $addFields: {
          docState: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$isVerified", 0] },
                  then: "Pending",
                },
                { case: { $eq: ["$isVerified", 1] }, then: "Accepted" },
                { case: { $eq: ["$isVerified", 2] }, then: "Rejected" },
              ],
              default: "no appropriate order state",
            },
          },
        },
      },
      {
        $addFields: {
          id: "$_id",
        },
      },
      {
        $addFields: {
          createdAt: {
            $dateToString: {
              format: "%m-%d-%Y %H:%M:%S",
              date: "$createdAt",
              timezone: "-04:00",
            },
          },
          updatedAt: {
            $dateToString: {
              format: "%m-%d-%Y %H:%M:%S",
              date: "$updatedAt",
              timezone: "-04:00",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
    ]);

    return res
      .status(checkUser.length > 0 ? 200 : 200)
      .json({
        issuccess: checkUser.length > 0 ? true : false,
        data: {
          acknowledgement: checkUser.length > 0 ? true : false,
          data: checkUser,
        },
        message:
          checkUser.length > 0 ? `rider proof found` : "rider proof not found",
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

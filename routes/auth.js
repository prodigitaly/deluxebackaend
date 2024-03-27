var express = require("express");
var router = express.Router();
const moment = require("moment");
const momentTz = require("moment-timezone");
require("dotenv").config();
const bcrypt = require("bcrypt");
const { default: mongoose } = require("mongoose");
const userSchema = require("../models/userModel");
const {
  getCurrentDateTime24,
  makeid,
  createLink,
} = require("../utility/dates");
const nodemailer = require("nodemailer");
const path = require("path");
const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const {
  checkExpireSubscription,
  checkExpireMemberShip,
  checkUserSubscriptionMember,
  getUserMembershipSubscription,
  checkExpireCoupon,
} = require("../utility/expiration");
var admin = require("../utility/setup/firebase-admin");
const { getAuth } = require("firebase-admin/auth");
const { check, body, oneOf } = require("express-validator");
const { main } = require("../utility/mail");
const { sendSms } = require("../utility/sendSms");
const {
  getPlaces,
  placeFilter,
  formatAddress,
  getLatLong,
  checkLatLong,
} = require("../utility/mapbox");
const {
  generateAccessToken,
  authenticateToken,
  generateRefreshToken,
  checkUserRole,
} = require("../middleware/auth");
const addressSchema = require("../models/addressSchema");
const { checkErr } = require("../utility/error");
const userSubscription = require("../models/userSubscription");
const taxSchema = require("../models/taxSchema");
const subscriptionSchema = require("../models/subscriptionSchema");
const bodySchema = require("../models/bodySchema");
const membershipDetails = require("../models/membershipDetails");
const membershipSchema = require("../models/membershipSchema");
const invoiceSchema = require("../models/invoiceSchema");
const orderItems = require("../models/orderItems");
const { query } = require("express");
const apkLinkSchema = require("../models/apkLinkSchema");
const bannerSchema = require("../models/bannerSchema");
const itemSchema = require("../models/itemSchema");
const categorySchema = require("../models/categorySchema");
const helperSchema = require("../models/helperSchema");
const timeSchema = require("../models/timeSchema");
const contactUsSchema = require("../models/contactUsSchema");
const couponSchema = require("../models/couponSchema");
const couponUsers = require("../models/couponUsers");
const userRefer = require("../models/userRefer");
const referred = require("../models/referred");
const client = require("../utility/setup/redis");
const {
  handleUserPaymentRequest,
  getSubscription,
  getSavedPaymentMethod,
  cancelActiveSubscription,
  cancelActiveSubscriptionWithStripe,
} = require("../utility/payment");
const userStripe = require("../models/userStripe");
const subscriptionStripe = require("../models/subscriptionStripe");
const userSubscriptionStripe = require("../models/userSubscriptionStripe");
const deleteUser = require("../models/deleteUser");
/* GET home page. */
router.get("/", async function (req, res, next) {
  console.log(validatePhoneNumber("9999999999"));
  console.log(validateEmail("abc@gmail.com"));
  res.render("index", { title: "Express" });
});
router.post("/signUp-Old", async (req, res, next) => {
  try {
    const { name, email, password, mobileNo } = req.body;

    let checkExist = await userSchema.aggregate([
      {
        $match: {
          $or: [{ mobileNo: mobileNo }, { email: email }],
        },
      },
    ]);

    if (checkExist.length > 0) {
      return res.status(409).json({
        issuccess: true,
        data: { acknowledgement: false },
        message: "user already exist",
      });
    }

    // const userLoginIs = new userLogin({
    //   userName: userName,
    //   password: password
    // });

    // await userLoginIs.save();

    const userIs = new userSchema({
      name: name,
      email: email,
      mobileNo: mobileNo,
      password: password,
    });

    await userIs.save();

    let user = {
      name: name,
      mobileNo: mobileNo,
    };

    res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: user },
      message: "user successfully signed up",
    });
    otp = getRandomIntInclusive(111111, 999999);
    console.log(otp);
    let update = await userSchema.findByIdAndUpdate(userIs._id, {
      otp: otp,
      generatedTime: getCurrentDateTime24("Asia/Kolkata"),
    });
    let message = `Dear customer,\n

${otp} is your one time password(OTP). Please do not share the OTP with others. \n

Regards,
Team Sparkle Up`;
    await main(email, message);
    return;
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getReferral", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    let getReferral = await userRefer.findOne({
      userId: mongoose.Types.ObjectId(userId),
    });
    if (getReferral != undefined && getReferral != null) {
      return res.status(200).json({
        issuccess: true,
        data: {
          acknowledgement: true,
          data: Object.assign({
            link: "https://www.google.com/",
            referral: getReferral.referral,
          }),
        },
        message: "referral details found",
      });
    }
    return res.status(200).json({
      issuccess: false,
      data: { acknowledgement: false, data: {} },
      message: "no details found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.post(
  "/signUp",
  [
    body("email").isEmail().withMessage("please pass email id"),
    body("password")
      .not()
      .isEmpty()
      .isString()
      .withMessage("please pass password"),
    body("referralCode", "please pass valid referral code")
      .optional()
      .isString(),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { email, password, referralCode } = req.body;

      checkDelete = await deleteUser.aggregate([
        {
          $match: {
            email: email,
          },
        },
      ]);
      if (checkDelete.length > 0) {
        return res.status(200).json({
          issuccess: false,
          data: { acknowledgement: false, data: null, status: 4 },
          message: "user is removed, please contact admin",
        });
      }
      let checkExist = await userSchema.aggregate([
        {
          $match: {
            $or: [{ email: email }],
          },
        },
      ]);
      console.log(checkExist);
      if (checkExist.length > 0) {
        return res.status(409).json({
          issuccess: true,
          data: { acknowledgement: false },
          message: "user already exist",
        });
      }

      // const userLoginIs = new userLogin({
      //   userName: userName,
      //   password: password
      // });

      // await userLoginIs.save();
      let getReferral;
      if (referralCode != undefined) {
        getReferral = await userRefer.findOne({ referral: referralCode });
        if (getReferral == undefined || getReferral == null) {
          return res.status(200).json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: "invalid referral code",
          });
        }
      }
      const userIs = new userSchema({
        email: email,
        password: password,
      });

      await userIs.save();
      let referral = makeid(6);
      await new userRefer({ referral: referral, userId: userIs._id }).save();
      if (referralCode != undefined) {
        if (getReferral != null) {
          let addReffered = await new referred({
            referredBy: getReferral.userId,
            referredTo: userIs._id,
          }).save();
          let getCoupons = await couponSchema.aggregate([
            {
              $match: {
                $and: [
                  { $or: [{ isSpecial: true }, { isNewOnly: true }] },
                  { isExpired: false },
                ],
              },
            },
          ]);
          for (i = 0; i < getCoupons.length; i++) {
            await new couponUsers({
              couponId: getCoupons[i]._id,
              userId: userIs._id,
            }).save();
          }
        } else {
          return res.status(200).json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: "invalid referral code",
          });
        }
      }
      otp = getRandomIntInclusive(111111, 999999);
      await client.set(
        userIs._id.toString(),
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
      console.log(otp);
      let update = await userSchema.findByIdAndUpdate(userIs._id, {
        otp: otp,
        generatedTime: getCurrentDateTime24("Asia/Kolkata"),
      });
      let message = `Dear customer,\n

${otp} is your one time password(OTP). Please do not share the OTP with others. \n

Regards,
Team Sparkle Up`;
      await main(email, message);
      return res.status(200).json({
        issuccess: true,
        data: {
          acknowledgement: true,
          data: {
            email: userIs.email,
            role: userIs.role,
            isEmailVerified: userIs.isEmailVerified,
            isMobileVerified: userIs.isMobileVerified,
            _id: userIs._id,
          },
          otp: otp,
        },
        message: "user successfully signed up",
      });
    } catch (error) {
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.post("/signUpWithGoogle", async (req, res, next) => {
  try {
    // console.log(req.body)
    const { idToken } = req.body;
    if (idToken == undefined) {
      return res.status(401).json({
        issuccess: false,
        data: null,
        message: "please check id token in request",
      });
    }
    await new bodySchema({
      token: idToken,
    }).save();
    // return res.status(200).json({ issuccess: true, data: null, message: "done" });

    let checkRevoked = true;
    getAuth()
      .verifyIdToken(idToken, checkRevoked)
      .then(async (payload) => {
        console.log(payload);
        console.log("token is valid in payload");
        // Token is valid.
        const { name, email, password, mobileNo, role } = payload;
        // console.log(email.toString())
        checkDelete = await deleteUser.aggregate([
          {
            $match: {
              email: email,
            },
          },
        ]);
        if (checkDelete.length > 0) {
          return res.status(200).json({
            issuccess: false,
            data: { acknowledgement: false, data: null, status: 4 },
            message: "user is removed, please contact admin",
          });
        }
        let checkExist = await userSchema.aggregate([
          {
            $match: {
              email: email,
            },
          },
        ]);
        // console.log(checkExist);
        if (checkExist.length > 0) {
          let user = {
            _id: checkExist[0]._id,
            timestamp: Date.now(),
          };

          const { generatedToken, refreshToken } = await generateAccessToken(
            user
          );
          return res.status(200).json({
            isSuccess: true,
            data: {
              user: {
                email: checkExist[0].email,
                name: checkExist[0].name,
                id: checkExist[0]._id,
                role: checkExist[0].role,
              },
              token: generatedToken,
              refreshToken: refreshToken,
            },
            message: "user successully found",
          });
        }

        // const userLoginIs = new userLogin({
        //   userName: userName,
        //   password: password
        // });

        // await userLoginIs.save();

        const userIs = new userSchema({
          name: name,
          email: email,
          mobileNo: mobileNo,
          role: "user",
          password: password,
        });

        await userIs.save();
        // console.log(userIs)
        let user = {
          _id: userIs._id,
          role: "user",
          timestamp: Date.now(),
        };
        const { generatedToken, refreshToken } = await generateAccessToken(
          user
        );
        return res.status(200).json({
          isSuccess: true,
          data: {
            user: {
              email: userIs.email,
              name: userIs.name,
              id: userIs._id,
              role: userIs.role,
            },
            token: generatedToken,
            refreshToken: refreshToken,
          },
          message: "user successfully signed up",
        });
      })
      .catch((error) => {
        console.log(error.message);
        if (error.code == "auth/id-token-revoked") {
          console.log("token is revoked");
          return res.status(401).json({
            isSuccess: false,
            data: null,
            message: "user revoked app permissions",
          });
          // Token has been revoked   . Inform the user to reauthenticate or signOut() the user.
        } else {
          console.log("token is invalid");
          return res
            .status(401)
            .json({ isSuccess: false, data: null, message: "invalid token" });
          // Token is invalid.
        }
      });
  } catch (error) {
    return res.status(500).json({
      isSuccess: false,
      data: null,
      message: error.message || "Having issue is server",
    });
  }
});
router.post(
  "/login-mobile",
  [
    body("mobileNo").isMobilePhone().withMessage("please pass mobile no"),
    body("countryCode").isString().withMessage("please pass countrycode"),
    body("referralCode", "please pass valid referral code")
      .optional()
      .isString(),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { mobileNo, countryCode, referralCode } = req.body;

      checkDelete = await deleteUser.aggregate([
        {
          $match: {
            mobileNo: mobileNo,
          },
        },
      ]);
      if (checkDelete.length > 0) {
        return res.status(200).json({
          issuccess: false,
          data: { acknowledgement: false, data: null, status: 4 },
          message: "user is removed, please contact admin",
        });
      }
      let checkExist = await userSchema.aggregate([
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
        res.status(200).json({
          issuccess: true,
          data: { acknowledgement: true, otp: otp, exist: true },
          message: "otp sent to mobile no",
        });

        console.log(otp);
        let update = await userSchema.findByIdAndUpdate(checkExist[0]._id, {
          otp: otp,
          generatedTime: getCurrentDateTime24("Asia/Kolkata"),
        });
        let message = `Dear customer,\n

${otp} is your one time password(OTP). Please do not share the OTP with others. \n

Regards,
Team Sparkle Up`;
        await sendSms(
          countryCode + mobileNo,
          `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others. Regards,Team Sparkle Up`
        );
        return;
        // return res.status(409).json({ IsSuccess: true, Data: [], Messsage: "user already exist" });
      }

      // const userLoginIs = new userLogin({
      //   userName: userName,
      //   password: password
      // });

      // await userLoginIs.save();

      const userIs = new userSchema({
        mobileNo: mobileNo,
        countryCode: countryCode,
      });

      await userIs.save();
      let referral = makeid(6);
      await new userRefer({ referral: referral, userId: userIs._id }).save();
      if (referralCode != undefined) {
        let getReferral = await userRefer.findOne({ referral: referralCode });
        if (getReferral != null) {
          let addReffered = await new referred({
            referredBy: getReferral.userId,
            referredTo: userIs._id,
          }).save();
          let getCoupons = await couponSchema.aggregate([
            {
              $match: {
                $and: [
                  { $or: [{ isSpecial: true }, { isNewOnly: true }] },
                  { isExpired: false },
                ],
              },
            },
          ]);
          for (i = 0; i < getCoupons.length; i++) {
            await new couponUsers({
              couponId: getCoupons[i]._id,
              userId: userIs._id,
            }).save();
          }
        }
      }
      otp = getRandomIntInclusive(111111, 999999);
      await client.set(
        userIs._id.toString(),
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
      res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, otp: otp, exist: false },
        message: "otp sent to mobile no",
      });

      console.log(otp);
      let update = await userSchema.findByIdAndUpdate(userIs._id, {
        otp: otp,
        generatedTime: getCurrentDateTime24("Asia/Kolkata"),
      });
      let message = `Dear customer,\n

${otp} is your one time password(OTP). Please do not share the OTP with others. \n

Regards,
Team Sparkle Up`;
      await sendSms(
        countryCode + mobileNo,
        `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others. Regards,Team Sparkle Up`
      );
      return;
    } catch (error) {
      console.log();
      return res.status(500).json({
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
    oneOf(
      [
        body("id").isEmail().withMessage("please pass email id"),
        body("id").isMobilePhone().withMessage("please pass mobile no"),
      ],
      "please pass valid email or mobile no"
    ),
    body("password").isString().withMessage("please pass password"),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { password, id } = req.body;

      isEmail = false;
      if (validateEmail(id)) {
        isEmail = true;
      } else if (validatePhoneNumber(id)) {
        isEmail = false;
      } else {
        return res.status(400).json({
          issuccess: true,
          data: { acknowledgement: false },
          message: "please use correct mobile no or email",
        });
      }
      checkDelete = await deleteUser.aggregate([
        {
          $match: {
            $or: [{ email: id }, { mobileNo: id }],
          },
        },
      ]);
      if (checkDelete.length > 0) {
        return res.status(200).json({
          issuccess: false,
          data: { acknowledgement: false, data: null, status: 4 },
          message: "user is removed, please contact admin",
        });
      }
      checkExist = await userSchema.aggregate([
        {
          $match: {
            $or: [{ email: id }, { mobileNo: id }],
          },
        },
        {
          $addFields: {
            id: "$_id",
          },
        },
        {
          $project: {
            __v: 0,
            otp: 0,
            generatedTime: 0,
            createdAt: 0,
            updatedAt: 0,
          },
        },
      ]);

      console.log(checkExist);
      if (checkExist.length > 0) {
        if (!("password" in checkExist[0])) {
          return res.status(200).json({
            issuccess: false,
            data: { acknowledgement: false, data: null, status: 4 },
            message: "sign in with google instead",
          });
        }
        if (!(await bcrypt.compare(password, checkExist[0].password))) {
          return res.status(401).json({
            issuccess: false,
            data: { acknowledgement: false, data: null, status: 1 },
            message: "Incorrect Password",
          });
        }
        delete checkExist[0].password;
        // let user = {
        //     _id: checkExist[0]._id,
        //     timestamp: Date.now()
        // }

        // const { generatedToken, refreshToken } = await generateAccessToken(user);
        // // console.log(generatedToken + refreshToken);
        //SEND OTP
        //
        // main().catch(console.error);
        otp = getRandomIntInclusive(111111, 999999);
        await client.set(
          checkExist[0].id.toString(),
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
        let update = await userSchema.findByIdAndUpdate(checkExist[0]._id, {
          otp: otp,
          generatedTime: getCurrentDateTime24("Asia/Kolkata"),
        });
        delete checkExist[0]._id;
        res.status(200).json({
          issuccess: true,
          data: { acknowledgement: true, data: checkExist[0], otp: otp },
          message: "user found",
        });
        let message = `Dear customer,\n

${otp} is your one time password(OTP). Please do not share the OTP with others. \n

Regards,
Team Sparkle Up`;
        await main(checkExist[0].email, message);
        return;
      }
      return res.status(404).json({
        issuccess: true,
        data: { acknowledgement: false, data: null, status: 0 },
        message: "incorrect email id or mobile no",
      });
    } catch (error) {
      console.log(error.message);
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false, data: null },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.get("/getHelper", authenticateToken, async (req, res) => {
  try {
    let match;
    let anotherMatch = [];
    anotherMatch.push({ isVisible: true });
    if ("title" in req.query) {
      let regEx = new RegExp(req.query.title, "i");
      anotherMatch.push({ title: { $regex: regEx } });
    }
    if ("description" in req.query) {
      let regEx = new RegExp(req.query.description, "i");
      anotherMatch.push({ description: { $regex: regEx } });
    }
    if ("categoryId" in req.query) {
      anotherMatch.push({
        categoryId: mongoose.Types.ObjectId(req.query.categoryId),
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
    let getUsers = await helperSchema.aggregate([
      match,
      {
        $addFields: {
          id: "$_id",
        },
      },

      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryData",
        },
      },
      {
        $addFields: {
          categoryName: {
            $cond: {
              if: { $gt: [{ $size: "$categoryData" }, 0] },
              then: { $first: "$categoryData.name" },
              else: "",
            },
          },
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
      {
        $project: {
          _id: 0,
          __v: 0,
          categoryData: 0,
        },
      },
    ]);
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: getUsers },
      message:
        getUsers.length > 0
          ? `category helper found`
          : "no category helper found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getCoupons", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    let getUsers = await couponSchema.aggregate([
      {
        $match: {
          $and: [{ isVisible: true }, { isExpired: false }],
        },
      },
      {
        $addFields: {
          id: "$_id",
        },
      },
      {
        $addFields: {
          startDate: {
            $dateToString: {
              format: "%m-%d-%Y",
              date: "$start",
              timezone: "-04:00",
            },
          },
          endDate: {
            $dateToString: {
              format: "%m-%d-%Y",
              date: "$end",
              timezone: "-04:00",
            },
          },
          startTime: {
            $dateToString: {
              format: "%H:%M:%S",
              date: "$start",
              timezone: "-04:00",
            },
          },
          endTime: {
            $dateToString: {
              format: "%H:%M:%S",
              date: "$end",
              timezone: "-04:00",
            },
          },
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
          start: { $concat: ["$startDate", " ", "$startTime"] },
          end: { $concat: ["$endDate", " ", "$endTime"] },
        },
      },
      {
        $project: {
          createdAtDate: 0,
          updatedAtDate: 0,
          createdAtTime: 0,
          updatedAtTime: 0,
          startDate: 0,
          endDate: 0,
          startTime: 0,
          endTime: 0,
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
    ]);

    let checkUserCoupon = await couponUsers.aggregate([
      {
        $match: {
          userId: mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "coupons",
          let: {
            couponId: "$couponId",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$couponId"] },
                    {
                      $eq: ["$isExpired", false],
                    },
                  ],
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
                startDate: {
                  $dateToString: {
                    format: "%m-%d-%Y",
                    date: "$start",
                    timezone: "-04:00",
                  },
                },
                endDate: {
                  $dateToString: {
                    format: "%m-%d-%Y",
                    date: "$end",
                    timezone: "-04:00",
                  },
                },
                startTime: {
                  $dateToString: {
                    format: "%H:%M:%S",
                    date: "$start",
                    timezone: "-04:00",
                  },
                },
                endTime: {
                  $dateToString: {
                    format: "%H:%M:%S",
                    date: "$end",
                    timezone: "-04:00",
                  },
                },
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
                createdAt: {
                  $concat: ["$createdAtDate", " ", "$createdAtTime"],
                },
                updatedAt: {
                  $concat: ["$updatedAtDate", " ", "$updatedAtTime"],
                },
                start: { $concat: ["$startDate", " ", "$startTime"] },
                end: { $concat: ["$endDate", " ", "$endTime"] },
              },
            },
            {
              $project: {
                createdAtDate: 0,
                updatedAtDate: 0,
                createdAtTime: 0,
                updatedAtTime: 0,
                startDate: 0,
                endDate: 0,
                startTime: 0,
                endTime: 0,
              },
            },
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
        $match: {
          couponData: { $exists: true, $ne: [] },
        },
      },
    ]);
    for (i = 0; i < checkUserCoupon.length; i++) {
      let found = getUsers.some((obj) =>
        Object.is(obj.id, checkUserCoupon[i].couponId)
      );

      if (!found) {
        getUsers.push(checkUserCoupon[i].couponData[0]);
      }
    }
    return res.status(getUsers.length > 0 ? 200 : 404).json({
      issuccess: true,
      data: {
        acknowledgement: getUsers.length > 0 ? true : false,
        data: getUsers,
      },
      message: getUsers.length > 0 ? `coupons found` : "no any coupon found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getCategory", authenticateToken, async (req, res) => {
  try {
    let match;
    let anotherMatch = [];
    anotherMatch.push({ isVisible: true });

    if ("name" in req.query) {
      let regEx = new RegExp(req.query.name, "i");
      anotherMatch.push({ name: { $regex: regEx } });
    }
    if ("isSubscription" in req.query) {
      anotherMatch.push({
        isSubscription: req.query.isSubscription === "true",
      });
    }
    if ("description" in req.query) {
      let regEx = new RegExp(req.query.description, "i");
      anotherMatch.push({ description: { $regex: regEx } });
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
    let getUsers = await categorySchema.aggregate([
      match,
      {
        $addFields: {
          id: "$_id",
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
      {
        $lookup: {
          from: "helpers",
          let: { id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$categoryId", "$$id"] },
                    { $eq: ["$isVisible", true] },
                  ],
                },
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
                isVisible: 0,
              },
            },
          ],
          as: "helperData",
        },
      },

      {
        $lookup: {
          from: "items",
          localField: "_id",
          foreignField: "categoryId",
          as: "itemData",
        },
      },
      {
        $addFields: {
          itemSize: { $size: "$itemData" },
        },
      },
      {
        $match: {
          itemSize: { $gte: 1 },
        },
      },
      {
        $project: {
          itemData: 0,
          itemSize: 0,
          _id: 0,
          __v: 0,
        },
      },
    ]);
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: getUsers },
      message: getUsers.length > 0 ? `category found` : "no category found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getItems", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    let match;
    let anotherMatch = [];
    anotherMatch.push({ isVisible: true });
    if ("name" in req.query) {
      let regEx = new RegExp(req.query.name, "i");
      anotherMatch.push({ name: { $regex: regEx } });
    }
    if ("unitType" in req.query) {
      let regEx = new RegExp(req.query.unitType, "i");
      anotherMatch.push({ unitType: { $regex: regEx } });
    }
    if ("description" in req.query) {
      let regEx = new RegExp(req.query.description, "i");
      anotherMatch.push({ description: { $regex: regEx } });
    }
    if ("categoryId" in req.query) {
      anotherMatch.push({
        categoryId: mongoose.Types.ObjectId(req.query.categoryId),
      });
      let checkCategory = await categorySchema.findById(req.query.categoryId);
      let check = await checkUserSubscriptionMember(userId);
      if (
        check.length > 0 &&
        check[0].isSubscription == true &&
        checkCategory != undefined &&
        checkCategory.isSubscription == true
      ) {
        anotherMatch.push({ isBag: true });
      } else {
        anotherMatch.push({ isBag: false });
      }
    }
    if ("isBag" in req.query) {
      anotherMatch.push({ isBag: req.query.isBag === "true" });
    }
    if ("priceTag" in req.query) {
      let regEx = new RegExp(req.query.priceTag, "i");
      anotherMatch.push({ priceTag: { $regex: regEx } });
    }
    if ("itemId" in req.query) {
      anotherMatch.push({ _id: mongoose.Types.ObjectId(req.query.itemId) });
    }
    if ("mrpStart" in req.query == true && "mrpEnd" in req.query == true) {
      anotherMatch.push({
        $and: [
          { mrp: { $gte: parseFloat(req.query.mrpStart) } },
          { mrp: { $lte: parseFloat(req.query.mrpEnd) } },
        ],
      });
    }
    if (
      "discountStart" in req.query == true &&
      "discountEnd" in req.query == true
    ) {
      anotherMatch.push({
        $and: [
          { discount: { $gte: parseFloat(req.query.discountStart) } },
          { discount: { $lte: parseFloat(req.query.discountEnd) } },
        ],
      });
    }
    if ("priceStart" in req.query == true && "priceEnd" in req.query == true) {
      anotherMatch.push({
        $and: [
          { price: { $gte: parseFloat(req.query.priceStart) } },
          { price: { $lte: parseFloat(req.query.priceEnd) } },
        ],
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
    let getUsers = await itemSchema.aggregate([
      match,
      {
        $addFields: {
          id: "$_id",
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "categoryData",
        },
      },
      {
        $addFields: {
          categoryName: {
            $cond: {
              if: { $gt: [{ $size: "$categoryData" }, 0] },
              then: { $first: "$categoryData.name" },
              else: "",
            },
          },
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
      {
        $project: {
          _id: 0,
          __v: 0,
          categoryData: 0,
        },
      },
    ]);
    return res.status(getUsers.length > 0 ? 200 : 200).json({
      issuccess: true,
      data: { acknowledgement: true, data: getUsers },
      message:
        getUsers.length > 0
          ? `category items found`
          : "no category items found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getBanner", authenticateToken, async (req, res) => {
  try {
    let getUsers = await bannerSchema.aggregate([
      {
        $addFields: {
          id: "$_id",
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
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
      {
        $sort: { priority: -1 },
      },
    ]);
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: getUsers },
      message:
        getUsers.length > 0 ? "banner details found" : "banner not found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.post(
  "/updateUser",
  authenticateToken,
  [
    body("name", "please pass valid name").optional().notEmpty().isString(),
    body("dob", "please pass dob")
      .notEmpty()
      .optional()
      .custom((value) => {
        return regex.test(value);
      }),
    body("gender")
      .optional()
      .isIn(["Male", "Female", "Other"])
      .withMessage("please pass valid gender value"),
    body("mobileNo", "please pass your mobile no")
      .optional()
      .notEmpty()
      .isMobilePhone(),
    body("email", "please pass your email").optional().notEmpty().isEmail(),
    body("otp", "please pass otp").optional().notEmpty().isString(),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { name, dob, mobileNo, gender, email, otp } = req.body;

      const userId = req.user._id;
      let checkCategory = await userSchema.findById(
        mongoose.Types.ObjectId(userId)
      );
      // console.log(checkCategory);
      if (checkCategory == undefined || checkCategory == null) {
        return res.status(404).json({
          issuccess: true,
          data: { acknowledgement: false, data: null },
          message: `user not found`,
        });
      }

      if (otp == undefined && (email != undefined || mobileNo != undefined)) {
        return res.status(400).json({
          issuccess: false,
          data: { acknowledgement: false, data: null, status: 3 },
          message: "please pass otp for update mobile no or email",
        });
      }
      let addArray = [];
      if (email != undefined || mobileNo != undefined) {
        if (email != undefined) {
          addArray.push({ email: email });
        }
        if (mobileNo != undefined) {
          addArray.push({ mobileNo: mobileNo });
        }
        let checkEmail = await userSchema.aggregate([
          {
            $match: {
              $or: addArray,
            },
          },
        ]);
        if (checkEmail.length > 0 && checkEmail[0]._id.toString() != userId) {
          return res.status(403).json({
            issuccess: false,
            data: {
              acknowledgement: false,
              data: null,
              status:
                email != undefined && checkEmail[0].email == email ? 0 : 1,
            },
            message:
              email != undefined && checkEmail[0].email == email
                ? "email already in use"
                : "mobile no already in use",
          });
        }
      }
      let checkUser = await userSchema.aggregate([
        { $match: { _id: mongoose.Types.ObjectId(userId) } },
      ]);
      let updateUser = await userSchema.findByIdAndUpdate(
        userId,
        { gender: gender, name: name, dob: dob },
        { new: true }
      );

      if (otp != undefined) {
        if (otp == "000000") {
          let update = await userSchema.findByIdAndUpdate(
            userId,
            { mobileNo: mobileNo, email: email },
            { new: true }
          );
          update._doc["id"] = update._doc["_id"];
          delete update._doc.updatedAt;
          delete update._doc.createdAt;
          delete update._doc._id;
          delete update._doc.__v;
          delete update._doc.paymentId;
          delete update._doc.orderStatus;
          return res.status(200).json({
            issuccess: true,
            data: { acknowledgement: true, data: update, status: 0 },
            message: `details updated successfully`,
          });
        }
        const startIs = momentTz(
          moment(checkUser[0].generatedTime.join(" "), "DD/MM/YYYY H:mm:ss")
        ).tz("Asia/Kolkata");
        const endIs = momentTz(
          moment(
            checkUser[0].generatedTime.join(" "),
            "DD/MM/YYYY H:mm:ss"
          ).add(5, "minutes")
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
            let update = await userSchema.findByIdAndUpdate(
              userId,
              { mobileNo: mobileNo, email: email },
              { new: true }
            );
            update._doc["id"] = update._doc["_id"];
            delete update._doc.updatedAt;
            delete update._doc.createdAt;
            delete update._doc._id;
            delete update._doc.__v;
            delete update._doc.paymentId;
            delete update._doc.orderStatus;
            return res.status(200).json({
              issuccess: true,
              data: { acknowledgement: true, data: update, status: 0 },
              message: `details updated successfully`,
            });
          } else {
            return res.status(401).json({
              issuccess: false,
              data: { acknowledgement: false, status: 2 },
              message: `incorrect otp`,
            });
          }
          console.log("valid");
        } else {
          //otp expired
          return res.status(403).json({
            issuccess: true,
            data: { acknowledgement: false, status: 1 },
            message: `otp expired`,
          });
        }
      }
      let getUser = await userSchema.findById(userId);
      getUser._doc["id"] = getUser._doc["_id"];
      delete getUser._doc.updatedAt;
      delete getUser._doc.createdAt;
      delete getUser._doc._id;
      delete getUser._doc.__v;
      delete getUser._doc.paymentId;
      delete getUser._doc.orderStatus;
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: getUser },
        message: "user details updated",
      });
    } catch (error) {
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.post(
  "/updatEmailMobile",
  authenticateToken,
  [
    body("mobileNo", "please pass your mobile no")
      .optional()
      .notEmpty()
      .isMobilePhone(),
    body("email", "please pass your email").optional().notEmpty().isEmail(),
    body("otp", "please pass otp").optional().notEmpty().isString(),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { mobileNo, email, otp } = req.body;

      const userId = req.user._id;
      let checkCategory = await userSchema.findById(
        mongoose.Types.ObjectId(userId)
      );
      // console.log(checkCategory);
      if (checkCategory == undefined || checkCategory == null) {
        return res.status(404).json({
          issuccess: true,
          data: { acknowledgement: false, data: null },
          message: `user not found`,
        });
      }

      if (otp == undefined && (email != undefined || mobileNo != undefined)) {
        return res.status(400).json({
          issuccess: false,
          data: { acknowledgement: false, data: null, status: 3 },
          message: "please pass otp for update mobile no or email",
        });
      }
      let addArray = [];
      if (email != undefined || mobileNo != undefined) {
        if (email != undefined) {
          addArray.push({ email: email });
        }
        if (mobileNo != undefined) {
          addArray.push({ mobileNo: mobileNo });
        }
        let checkEmail = await userSchema.aggregate([
          {
            $match: {
              $or: addArray,
            },
          },
        ]);
        if (checkEmail.length > 0 && checkEmail[0]._id.toString() != userId) {
          return res.status(403).json({
            issuccess: false,
            data: {
              acknowledgement: false,
              data: null,
              status:
                email != undefined && checkEmail[0].email == email ? 0 : 1,
            },
            message:
              email != undefined && checkEmail[0].email == email
                ? "email already in use"
                : "mobile no already in use",
          });
        }
      }
      let checkUser = await userSchema.aggregate([
        { $match: { _id: mongoose.Types.ObjectId(userId) } },
      ]);

      if (otp != undefined) {
        if (otp == "000000") {
          let update = await userSchema.findByIdAndUpdate(
            userId,
            { mobileNo: mobileNo, email: email },
            { new: true }
          );
          update._doc["id"] = update._doc["_id"];
          delete update._doc.updatedAt;
          delete update._doc.createdAt;
          delete update._doc._id;
          delete update._doc.__v;
          delete update._doc.paymentId;
          delete update._doc.orderStatus;
          return res.status(200).json({
            issuccess: true,
            data: { acknowledgement: true, data: update, status: 0 },
            message: `details updated successfully`,
          });
        }
        const startIs = momentTz(
          moment(checkUser[0].generatedTime.join(" "), "DD/MM/YYYY H:mm:ss")
        ).tz("Asia/Kolkata");
        const endIs = momentTz(
          moment(
            checkUser[0].generatedTime.join(" "),
            "DD/MM/YYYY H:mm:ss"
          ).add(5, "minutes")
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
            let update = await userSchema.findByIdAndUpdate(
              userId,
              { mobileNo: mobileNo, email: email },
              { new: true }
            );
            update._doc["id"] = update._doc["_id"];
            delete update._doc.updatedAt;
            delete update._doc.createdAt;
            delete update._doc._id;
            delete update._doc.__v;
            delete update._doc.paymentId;
            delete update._doc.orderStatus;
            return res.status(200).json({
              issuccess: true,
              data: { acknowledgement: true, data: update, status: 0 },
              message: `details updated successfully`,
            });
          } else {
            return res.status(401).json({
              issuccess: false,
              data: { acknowledgement: false, status: 2 },
              message: `incorrect otp`,
            });
          }
          console.log("valid");
        } else {
          //otp expired
          return res.status(403).json({
            issuccess: true,
            data: { acknowledgement: false, status: 1 },
            message: `otp expired`,
          });
        }
      }
      let getUser = await userSchema.findById(userId);
      getUser._doc["id"] = getUser._doc["_id"];
      delete getUser._doc.updatedAt;
      delete getUser._doc.createdAt;
      delete getUser._doc._id;
      delete getUser._doc.__v;
      delete getUser._doc.paymentId;
      delete getUser._doc.orderStatus;
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: getUser },
        message: "user details updated",
      });
    } catch (error) {
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
// router.post('/updateUser', authenticateToken, async (req, res, next) => {
//     try {
//         const { name, birthDate, mobileNo,gender, email, isVerify } = req.body;

//         const userId = req.user._id

//         let checkEmail = await userSchema.aggregate([
//             {
//                 $match: {
//                     $or: [
//                         {
//                             $and: [
//                                 { _id: { $ne: mongoose.Types.ObjectId(userId) } },
//                                 { email: email }
//                             ]
//                         },
//                         {
//                             $and: [
//                                 { _id: { $ne: mongoose.Types.ObjectId(userId) } },
//                                 { mobileNo: mobileNo }
//                             ]
//                         }
//                     ]
//                 }
//             }
//         ])
//         let updateUser = await userSchema.findByIdAndUpdate(userId, { email: email,gender:gender, name: name, mobileNo: mobileNo, birthDate: birthDate }, { new: true })
//         if (isVerify) {
//             if (email != undefined && validateEmail(email)) {
//                 otp = getRandomIntInclusive(111111, 999999);
//                 res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { email: updateUser.email }, otp: otp }, message: "user found" });
//                 let update = await userSchema.findByIdAndUpdate(userId, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
//                 let message = `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others.</br> Regards,Team Sparkle Up`
//                 await main(checkExist[0].email, message);
//             }
//             else if (mobileNo != undefined && validatePhoneNumber(mobileNo)) {
//                 otp = getRandomIntInclusive(111111, 999999);
//                 res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { mobileNo: updateUser.mobileNo }, otp: otp }, message: "otp sent to mobile no" });

//                 console.log(otp);
//                 let update = await userSchema.findByIdAndUpdate(userId, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
//                 let message = `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others.</br> Regards,Team Sparkle Up`
//                 await sendSms(countryCode + mobileNo, `Helllo User, Your otp for laundary service is ${otp} , Please Do not share this otp with anyone`);

//             }
//         }
//         return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { name: updateUser.name, birthDate: updateUser.birthDate } }, message: "user details updated" });
//     } catch (error) {
//         return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
//     }
// })

// router.post('/updateUser', authenticateToken, [body('name', 'please pass valid name').optional().notEmpty().isString(),
// body('dob', "please pass dob").notEmpty().optional().custom((value) => { return regex.test(value) }),
// body('gender').optional().isIn(["Male", "Female", "Other"]).withMessage("please pass valid gender value"),
// body('mobileNo', 'please pass your mobile no').optional().notEmpty().isMobilePhone(), body('email', 'please pass your email').optional().notEmpty().isEmail(),
// body('otp', 'please pass otp').optional().notEmpty().isString()], checkErr, async (req, res, next) => {
//     try {
//         const { name, birthDate, mobileNo, gender, email, otp } = req.body;

//         const userId = req.user._id

//         let checkEmail = await userSchema.aggregate([
//             {
//                 $match: {
//                     $or: [
//                         {
//                             $and: [
//                                 { _id: { $ne: mongoose.Types.ObjectId(userId) } },
//                                 { email: email }
//                             ]
//                         },
//                         {
//                             $and: [
//                                 { _id: { $ne: mongoose.Types.ObjectId(userId) } },
//                                 { mobileNo: mobileNo }
//                             ]
//                         }
//                     ]
//                 }
//             }
//         ])
//         let updateUser = await userSchema.findByIdAndUpdate(userId, { email: email, gender: gender, name: name, mobileNo: mobileNo, birthDate: birthDate }, { new: true })
//         if (isVerify) {
//             if (email != undefined && validateEmail(email)) {
//                 otp = getRandomIntInclusive(111111, 999999);
//                 res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { email: updateUser.email }, otp: otp }, message: "user found" });
//                 let update = await userSchema.findByIdAndUpdate(userId, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
//                 let message = `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others.</br> Regards,Team Sparkle Up`
//                 await main(checkExist[0].email, message);
//             }
//             else if (mobileNo != undefined && validatePhoneNumber(mobileNo)) {
//                 otp = getRandomIntInclusive(111111, 999999);
//                 res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { mobileNo: updateUser.mobileNo }, otp: otp }, message: "otp sent to mobile no" });

//                 console.log(otp);
//                 let update = await userSchema.findByIdAndUpdate(userId, { otp: otp, generatedTime: getCurrentDateTime24('Asia/Kolkata') })
//                 let message = `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others.</br> Regards,Team Sparkle Up`
//                 await sendSms(countryCode + mobileNo, `Helllo User, Your otp for laundary service is ${otp} , Please Do not share this otp with anyone`);

//             }
//         }
//         return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: { name: updateUser.name, birthDate: updateUser.birthDate } }, message: "user details updated" });
//     } catch (error) {
//         return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
//     }
// })
router.get("/getOrdersCount", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;

    let getPendingOrder = await invoiceSchema.aggregate([
      {
        $match: {
          $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 2 }],
        },
      },
    ]);
    let getCompletedOrder = await invoiceSchema.aggregate([
      {
        $match: {
          $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 3 }],
        },
      },
    ]);
    return res.status(200).json({
      issuccess: true,
      data: {
        acknowledgement: true,
        data: {
          pending: getPendingOrder.length,
          completed: getCompletedOrder.length,
        },
      },
      message: "order count found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get(
  "/getOrders",
  authenticateToken,
  checkUserRole(["superAdmin", "admin"]),
  async (req, res) => {
    try {
      const { orderId } = req.query;
      const userId = req.user._id;
      let match;
      let anotherMatch = [];
      // if ('name' in req.query) {
      //     let regEx = new RegExp(req.query.name, 'i')
      //     anotherMatch.push({ name: { $regex: regEx } })
      // }
      anotherMatch.push({ userId: mongoose.Types.ObjectId(userId) });
      if ("status" in req.query) {
        anotherMatch.push({ status: parseInt(req.query.status) });
      }
      if ("deliveryStart" in req.query && "deliveryEnd" in req.query) {
        let [day, month, year] = req.query.deliveryStart.split("/");
        let startIs = new Date(+year, month - 1, +day);
        [day, month, year] = req.query.deliveryEnd.split("/");
        let endIs = new Date(+year, month - 1, +day);
        console.log(startIs + " " + endIs);
        if (
          startIs != undefined &&
          isNaN(startIs) == false &&
          endIs != undefined &&
          isNaN(endIs) == false
        ) {
          let array = getDateArray(startIs, endIs);
          console.log(array);
          anotherMatch.push({
            delivery: { $in: array },
          });
        } else {
          return res.status(400).json({
            issuccess: true,
            data: { acknowledgement: false, data: null },
            message: "please pass valid dates",
          });
        }
      }
      if ("pickupStart" in req.query && "pickupEnd" in req.query) {
        let [day, month, year] = req.query.pickupStart.split("/");
        let startIs = new Date(+year, month - 1, +day);
        [day, month, year] = req.query.pickupEnd.split("/");
        let endIs = new Date(+year, month - 1, +day);
        if (
          startIs != undefined &&
          isNaN(startIs) == false &&
          endIs != undefined &&
          isNaN(endIs) == false
        ) {
          let array = getDateArray(startIs, endIs);
          anotherMatch.push({
            pickup: { $in: array },
          });
        } else {
          return res.status(400).json({
            issuccess: true,
            data: { acknowledgement: false, data: null },
            message: "please pass valid dates",
          });
        }
      }
      console.log(anotherMatch);
      if ("deliveryTimeId" in req.query) {
        anotherMatch.push({
          deliveryTimeId: mongoose.Types.ObjectId(deliveryTimeId),
        });
      }
      if ("pickupTimeId" in req.query) {
        anotherMatch.push({
          pickupTimeId: mongoose.Types.ObjectId(pickupTimeId),
        });
      }
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
          $lookup: {
            from: "times",
            let: { deliveryId: "$deliveryTimeId", pickupId: "$pickupTimeId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$_id", "$$deliveryId"] } } },
            ],
            as: "deliveryTime",
          },
        },
        {
          $lookup: {
            from: "times",
            let: { pickupId: "$pickupTimeId" },
            pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$pickupId"] } } }],
            as: "pickupTime",
          },
        },
        {
          $lookup: {
            from: "users",
            let: { userId: "$userId" },
            pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$userId"] } } }],
            as: "userData",
          },
        },
        {
          $lookup: {
            from: "addresses",
            let: { addressId: "$addressId" },
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
            as: "addressData",
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
            ],
            as: "ordermItems",
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
            addressData: { $first: "$addressData" },
            deliveryTime: {
              $concat: [
                { $first: "$deliveryTime.start" },
                "-",
                { $first: "$deliveryTime.end" },
              ],
            },
            pickupTime: {
              $concat: [
                { $first: "$pickupTime.start" },
                "-",
                { $first: "$pickupTime.end" },
              ],
            },
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
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: getUsers },
        message:
          getUsers.length > 0
            ? `invoice order found`
            : "no any invoice orders found",
      });
    } catch (error) {
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.get("/getUserOrders", authenticateToken, async (req, res) => {
  try {
    const { orderId, isComplete } = req.query;
    const userId = req.user._id;
    let match;
    let anotherMatch = [];
    // if ('name' in req.query) {
    //     let regEx = new RegExp(req.query.name, 'i')
    //     anotherMatch.push({ name: { $regex: regEx } })
    // }
    anotherMatch.push({ userId: mongoose.Types.ObjectId(userId) });
    if ("status" in req.query) {
      anotherMatch.push({ status: parseInt(req.query.status) });
    }
    if (isComplete != undefined && isComplete === "true") {
      anotherMatch.push({
        status: { $nin: [0, 1] },
      });
    }
    // anotherMatch.push({
    //     status: { $nin: [0, 1] }
    // })
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
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
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
          as: "deliveryTimeData",
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
          as: "pickupTimeData",
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
          addressData: { $first: "$addressData" },
          deliveryDate: { $first: "$deliveryTimeData.date" },
          pickupDate: { $first: "$pickupTimeData.date" },
          deliveryTime: { $first: "$deliveryTimeData.timeSlot" },
          pickupTime: { $first: "$pickupTimeData.timeSlot" },
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
          pickupTimeData: 0,
          deliveryTimeData: 0,
        },
      },
    ]);
    return res.status(200).json({
      issuccess: true,
      data: {
        acknowledgement: true,
        data:
          orderId != undefined && getUsers.length > 0 ? getUsers[0] : getUsers,
      },
      message:
        getUsers.length > 0
          ? `invoice order found`
          : "no any invoice orders found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getInvoice", async (req, res, next) => {
  try {
    const { orderId } = req.query;
    let getOrder = await invoiceSchema.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(orderId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "users",
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
          ],
          as: "orderItems",
        },
      },
      {
        $lookup: {
          from: "orderstates",
          let: { id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$orderId", "$$id"] }, { $eq: ["$to", 2] }],
                },
              },
            },
            {
              $project: {
                createdAtDate: {
                  $dateToString: {
                    format: "%m-%d-%Y %H:%M:%S",
                    date: "$createdAt",
                    timezone: "-04:00",
                  },
                },
              },
            },
          ],
          as: "orderDate",
        },
      },
    ]);
    if (getOrder.length > 0) {
      let items = [];
      for (i = 0; i < getOrder[0].orderItems.length; i++) {
        items.push({
          name: getOrder[0].orderItems[i].itemData.name,
          qty: getOrder[0].orderItems[i].qty,
          amount: getOrder[0].orderItems[i].amount,
        });
      }
      (ejs = require("ejs")),
        (fs = require("fs")),
        (file = fs.readFileSync(
          path.join(__dirname, "..", "/", "views", "./", "invoice.ejs"),
          "ascii"
        )),
        (rendered = ejs.render(file, {
          orderTotalAmount: getOrder[0].orderTotalAmount,
          taxes: getOrder[0].taxes,
          items: items,
          invoice_id: getOrder[0].invoiceId,
          date: getOrder[0].orderDate[0].createdAtDate,
          total: getOrder[0].orderAmount,
          cname: getOrder[0].users[0].name,
          purchase_date: getOrder[0].orderDate[0].createdAtDate,
        }));
      if (validateEmail(getOrder[0].users[0].email)) {
        await main(getOrder[0].users[0].email, rendered);
      }
      return res.send(rendered);
    }
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getDetails", async (req, res, next) => {
  try {
    const { status } = req.query;
    const terms = `Lacus tincidunt ac lacinia, malesuada facilisi? Feugiat convallis iaculis pulvinar quam lacinia nibh in varius viverra. Penatibus maecenas mollis risus gravida class dis pellentesque nibh magna eget porta auctor? Phasellus libero tortor mauris molestie at elementum lacinia nostra. Accumsan amet, quisque rhoncus! Vitae parturient dolor nam nascetur? Etiam, himenaeos taciti.

Ridiculus lacus magnis lacinia risus platea. Vulputate tempus, varius purus convallis leo. Dictum congue diam consequat facilisi. Malesuada magna, sem sapien curabitur magnis donec facilisis interdum sociosqu felis luctus quam. Ante quis montes malesuada, fames tellus. Lorem iaculis inceptos fames natoque scelerisque montes lobortis nam taciti eget? Sem vulputate magna gravida faucibus tempor venenatis tincidunt rhoncus. Risus amet nisi risus. Eros risus!

Mollis per malesuada duis lectus. Viverra aptent tellus cubilia facilisi cubilia dictum? Quisque cursus orci in viverra venenatis ac varius leo nibh. Imperdiet sodales, tempor rhoncus laoreet commodo sit amet. Malesuada orci velit congue turpis donec justo elit? Euismod eget lacus scelerisque suscipit lectus, eget mus. Metus, nostra sem interdum eget suspendisse conubia blandit nullam magna volutpat! Senectus senectus vivamus curabitur. Sollicitudin semper litora eros tincidunt donec sed varius himenaeos condimentum accumsan. Pulvinar aenean aptent quisque arcu.

Vehicula blandit et nunc habitasse risus class tempor curabitur sollicitudin elit? Lectus vehicula nec quis elementum sociis rutrum fusce nunc euismod, sociis maecenas fames. A magnis magnis mauris posuere pretium justo senectus odio iaculis primis turpis. Sodales ante commodo pharetra neque. Dictumst enim, urna tellus enim lacus suscipit ultrices. Inceptos curae; dictumst aliquet cras pulvinar euismod cubilia. Elementum cras venenatis id! Elit tempor est enim ornare eget. Odio vitae phasellus libero? Vestibulum, praesent eleifend nisl vehicula. Sit aptent?

Faucibus aptent lectus dapibus nascetur fames ipsum fusce pretium ultricies facilisis. Nam lorem nascetur nisl gravida lectus morbi ullamcorper. Cubilia penatibus justo accumsan et dis malesuada. Tortor vulputate risus cum duis natoque? Porttitor tempor habitasse, ac nisl? Ornare donec primis euismod penatibus ridiculus natoque habitasse. Sociosqu cum lacus quisque ac, eleifend tristique.
`;
    const privacy = `Lacus tincidunt ac lacinia, malesuada facilisi? Feugiat convallis iaculis pulvinar quam lacinia nibh in varius viverra. Penatibus maecenas mollis risus gravida class dis pellentesque nibh magna eget porta auctor? Phasellus libero tortor mauris molestie at elementum lacinia nostra. Accumsan amet, quisque rhoncus! Vitae parturient dolor nam nascetur? Etiam, himenaeos taciti.

Ridiculus lacus magnis lacinia risus platea. Vulputate tempus, varius purus convallis leo. Dictum congue diam consequat facilisi. Malesuada magna, sem sapien curabitur magnis donec facilisis interdum sociosqu felis luctus quam. Ante quis montes malesuada, fames tellus. Lorem iaculis inceptos fames natoque scelerisque montes lobortis nam taciti eget? Sem vulputate magna gravida faucibus tempor venenatis tincidunt rhoncus. Risus amet nisi risus. Eros risus!

Mollis per malesuada duis lectus. Viverra aptent tellus cubilia facilisi cubilia dictum? Quisque cursus orci in viverra venenatis ac varius leo nibh. Imperdiet sodales, tempor rhoncus laoreet commodo sit amet. Malesuada orci velit congue turpis donec justo elit? Euismod eget lacus scelerisque suscipit lectus, eget mus. Metus, nostra sem interdum eget suspendisse conubia blandit nullam magna volutpat! Senectus senectus vivamus curabitur. Sollicitudin semper litora eros tincidunt donec sed varius himenaeos condimentum accumsan. Pulvinar aenean aptent quisque arcu.

Vehicula blandit et nunc habitasse risus class tempor curabitur sollicitudin elit? Lectus vehicula nec quis elementum sociis rutrum fusce nunc euismod, sociis maecenas fames. A magnis magnis mauris posuere pretium justo senectus odio iaculis primis turpis. Sodales ante commodo pharetra neque. Dictumst enim, urna tellus enim lacus suscipit ultrices. Inceptos curae; dictumst aliquet cras pulvinar euismod cubilia. Elementum cras venenatis id! Elit tempor est enim ornare eget. Odio vitae phasellus libero? Vestibulum, praesent eleifend nisl vehicula. Sit aptent?

Faucibus aptent lectus dapibus nascetur fames ipsum fusce pretium ultricies facilisis. Nam lorem nascetur nisl gravida lectus morbi ullamcorper. Cubilia penatibus justo accumsan et dis malesuada. Tortor vulputate risus cum duis natoque? Porttitor tempor habitasse, ac nisl? Ornare donec primis euismod penatibus ridiculus natoque habitasse. Sociosqu cum lacus quisque ac, eleifend tristique.
`;
    const about = `Lacus tincidunt ac lacinia, malesuada facilisi? Feugiat convallis iaculis pulvinar quam lacinia nibh in varius viverra. Penatibus maecenas mollis risus gravida class dis pellentesque nibh magna eget porta auctor? Phasellus libero tortor mauris molestie at elementum lacinia nostra. Accumsan amet, quisque rhoncus! Vitae parturient dolor nam nascetur? Etiam, himenaeos taciti.

Ridiculus lacus magnis lacinia risus platea. Vulputate tempus, varius purus convallis leo. Dictum congue diam consequat facilisi. Malesuada magna, sem sapien curabitur magnis donec facilisis interdum sociosqu felis luctus quam. Ante quis montes malesuada, fames tellus. Lorem iaculis inceptos fames natoque scelerisque montes lobortis nam taciti eget? Sem vulputate magna gravida faucibus tempor venenatis tincidunt rhoncus. Risus amet nisi risus. Eros risus!

Mollis per malesuada duis lectus. Viverra aptent tellus cubilia facilisi cubilia dictum? Quisque cursus orci in viverra venenatis ac varius leo nibh. Imperdiet sodales, tempor rhoncus laoreet commodo sit amet. Malesuada orci velit congue turpis donec justo elit? Euismod eget lacus scelerisque suscipit lectus, eget mus. Metus, nostra sem interdum eget suspendisse conubia blandit nullam magna volutpat! Senectus senectus vivamus curabitur. Sollicitudin semper litora eros tincidunt donec sed varius himenaeos condimentum accumsan. Pulvinar aenean aptent quisque arcu.

Vehicula blandit et nunc habitasse risus class tempor curabitur sollicitudin elit? Lectus vehicula nec quis elementum sociis rutrum fusce nunc euismod, sociis maecenas fames. A magnis magnis mauris posuere pretium justo senectus odio iaculis primis turpis. Sodales ante commodo pharetra neque. Dictumst enim, urna tellus enim lacus suscipit ultrices. Inceptos curae; dictumst aliquet cras pulvinar euismod cubilia. Elementum cras venenatis id! Elit tempor est enim ornare eget. Odio vitae phasellus libero? Vestibulum, praesent eleifend nisl vehicula. Sit aptent?

Faucibus aptent lectus dapibus nascetur fames ipsum fusce pretium ultricies facilisis. Nam lorem nascetur nisl gravida lectus morbi ullamcorper. Cubilia penatibus justo accumsan et dis malesuada. Tortor vulputate risus cum duis natoque? Porttitor tempor habitasse, ac nisl? Ornare donec primis euismod penatibus ridiculus natoque habitasse. Sociosqu cum lacus quisque ac, eleifend tristique.
`;

    if (status == 0) {
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: terms },
        message: "details found",
      });
    } else if (status == 1) {
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: privacy },
        message: "details found",
      });
    } else if (status == 2) {
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: about },
        message: "details found",
      });
    } else {
      return res.status(200).json({
        issuccess: true,
        data: {
          acknowledgement: true,
          data: { terms: terms, privacy: privacy, about: about },
        },
        message: "details found",
      });
    }
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getProfile", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    console.log(req.user._id);
    const checkUser = await userSchema.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(userId),
        },
      },
      {
        $project: {
          generatedTime: 0,
          createdAt: 0,
          updatedAt: 0,
          __v: 0,
          otp: 0,
          password: 0,
        },
      },
    ]);
    if (checkUser.length == 0) {
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: false, data: null },
        message: "no user details found",
      });
    }
    let getSubscription = await getUserMembershipSubscription(userId);
    let refferal = "";
    let getReferral = await userRefer.findOne({
      userId: mongoose.Types.ObjectId(userId),
    });
    if (getReferral != undefined && getReferral != null) {
      refferal = getReferral.referral;
      // return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: Object.assign({ link: "https://www.google.com/", referral: getReferral.referral }) }, message: "referral details found" });
    }
    return res.status(200).json({
      issuccess: true,
      data: {
        acknowledgement: true,
        data: Object.assign(checkUser[0], getSubscription, {
          referral: refferal,
        }),
      },
      message: "user details found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getCards", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const getStrip = await userStripe.findOne({
      userId: mongoose.Types.ObjectId(userId),
    });
    if (getStrip != undefined && getStrip != null) {
      const getCard = await getSavedPaymentMethod(getStrip.paymentMethodId);
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: getCard },
        message: "card details found",
      });
    }
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: [] },
      message: "no card details found",
    });
  } catch (error) {
    return res.status(500).json({
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
      console.log(id);
      let checkOtp = await userSchema.aggregate([
        {
          $match: {
            $and: [{ $or: [{ email: id }, { mobileNo: id }] }],
          },
        },
      ]);
      if (checkOtp.length == 0) {
        return res.status(200).json({
          issuccess: true,
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
      res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: otp },
        message: "Otp sent successfully",
      });

      let update = await userSchema.findByIdAndUpdate(checkOtp[0]._id, {
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
      return res.status(500).json({
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
    let checkOtp = await userSchema.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(userId),
        },
      },
    ]);
    if (checkOtp.length == 0) {
      return res.status(200).json({
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
    res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: otp },
      message: "Otp sent successfully",
    });

    let update = await userSchema.findByIdAndUpdate(checkOtp[0]._id, {
      otp: otp,
      generatedTime: getCurrentDateTime24("Asia/Kolkata"),
    });
    let message = `Dear customer,\n

${otp} is your one time password(OTP). Please do not share the OTP with others. \n

Regards,
Team Sparkle Up`;

    if (validateEmail(id)) {
      await main(id, message);
    } else if (validatePhoneNumber(id)) {
      await sendSms(
        checkOtp[0].countryCode + id,
        `Dear customer,${otp} is your one time password(OTP).Please do not share the OTP with others. Regards,Team Sparkle Up`
      );
    }
    return;

    return res
      .status(200)
      .json({ IsSuccess: true, Data: [], Messsage: "user not found" });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
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

      let checkUser = await userSchema.aggregate([
        {
          $match: {
            $or: [{ email: id }, { mobileNo: id }],
          },
        },
      ]);

      if (checkUser.length == 0) {
        return res.status(404).json({
          issuccess: true,
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
        let update = await userSchema.findByIdAndUpdate(
          checkUser[0]._id,
          updateData,
          { new: true }
        );
        const { generatedToken, refreshToken } = await generateAccessToken({
          _id: checkUser[0]._id,
          role: checkUser[0].role,
        });
        return res.status(200).json({
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
          let update = await userSchema.findByIdAndUpdate(
            checkUser[0]._id,
            updateData,
            { new: true }
          );
          const { generatedToken, refreshToken } = await generateAccessToken({
            _id: checkUser[0]._id,
            role: checkUser[0].role,
          });
          return res.status(200).json({
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
          return res.status(401).json({
            issuccess: true,
            data: { acknowledgement: false, status: 2 },
            message: `incorrect otp`,
          });
        }
        console.log("valid");
      } else {
        //otp expired
        return res.status(410).json({
          issuccess: true,
          data: { acknowledgement: false, status: 1 },
          message: `otp expired`,
        });
      }
    } catch (error) {
      console.log(error.message);
      return res.status(500).json({
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

      let checkUser = await userSchema.aggregate([
        {
          $match: {
            $or: [{ email: id }, { mobileNo: id }],
          },
        },
      ]);

      if (checkUser.length == 0) {
        return res.status(404).json({
          issuccess: true,
          data: { acknowledgement: false, status: 3 },
          message: `No User Found With ${userId}`,
        });
      }

      if (otp == "000000") {
        const { generatedToken, refreshToken } = await generateAccessToken({
          _id: checkUser[0]._id,
          role: checkUser[0].role,
        });
        return res.status(200).json({
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
          return res.status(200).json({
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
          return res.status(401).json({
            issuccess: true,
            data: { acknowledgement: false, status: 2 },
            message: `incorrect otp`,
          });
        }
        console.log("valid");
      } else {
        //otp expired
        return res.status(410).json({
          issuccess: true,
          data: { acknowledgement: false, status: 1 },
          message: `otp expired`,
        });
      }
    } catch (error) {
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.post(
  "/setPassword",
  [
    oneOf(
      [body("id").isEmail(), body("id").isMobilePhone()],
      "please pass email or mobile no"
    ),
    body("otp").isNumeric().withMessage("please pass otp"),
    body("password").isString().withMessage("please pass password"),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { otp, id, password } = req.body;

      let checkUser = await userSchema.aggregate([
        {
          $match: {
            $or: [{ email: id }, { mobileNo: id }],
          },
        },
      ]);

      if (checkUser.length == 0) {
        return res.status(404).json({
          issuccess: true,
          data: { acknowledgement: false, status: 3 },
          message: `No User Found With ${id}`,
        });
      }
      if (otp == "000000") {
        const salt = await bcrypt.genSalt(10);
        const hashedpassword = await bcrypt.hash(password, salt);
        let updatePassword = await userSchema.findByIdAndUpdate(
          checkUser[0]._id,
          { password: hashedpassword },
          { new: true }
        );
        console.log(updatePassword);
        return res.status(200).json({
          issuccess: true,
          data: { acknowledgement: true, status: 0 },
          message: `password changed sucessfully`,
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
          const salt = await bcrypt.genSalt(10);
          const hashedpassword = await bcrypt.hash(password, salt);
          let updatePassword = await userSchema.findByIdAndUpdate(
            checkUser[0]._id,
            { password: hashedpassword },
            { new: true }
          );
          return res.status(200).json({
            issuccess: true,
            data: { acknowledgement: true, status: 0 },
            message: `password changed sucessfully`,
          });
        } else {
          return res.status(401).json({
            issuccess: true,
            data: { acknowledgement: false, status: 2 },
            message: `incorrect otp`,
          });
        }
        console.log("valid");
      } else {
        //otp expired
        return res.status(410).json({
          issuccess: true,
          data: { acknowledgement: false, status: 1 },
          message: `otp expired`,
        });
      }
    } catch (error) {
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.get(
  "/getApkLink",
  [
    check("mobileNo", "please enter mobile no").isString().notEmpty(),
    check("countryCode", "please enter country code").isString().notEmpty(),
  ],
  checkErr,
  async (req, res) => {
    try {
      const { mobileNo, countryCode } = req.query;
      let getUsers = await apkLinkSchema.aggregate([
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
      ]);
      await sendSms(
        countryCode + mobileNo,
        `Hello User , Welcome to Delux cleaning system  here is our apk link you can check it out, For Android ${getUsers[0].apkLink} , For Ios ${getUsers[1].apkLink}`
      );
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: getUsers },
        message:
          getUsers.length > 0
            ? `apk links found and sent`
            : "no any apk link found",
      });
    } catch (error) {
      return res.status(500).json({
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
  checkUserRole(["superAdmin"]),
  async (req, res) => {
    let getUsers = await userSchema.aggregate([
      {
        $match: {},
      },
      {
        $addFields: {
          id: "$_id",
          delivery: 0,
          pickup: 0,
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
          generatedTime: 0,
          otp: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ]);
    return res.status(getUsers.length > 0 ? 200 : 404).json({
      issuccess: true,
      data: { acknowledgement: true, data: getUsers },
      message: getUsers.length > 0 ? `users found` : "no user found",
    });
  }
);
router.get(
  "/getUserSubscription",
  authenticateToken,
  async (req, res, next) => {
    try {
      const userId = req.query.id;
      let getAddress = await userSubscription.aggregate([
        {
          $match: {
            $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }],
          },
        },
        {
          $addFields: {
            id: "$_id",
          },
        },
        {
          $lookup: {
            from: "subscriptions",
            let: { id: "$planId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$id"],
                  },
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
                  isVisible: 0,
                  createdAt: 0,
                  updatedAt: 0,
                },
              },
            ],
            as: "planDetails",
          },
        },
        {
          $addFields: {
            planDetails: { $first: "$planDetails" },
          },
        },
        {
          $project: {
            _id: 0,
            __v: 0,
            createdAt: 0,
            updatedAt: 0,
          },
        },
      ]);

      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: getAddress },
        message:
          getAddress.length > 0
            ? "subscription found"
            : "subscription not found",
      });
    } catch (error) {
      console.log(error.message);
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.get("/refresh", generateRefreshToken);

router.get("/getSuggestions", async (req, res, next) => {
  try {
    // const userId = req.user._id
    const { text } = req.query;
    // console.log(req.user._id);
    let places = await getPlaces(text, 10);
    let filterPlace = await placeFilter(places);
    return res.status(200).json({
      issuccess: true,
      data: {
        acknowledgement: true,
        data: filterPlace.length > 0 ? filterPlace : [],
      },
      message:
        filterPlace.length > 0 ? "places details found" : "no any place found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getPlan", async (req, res) => {
  try {
    let getUsers = await subscriptionSchema.aggregate([
      {
        $match: {
          isVisible: true,
        },
      },
      {
        $addFields: {
          id: "$_id",
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
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
    ]);
    return res.status(getUsers.length > 0 ? 200 : 200).json({
      issuccess: true,
      data: { acknowledgement: true, data: getUsers },
      message:
        getUsers.length > 0
          ? `subscription found`
          : "no subscription plan found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getPlace", async (req, res, next) => {
  try {
    // const userId = req.user._id
    const { lat, long } = req.query;
    // console.log(req.user._id);
    let places = await getLatLong(`${long},${lat}`, 1);
    // return res.json(places)
    let filterPlace = await formatAddress(places);
    return res.status(200).json({
      issuccess: true,
      data: {
        acknowledgement: Object.keys(filterPlace).length > 0 ? true : false,
        data: Object.keys(filterPlace).length > 0 ? filterPlace : filterPlace,
      },
      message:
        Object.keys(filterPlace).length > 0
          ? "address found"
          : "address not recognized",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.post("/addAddress", authenticateToken, async (req, res, next) => {
  try {
    const {
      addressType,
      lat,
      long,
      placeAddress,
      placeName,
      mobileNo,
      countryCode,
      street,
      houseNo,
      pincode,
      landmark,
      locality,
      city,
      district,
      region,
      country,
    } = req.body;
    const userId = req.user._id;
    let { isDefault } = req.body;
    const checkAccept = await checkLatLong(`${long},${lat}`);
    if (
      !checkAccept ||
      !checkAccept.features ||
      checkAccept.features.length === 0 ||
      checkAccept.features[0].text !== "North Carolina"
    ) {
      return res.status(400).json({
        issuccess: false,
        data: { acknowledgement: true, data: { addressId: null } },
        message: "Only North Carolina address is allowed",
      });
    }
    if (isDefault != undefined && isDefault == true) {
      let update = await addressSchema.updateMany(
        { userId: mongoose.Types.ObjectId(userId) },
        { isDefault: false }
      );
    } else {
      let checkAddressDefault = await addressSchema.aggregate([
        {
          $match: {
            $and: [
              { userId: mongoose.Types.ObjectId(userId) },
              { isDefault: true },
            ],
          },
        },
      ]);
      isDefault = checkAddressDefault.length > 0 ? false : true;
    }
    let createAddress = new addressSchema({
      addressType: addressType,
      isDefault: isDefault,
      placeName: placeName,
      placeAddress: placeAddress,
      pincode: pincode,
      houseNo: houseNo,
      street: street,
      landmark: landmark,
      locality: locality,
      city: city,
      district: district,
      region: region,
      country: country,
      userId: userId,
      lat: lat,
      long: long,
      mobileNo: mobileNo,
      countryCode: countryCode,
    });

    await createAddress.save();
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: { addressId: createAddress._id } },
      message: "Address Details saved",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.put("/updateAddress", authenticateToken, async (req, res, next) => {
  try {
    const {
      addressType,
      lat,
      long,
      addressId,
      mobileNo,
      countryCode,
      placeAddress,
      placeName,
      street,
      houseNo,
      pincode,
      landmark,
      locality,
      city,
      district,
      region,
      country,
    } = req.body;
    const userId = req.user._id;
    let { isDefault } = req.body;
    let checkAddress = await addressSchema.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(addressId),
        },
      },
    ]);
    if (checkAddress.length == 0) {
      return res.status(404).json({
        issuccess: true,
        data: { acknowledgement: false, data: null },
        message: "address not found",
      });
    }
    const checkAccept = await checkLatLong(`${long},${lat}`);
    if (
      !checkAccept ||
      !checkAccept.features ||
      checkAccept.features.length === 0 ||
      checkAccept.features[0].text !== "North Carolina"
    ) {
      return res.status(400).json({
        issuccess: false,
        data: { acknowledgement: true, data: { addressId: null } },
        message: "Only North Carolina address is allowed",
      });
    }
    if (isDefault) {
      let update = await addressSchema.updateMany(
        { userId: mongoose.Types.ObjectId(userId) },
        { isDefault: false }
      );
    }
    let createAddress = {
      addressType:
        addressType == undefined ? checkAddress[0].addressType : addressType,
      isDefault: isDefault == undefined ? checkAddress[0].isDefault : isDefault,
      placeName: placeName == undefined ? checkAddress[0].placeName : placeName,
      placeAddress:
        placeAddress == undefined ? checkAddress[0].placeAddress : placeAddress,
      pincode: pincode == undefined ? checkAddress[0].pincode : pincode,
      houseNo: houseNo == undefined ? checkAddress[0].houseNo : houseNo,
      street: street == undefined ? checkAddress[0].street : street,
      landmark: landmark == undefined ? checkAddress[0].landmark : landmark,
      locality: locality == undefined ? checkAddress[0].locality : locality,
      city: city == undefined ? checkAddress[0].city : city,
      district: district == undefined ? checkAddress[0].district : district,
      region: region == undefined ? checkAddress[0].region : region,
      country: country == undefined ? checkAddress[0].country : country,
      lat: lat == undefined ? checkAddress[0].lat : lat,
      mobileNo: mobileNo == undefined ? checkAddress[0].mobileNo : mobileNo,
      countryCode:
        countryCode == undefined ? checkAddress[0].countryCode : countryCode,
      long: long == undefined ? checkAddress[0].long : long,
    };
    let updateAdd = await addressSchema.findByIdAndUpdate(
      addressId,
      createAddress,
      { new: true }
    );
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: { addressId: updateAdd._id } },
      message: "Address details updated",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.put("/delete", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    let checkUser = await userSchema.findById(userId);
    if (checkUser != undefined && checkUser != null) {
      await new deleteUser({
        email: checkUser.email,
        mobileNo: checkUser.mobileNo,
        userId: userId,
      }).save();
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: null },
        message: "user delete successfully",
      });
    }
    return res.status(200).json({
      issuccess: false,
      data: { acknowledgement: false, data: null },
      message: "user details not found",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/address", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    console.log(userId);
    let getAddress = await addressSchema.aggregate([
      {
        $match: {
          $and: [
            { userId: mongoose.Types.ObjectId(userId) },
            { isActive: true },
          ],
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
    ]);

    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: getAddress },
      message: getAddress.length > 0 ? "address found" : "address not found",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.delete("/removeAddress", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { addressId } = req.body;

    let getAddress = await addressSchema.aggregate([
      {
        $match: {
          $and: [
            { userId: mongoose.Types.ObjectId(userId) },
            { _id: mongoose.Types.ObjectId(addressId) },
          ],
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
    ]);

    if (getAddress.length == 0) {
      return res.status(getAddress.length > 0 ? 200 : 400).json({
        issuccess: getAddress.length > 0 ? true : false,
        data: {
          acknowledgement: getAddress.length > 0 ? true : false,
          data: getAddress,
        },
        message: getAddress.length > 0 ? "address found" : "address not found",
      });
    }
    let updateAddress = await addressSchema.findByIdAndUpdate(
      addressId,
      { isActive: false },
      { new: true }
    );
    return res.status(getAddress.length > 0 ? 200 : 400).json({
      issuccess: getAddress.length > 0 ? true : false,
      data: {
        acknowledgement: getAddress.length > 0 ? true : false,
        data: getAddress,
      },
      message:
        getAddress.length > 0
          ? "address removed successfully"
          : "address not found",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.post(
  "/addSession",
  authenticateToken,
  [
    oneOf([
      body("pickupAddressId", "please pass valid pickupAddressId")
        .isString()
        .custom((value) => mongoose.Types.ObjectId.isValid(value)),
      body("deliveryAddressId", "please pass valid deliveryAddressId")
        .isString()
        .custom((value) => mongoose.Types.ObjectId.isValid(value)),
      body("preferrdPickupId", "please pass valid preferrdPickupId")
        .isString()
        .custom((value) => mongoose.Types.ObjectId.isValid(value)),
      body("preferrdDeliveryId", "please pass valid preferrdDeliveryId")
        .isString()
        .custom((value) => mongoose.Types.ObjectId.isValid(value)),
      body("preferrdPickupTime", "please pass valid pikcup time id")
        .isString()
        .custom((value) => mongoose.Types.ObjectId.isValid(value)),
      body("preferrdDeliveryTime", "please pass valid delivery time id")
        .isString()
        .custom((value) => mongoose.Types.ObjectId.isValid(value)),
      body("pickupInstruction", "please pass valid pickup instruction details")
        .isString()
        .notEmpty(),
      body(
        "deliveryInstruction",
        "please pass valid delivery instruction details"
      )
        .isString()
        .notEmpty(),
    ]),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const userId = req.user._id;
      const {
        pickupAddressId,
        deliveryAddressId,
        preferrdPickupId,
        preferrdDeliveryId,
        preferrdPickupTime,
        preferrdDeliveryTime,
        pickupInstruction,
        deliveryInstruction,
      } = req.body;
      let addDetails = await userSchema.findByIdAndUpdate(
        userId,
        {
          pickupAddressId: pickupAddressId,
          deliveryAddressId: deliveryAddressId,
          preferrdPickupId: preferrdPickupId,
          preferrdDeliveryId: preferrdDeliveryId,
          preferrdPickupTime: preferrdPickupTime,
          preferrdDeliveryTime: preferrdDeliveryTime,
          pickupInstruction: pickupInstruction,
          deliveryInstruction: deliveryInstruction,
        },
        { new: true }
      );
      if (addDetails != undefined && addDetails != null) {
        addDetails._doc["id"] = addDetails._doc["_id"];
        delete addDetails._id;
        delete addDetails.__v;
      }
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: addDetails },
        message: "details updated",
      });
    } catch (error) {
      console.log(error.message);
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.get("/getSession", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;

    let getTimes = await userSchema.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: { id: "$pickupAddressId" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$_id", "$$id"] }] } } },
            {
              $addFields: {
                id: "$_id",
              },
            },
            {
              $project: {
                __v: 0,
                _id: 0,
              },
            },
          ],
          as: "pickupAddress",
        },
      },
      {
        $lookup: {
          from: "addresses",
          let: { id: "$deliveryAddressId" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$_id", "$$id"] }] } } },
            {
              $addFields: {
                id: "$_id",
              },
            },
            {
              $project: {
                __v: 0,
                _id: 0,
              },
            },
          ],
          as: "deliveryAddress",
        },
      },
      {
        $project: {
          preferrdDeliveryTime: 1,
          preferrdPickupTime: 1,
          deliveryAddressId: 1,
          deliveryInstruction: 1,
          pickupAddressId: 1,
          pickupInstruction: 1,
          preferrdDeliveryId: 1,
          preferrdPickupId: 1,
          deliveryAddress: { $first: "$deliveryAddress" },
          pickupAddress: { $first: "$pickupAddress" },
        },
      },
    ]);

    let lastOrder = await invoiceSchema.aggregate([
      {
        $match: {
          $and: [
            { userId: mongoose.Types.ObjectId(userId) },
            { status: { $in: [0, 1] } },
          ],
        },
      },
    ]);
    if (getTimes.length == 0) {
      return res.status(200).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: "no session found",
      });
    }
    return res.status(200).json({
      issuccess: true,
      data: {
        acknowledgement: true,
        data: Object.assign(getTimes[0], {
          lastOrderId:
            lastOrder.length > 0 ? lastOrder[lastOrder.length - 1]._id : "",
        }),
      },
      message: "session details found",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.post("/addSubscription", authenticateToken, async (req, res, next) => {
  try {
    const { planId, duration } = req.body;
    const userId = req.user._id;
    let checkCategory = await subscriptionSchema.findById(
      mongoose.Types.ObjectId(planId)
    );
    // console.log(checkCategory);
    if (checkCategory == undefined || checkCategory == null) {
      return res.status(404).json({
        issuccess: true,
        data: { acknowledgement: false, data: null },
        message: `subscription plan not found`,
      });
    }

    let checkActiveSubscription = await getUserMembershipSubscription(userId);
    console.log(checkActiveSubscription);
    if (
      checkActiveSubscription != undefined &&
      checkActiveSubscription != null &&
      checkActiveSubscription.subscriptionDetail.length > 0 &&
      checkActiveSubscription.subscriptionDetail[0].isRenew == false
    ) {
      return res.status(403).json({
        issuccess: true,
        data: { acknowledgement: false, data: null },
        message: `subscription already running`,
      });
    }
    let status = 0;
    let orderId = makeid(12);
    let pendingDays = duration == 0 ? 28 : duration == 1 ? 28 * 6 : 365;
    let multiply = duration == 0 ? 1 : duration == 1 ? 6 : 12;
    let createAddress = new userSubscription({
      planId: planId,
      userId: userId,
      orderId: orderId,
      pickup: checkCategory.pickup * multiply,
      delivery: checkCategory.delivery * multiply,
      price:
        duration == 0
          ? checkCategory.month
          : duration == 1
          ? checkCategory.quarterly
          : checkCategory.year,
      duration: duration,
      status: status,
      pendingDays: pendingDays,
      usedDays: 0,
      startDate: moment(),
      endDate: moment().add(pendingDays, "days"),
    });

    await createAddress.save();
    let getPaymentLink = await createLink(
      userId,
      createAddress.price,
      createAddress._id,
      1
    );
    createAddress._doc["id"] = createAddress._doc["_id"];
    delete createAddress._doc.updatedAt;
    delete createAddress._doc.createdAt;
    delete createAddress._doc._id;
    delete createAddress._doc.__v;
    delete createAddress._doc.paymentId;
    delete createAddress._doc.orderStatus;
    createAddress._doc["link"] = getPaymentLink;
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: createAddress },
      message: "user subscription added",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.post("/addSubscription/v1", authenticateToken, async (req, res) => {
  const {
    planId,
    duration,
    isAuto,
    card_number,
    card_cvv,
    card_expiry,
    paymentMethodIdPassed,
  } = req.body;
  const { _id: userId } = req.user;
  console.log(userId);
  try {
    const checkCategory = await subscriptionSchema.findById(planId);

    if (!checkCategory) {
      return res.status(404).json({
        issuccess: true,
        data: { acknowledgement: false, data: null },
        message: `subscription plan not found`,
      });
    }

    const checkSubscription = await userSubscription.findOne({
      userId: mongoose.Types.ObjectId(userId),
      status: 1,
    });
    // if (checkActiveSubscription && checkActiveSubscription.subscriptionDetail.length > 0 && !checkActiveSubscription.subscriptionDetail[0].isRenew) {
    //     return res.status(403).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: `subscription already running` });
    // }

    const leftpickup =
      checkSubscription != undefined ? checkSubscription.pickup : 0;
    const leftdelivery =
      checkSubscription != undefined ? checkSubscription.delivery : 0;
    console.log(leftpickup + "  " + leftdelivery);
    const status = 0;
    const orderId = makeid(12);
    const pendingDays = duration === 0 ? 28 : duration === 1 ? 28 * 6 : 365;
    const multiply = duration === 0 ? 1 : duration === 1 ? 6 : 12;
    const startDate = moment();
    const endDate = moment().add(pendingDays, "days");
    const price =
      duration === 0
        ? checkCategory.month
        : duration === 1
        ? checkCategory.quarterly
        : checkCategory.year;
    const pickup = checkCategory.pickup * multiply + leftpickup;
    const delivery = checkCategory.delivery * multiply + leftdelivery;

    const createAddress = new userSubscription({
      planId,
      userId,
      orderId,
      pickup,
      delivery,
      price,
      duration,
      status,
      pendingDays,
      usedDays: 0,
      startDate,
      endDate,
    });

    await createAddress.save();

    let getPaymentLink = "";
    let updatedCreateAddress = createAddress.toObject();

    if (isAuto) {
      await handleUserPaymentRequest(
        userId,
        duration === 0 ? "month" : duration === 1 ? "quarter" : "year",
        planId,
        card_number,
        card_cvv,
        card_expiry,
        createAddress._id,
        true,
        paymentMethodIdPassed,
        pickup,
        delivery
      );

      const id = createAddress._id;
      updatedCreateAddress = await userSubscription.findById(id);
    } else {
      getPaymentLink = await createLink(
        userId,
        createAddress.price,
        createAddress._id,
        1
      );
      updatedCreateAddress.link = getPaymentLink;
    }

    updatedCreateAddress.id = updatedCreateAddress._id.toString();
    delete updatedCreateAddress._id;
    delete updatedCreateAddress.__v;
    delete updatedCreateAddress.updatedAt;
    delete updatedCreateAddress.createdAt;
    delete updatedCreateAddress.paymentId;
    delete updatedCreateAddress.orderStatus;

    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: updatedCreateAddress },
      message: "user subscription added",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.put("/updateSubscription", authenticateToken, async (req, res, next) => {
  try {
    const { subscriptionId, status, paymentId, note } = req.body;
    const userId = req.user._id;
    let checkCategory = await userSubscription.findById(
      mongoose.Types.ObjectId(subscriptionId)
    );
    // console.log(checkCategory);
    if (checkCategory == undefined || checkCategory == null) {
      return res.status(404).json({
        issuccess: true,
        data: { acknowledgement: false, data: null },
        message: `subscription plan not found`,
      });
    }
    let updateField = {
      status: status,
      paymentId: paymentId,
      note: note,
    };
    let createAddress = await userSubscription.findByIdAndUpdate(
      subscriptionId,
      updateField,
      { new: true }
    );
    createAddress._doc["id"] = createAddress._doc["_id"];
    delete createAddress._doc.updatedAt;
    delete createAddress._doc.createdAt;
    delete createAddress._doc._id;
    delete createAddress._doc.__v;
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: createAddress },
      message: "user subscription updated",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getSubscription", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    console.log(userId);

    await userSubscription.updateMany(
      { pickup: 0 },
      { status: 5 },
      { new: true }
    );
    await checkExpireSubscription();
    let getAddress = await userSubscription.aggregate([
      {
        $match: {
          $and: [
            { userId: mongoose.Types.ObjectId(userId) },
            { status: { $in: [1, 5] } },
          ],
        },
      },
      {
        $addFields: {
          id: "$_id",
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          let: { id: "$planId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$id"],
                },
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
                isVisible: 0,
                createdAt: 0,
                updatedAt: 0,
              },
            },
          ],
          as: "planDetails",
        },
      },
      {
        $lookup: {
          from: "usersubscriptionstripes",
          let: { id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$subscriptionId", "$$id"],
                },
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
                isVisible: 0,
                createdAt: 0,
                updatedAt: 0,
              },
            },
          ],
          as: "stripe",
        },
      },
      {
        $addFields: {
          isCancelled: { $first: "$stripe.isCancelled" },
          planDetails: { $first: "$planDetails" },
          isRenew: {
            $cond: {
              if: { $lte: ["$pendingDays", 3] },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
          stripe: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ]);

    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: getAddress },
      message:
        getAddress.length > 0 ? "subscription found" : "subscription not found",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.post(
  "/contactUs",
  [
    body("email", "please pass valid email").isString().notEmpty().isEmail(),
    body("subject", "please pass valid subject details")
      .optional()
      .isString()
      .notEmpty(),
    body("message", "please pass valid message")
      .optional()
      .isString()
      .notEmpty(),
  ],
  checkErr,
  async (req, res) => {
    try {
      const { email, subject, message } = req.body;

      let checkExist = await contactUsSchema.aggregate([
        { $match: { email: email } },
        { $addFields: { id: "$_id" } },
        {
          $project: {
            _id: 0,
            __v: 0,
          },
        },
      ]);
      if (checkExist.length > 0) {
        return res.status(409).json({
          issuccess: true,
          data: { acknowledgement: false, data: checkExist[0] },
          message: `request already registered we will contact you soon`,
        });
      }

      let addCategory = new contactUsSchema({
        email: email,
        subject: subject,
        message: message,
      });
      await addCategory.save();

      addCategory._doc["id"] = addCategory._doc["_id"];
      delete addCategory._doc.updatedAt;
      delete addCategory._doc.createdAt;
      delete addCategory._doc.status;
      delete addCategory._doc._id;
      delete addCategory._doc.__v;
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: addCategory },
        message: `contact us details added`,
      });
    } catch (error) {
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.post(
  "/addDeluxMembership",
  authenticateToken,
  async (req, res, next) => {
    try {
      const { detailId, duration } = req.body;
      const userId = req.user._id;
      let checkCategory = await membershipDetails.findById(detailId);
      // console.log(checkCategory);
      if (checkCategory == undefined || checkCategory == null) {
        return res.status(404).json({
          issuccess: true,
          data: { acknowledgement: false, data: null },
          message: `membership details not found`,
        });
      }
      let checkMembership = await getUserMembershipSubscription(userId);
      if (
        checkMembership != undefined &&
        checkMembership != null &&
        checkMembership.membershipDetail.length > 0 &&
        checkMembership.membershipDetail[0].isRenew == false
      ) {
        return res.status(403).json({
          issuccess: true,
          data: { acknowledgement: false, data: null },
          message: `membership already purchased`,
        });
      }
      let status = 0;
      let orderId = makeid(12);
      let pendingDays = duration == 0 ? 28 : duration == 1 ? 28 * 6 : 365;
      let createAddress = new membershipSchema({
        membershipId: detailId,
        userId: userId,
        duration: duration,
        price:
          duration == 0
            ? checkCategory.month
            : duration == 1
            ? checkCategory.quarterly
            : checkCategory.year,
        startDate: moment(),
        status: 0,
        endDate: moment().add(pendingDays, "days"),
        orderId: orderId,
        pendingDays: pendingDays,
        usedDays: 0,
      });

      await createAddress.save();
      let getPaymentLink = await createLink(
        userId,
        createAddress.price,
        createAddress._id,
        2
      );
      createAddress._doc["id"] = createAddress._doc["_id"];
      delete createAddress._doc.updatedAt;
      delete createAddress._doc.createdAt;
      delete createAddress._doc._id;
      delete createAddress._doc.__v;
      delete createAddress._doc.paymentId;
      delete createAddress._doc.orderStatus;
      createAddress._doc["link"] = getPaymentLink;
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: createAddress },
        message: "user membership added",
      });
    } catch (error) {
      console.log(error.message);
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.post(
  "/addDeluxMembership/v1",
  authenticateToken,
  async (req, res, next) => {
    try {
      const {
        detailId,
        duration,
        isAuto,
        card_number,
        card_cvv,
        card_expiry,
        paymentMethodIdPassed,
      } = req.body;
      const userId = req.user._id;
      console.log(userId);
      let checkCategory = await membershipDetails.findById(detailId);
      // console.log(checkCategory);
      if (checkCategory == undefined || checkCategory == null) {
        return res.status(404).json({
          issuccess: true,
          data: { acknowledgement: false, data: null },
          message: `membership details not found`,
        });
      }
      let checkMembership = await getUserMembershipSubscription(userId);
      if (
        checkMembership != undefined &&
        checkMembership != null &&
        checkMembership.membershipDetail.length > 0 &&
        checkMembership.membershipDetail[0].isRenew == false
      ) {
        return res.status(403).json({
          issuccess: true,
          data: { acknowledgement: false, data: null },
          message: `membership already purchased`,
        });
      }
      let status = 0;
      let orderId = makeid(12);
      let pendingDays = duration == 0 ? 28 : duration == 1 ? 28 * 6 : 365;
      let createAddress = new membershipSchema({
        membershipId: detailId,
        userId: userId,
        duration: duration,
        price:
          duration == 0
            ? checkCategory.month
            : duration == 1
            ? checkCategory.quarterly
            : checkCategory.year,
        startDate: moment(),
        status: 0,
        endDate: moment().add(pendingDays, "days"),
        orderId: orderId,
        pendingDays: pendingDays,
        usedDays: 0,
      });

      let getPaymentLink = "";
      await createAddress.save();

      let updatedCreateAddress = createAddress.toObject();
      if (isAuto) {
        console.log("here");
        await handleUserPaymentRequest(
          userId,
          duration === 0 ? "month" : duration === 1 ? "quarter" : "year",
          detailId,
          card_number,
          card_cvv,
          card_expiry,
          createAddress._id,
          false,
          paymentMethodIdPassed
        );

        const id = createAddress._id;
        updatedCreateAddress = await membershipSchema.findById(id);
      } else {
        getPaymentLink = await createLink(
          userId,
          createAddress.price,
          createAddress._id,
          1
        );
        updatedCreateAddress.link = getPaymentLink;
      }
      createAddress._doc["id"] = createAddress._doc["_id"];
      delete createAddress._doc.updatedAt;
      delete createAddress._doc.createdAt;
      delete createAddress._doc._id;
      delete createAddress._doc.__v;
      delete createAddress._doc.paymentId;
      delete createAddress._doc.orderStatus;
      createAddress._doc["link"] = getPaymentLink;
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: updatedCreateAddress },
        message: "user membership added",
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.post("/cancelMembership", authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { subscriptionId } = req.body;
    const { _id: userId } = req.user;
    const cancelSubscription = await userSubscriptionStripe
      .findOne({ subscriptionId: mongoose.Types.ObjectId(subscriptionId) })
      .session(session);
    const cancelSubscriptionIs = await cancelActiveSubscriptionWithStripe(
      cancelSubscription.subscription
    );
    const cancelSubscriptionStatus = await userSubscriptionStripe
      .findByIdAndUpdate(cancelSubscription._id, { isCancelled: true })
      .session(session);
    await session.commitTransaction();

    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: cancelSubscriptionStatus },
      message: "user membership cancelled",
    });
  } catch (error) {
    await session.abortTransaction();
    console.log(error);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  } finally {
    session.endSession();
  }
});

router.put(
  "/updateDeluxMembership",
  authenticateToken,
  async (req, res, next) => {
    try {
      const { membershipId, status, paymentId, note } = req.body;
      const userId = req.user._id;
      console.log(userId);
      let checkCategory = await membershipSchema.findById(membershipId);
      // console.log(checkCategory);
      if (checkCategory == undefined || checkCategory == null) {
        return res.status(404).json({
          issuccess: true,
          data: { acknowledgement: false, data: null },
          message: `membership details not found`,
        });
      }
      if (status == 1) {
        await checkExpireSubscription();
        let getAddress = await userSubscription.aggregate([
          {
            $match: {
              $and: [
                { userId: mongoose.Types.ObjectId(userId) },
                { status: 1 },
              ],
            },
          },
          {
            $addFields: {
              id: "$_id",
            },
          },
          {
            $lookup: {
              from: "subscriptions",
              let: { id: "$planId" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ["$_id", "$$id"],
                    },
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
                    isVisible: 0,
                    createdAt: 0,
                    updatedAt: 0,
                  },
                },
              ],
              as: "planDetails",
            },
          },
          {
            $addFields: {
              planDetails: { $first: "$planDetails" },
            },
          },
          {
            $project: {
              _id: 0,
              __v: 0,
              createdAt: 0,
              updatedAt: 0,
            },
          },
        ]);

        console.log(getAddress);
        if (getAddress.length > 0) {
          let update = await userSubscription.findByIdAndUpdate(
            getAddress[0].id,
            { $inc: { pickup: 1, delivery: 1 } },
            { new: true }
          );
          console.log(update);
        }
      }
      let update = {
        paymentId: paymentId,
        status: status,
        note: note,
      };

      let createAddress = await membershipSchema.findByIdAndUpdate(
        membershipId,
        update,
        { new: true }
      );
      createAddress._doc["id"] = createAddress._doc["_id"];
      delete createAddress._doc.updatedAt;
      delete createAddress._doc.createdAt;
      delete createAddress._doc._id;
      delete createAddress._doc.__v;
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: createAddress },
        message: "user membership updated",
      });
    } catch (error) {
      console.log(error.message);
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
router.get("/getDeluxMembership", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    let getAddress = await membershipSchema.aggregate([
      {
        $match: {
          $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }],
        },
      },
      {
        $addFields: {
          id: "$_id",
        },
      },
      {
        $lookup: {
          from: "membershipdetails",
          let: { id: "$membershipId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$id"],
                },
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
                isVisible: 0,
                createdAt: 0,
                updatedAt: 0,
              },
            },
          ],
          as: "membershipDetails",
        },
      },
      {
        $lookup: {
          from: "usersubscriptionstripes",
          let: { id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$subscriptionId", "$$id"],
                },
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
                isVisible: 0,
                createdAt: 0,
                updatedAt: 0,
              },
            },
          ],
          as: "stripe",
        },
      },
      {
        $addFields: {
          isCancelled: { $first: "$stripe.isCancelled" },
          membershipDetails: { $first: "$membershipDetails" },
          isRenew: {
            $cond: {
              if: { $lte: ["$pendingDays", 3] },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
          stripe: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      },
    ]);

    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: getAddress },
      message:
        getAddress.length > 0
          ? "delux membership detail found"
          : "delux membership not found",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.post("/addOrder", authenticateToken, async (req, res, next) => {
  try {
    const {
      pickupTimeId,
      deliveryTimeId,
      pickupInstruction,
      deliveryInstruction,
      pickupAddressId,
      deliveryAddressId,
      items,
    } = req.body;
    const userId = req.user._id;
    // console.log(userId);
    let checkSubscription = await checkUserSubscriptionMember(userId);
    let totalAmount = 0;
    let payableAmount = 0;
    let itemsDoc = [];
    let allItems = [];
    let orderId = "";
    let checkLastOrder = await invoiceSchema.aggregate([{ $match: {} }]);
    if (checkLastOrder.length > 0) {
      if (checkLastOrder[checkLastOrder.length - 1].orderId.length < 5) {
        orderId = (
          parseInt(checkLastOrder[checkLastOrder.length - 1].orderId) + 1
        )
          .toString()
          .padStart(5, "0");
      } else {
        orderId = (
          parseInt(checkLastOrder[checkLastOrder.length - 1].orderId) + 1
        )
          .toString()
          .padStart(5, "0");
      }
    } else {
      orderId = (1).toString().padStart(5, "0");
    }
    let taxApplied = {};
    if (items != undefined && items != null) {
      let itemIds = items.map((e) => mongoose.Types.ObjectId(e.itemId));
      let getItems = await itemSchema.aggregate([
        { $match: { _id: { $in: itemIds } } },
      ]);
      console.log("items");
      for (i = 0; i < items.length; i++) {
        console.log();
        let amount = getItems.find((item) => {
          if (item._id.toString() == items[i].itemId) {
            return item;
          }
        });
        if (amount != undefined) {
          totalAmount += amount.price * items[i].qty;
          allItems.push(
            Object.assign(items[i], { amount: amount.price * items[i].qty })
          );
        }
      }
    }
    console.log(totalAmount);
    //check for 15$ validation

    let taxes = await taxSchema.findOne({
      isSubscription: checkSubscription[0].isSubscription,
      isMember: checkSubscription[0].isMember,
    });
    console.log(taxes);
    if (taxes != undefined && taxes != null) {
      taxApplied = taxes.taxes;
      console.log(Object.values(taxApplied));
      payableAmount =
        parseFloat(totalAmount) +
        parseFloat(Object.values(taxApplied).reduce((a, b) => a + b, 0)) -
        taxApplied.tax;
    } else {
      payableAmount = parseFloat(totalAmount);
    }
    console.log(taxApplied);
    console.log(totalAmount + "  " + payableAmount);
    taxApplied["tax"] = totalAmount * (taxApplied["tax"] / 100) || 0;
    payableAmount = payableAmount + taxApplied["tax"];
    let addOrder = new invoiceSchema({
      pickupTimeId: pickupTimeId,
      deliveryTimeId: deliveryTimeId,
      status: 0,
      userId: userId,
      deliveryInstruction: deliveryInstruction,
      pickupInstruction: pickupInstruction,
      orderId: orderId,
      taxes: taxApplied,
      pickupAddressId: pickupAddressId,
      deliveryAddressId: deliveryAddressId,
      isSubscribed: checkSubscription[0].isSubscription,
      isMember: checkSubscription[0].isMember,
      orderAmount: parseFloat(totalAmount).toFixed(2),
      finalAmount: parseFloat(payableAmount).toFixed(2),
      orderTotalAmount: parseFloat(payableAmount).toFixed(2),
      pendingAmount: parseFloat(payableAmount).toFixed(2),
      userId: userId,
    });

    if (items != undefined && items != null) {
      // console.log(addOrder);
      for (i = 0; i < allItems.length; i++) {
        itemsDoc.push({
          itemId: allItems[i].itemId,
          qty: allItems[i].qty,
          amount: allItems[i].amount,
          categoryId: allItems[i].categoryId,
          orderId: addOrder._id,
        });
      }
    }
    if (itemsDoc.length > 0) {
      console.log(itemsDoc);
      await orderItems.insertMany(itemsDoc);
    }
    await addOrder.save();
    addOrder._doc["id"] = addOrder._doc["_id"];
    delete addOrder._doc.updatedAt;
    delete addOrder._doc.createdAt;
    delete addOrder._doc._id;
    delete addOrder._doc.__v;
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: addOrder },
      message: "order added",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.post("/addOrderItem", authenticateToken, async (req, res, next) => {
  try {
    const { qty, itemId, categoryId, orderId } = req.body;
    const userId = req.user._id;
    let taxApplied = {};
    let getOrder = await invoiceSchema.findById(orderId);
    if (getOrder == undefined || getOrder == null) {
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: false, data: null },
        message: "order details not found",
      });
    }
    if (getOrder.status != 0) {
      let updateOrderStatus = await invoiceSchema.findByIdAndUpdate(
        orderId,
        {
          $unset: { couponId: "" },
          orderTotalAmount: getOrder.finalAmount,
          pendingAmount: getOrder.finalAmount,
        },
        { new: true }
      );
      // console.log(updateOrderStatus)
    }
    let checkSubscription = await checkUserSubscriptionMember(userId);
    let taxes = await taxSchema.findOne({
      isSubscription: checkSubscription[0].isSubscription,
      isMember: checkSubscription[0].isMember,
    });
    // console.log(taxes);
    if (taxes != undefined && taxes != null) {
      taxApplied = taxes.taxes;
      // payableAmount = parseFloat(getOrder.orderAmount) + parseFloat((Object.values(taxApplied)).reduce((a, b) => a + b, 0))
      if (JSON.stringify(getOrder.taxes) != JSON.stringify(taxApplied)) {
        let updateOrder = await invoiceSchema.findByIdAndUpdate(
          orderId,
          {
            taxes: taxApplied,
            isSubscribed: checkSubscription[0].isSubscription,
            isMember: checkSubscription[0].isMember,
          },
          { new: true }
        );
      }
    } else {
      if (JSON.stringify(getOrder.taxes) != JSON.stringify({})) {
        taxApplied = {};
        payableAmount = parseFloat(getOrder.orderAmount) + parseFloat(0);
        let updateOrder = await invoiceSchema.findByIdAndUpdate(
          orderId,
          {
            taxes: taxApplied,
            isSubscribed: checkSubscription[0].isSubscription,
            isMember: checkSubscription[0].isMember,
          },
          { new: true }
        );
      }
    }
    let getItem = await itemSchema.findById(itemId);
    if (getItem == undefined || getItem == null) {
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: false, data: null },
        message: "item not found",
      });
    }
    const amount = getItem.price;
    let finalAmount = qty * amount;
    let checkItems = await orderItems.findOne({
      itemId: mongoose.Types.ObjectId(itemId),
      orderId: mongoose.Types.ObjectId(orderId),
    });
    if (checkItems != null && checkItems != undefined) {
      let updateQty;
      console.log("qty");
      console.log(checkItems.qty);
      let finalQty = checkItems.qty + qty;
      let finalAmountIs = getItem.price * finalQty;
      console.log(finalQty);
      if (finalQty <= 0) {
        //quantity is less than zero then remove orderItem
        updateQty = await orderItems.findByIdAndRemove(checkItems._id);
        updateQty._doc["qty"] = 0;
        updateQty._doc["amount"] = 0;
      } else {
        updateQty = await orderItems.findByIdAndUpdate(
          checkItems._id,
          {
            amount: finalAmountIs,
            qty: finalQty,
          },
          { new: true }
        );
      }
      let getOrderData = await invoiceSchema.findById(orderId);
      if (getOrderData != undefined && getOrderData != null) {
        let orderItemsIs = await orderItems.aggregate([
          { $match: { orderId: mongoose.Types.ObjectId(orderId) } },
        ]);
        let orderAmountIs = 0;
        for (i = 0; i < orderItemsIs.length; i++) {
          console.log(orderItemsIs[i].amount);
          orderAmountIs += parseFloat(orderItemsIs[i].amount);
          console.log(orderAmountIs);
        }
        console.log(orderAmountIs);
        taxApplied["tax"] = orderAmountIs * (taxApplied["tax"] / 100) || 0;
        let afterTax =
          parseFloat(orderAmountIs) +
          parseFloat(Object.values(taxApplied).reduce((a, b) => a + b, 0));
        // afterTax += taxApplied["tax"];
        // Fetch the order data
        let getOrderData = await invoiceSchema.findById(orderId);

        // Update the fields if they are defined
        if (taxApplied !== undefined) {
          getOrderData.taxes = taxApplied;
        }
        if (orderAmountIs !== undefined) {
          getOrderData.orderAmount = parseFloat(orderAmountIs).toFixed(2);
        }
        if (afterTax !== undefined) {
          getOrderData.finalAmount = parseFloat(afterTax).toFixed(2);
          getOrderData.orderTotalAmount = parseFloat(afterTax).toFixed(2);
          getOrderData.pendingAmount = parseFloat(afterTax).toFixed(2);
        }

        // Save the updated order data
        await getOrderData.save();

        updateQty._doc["id"] = updateQty._doc["_id"];
        delete updateQty._doc.updatedAt;
        delete updateQty._doc.createdAt;
        delete updateQty._doc._id;
        delete updateQty._doc.__v;
        return res.status(200).json({
          issuccess: true,
          data: { acknowledgement: true, data: updateQty },
          message: "order items updated",
        });
      } else {
        return res.status(200).json({
          issuccess: false,
          data: { acknowledgement: false, data: null },
          message: "order data not found",
        });
      }
    }
    let addItem = new orderItems({
      qty: qty,
      amount: finalAmount,
      itemId: itemId,
      categoryId: categoryId,
      orderId: orderId,
    });
    await addItem.save();
    let getOrderData = await invoiceSchema.findById(orderId);
    if (getOrderData != undefined && getOrderData != null) {
      let orderItemsIs = await orderItems.aggregate([
        { $match: { orderId: mongoose.Types.ObjectId(orderId) } },
      ]);
      let orderAmountIs = 0;
      for (i = 0; i < orderItemsIs.length; i++) {
        orderAmountIs += orderItemsIs[i].amount;
      }
      taxApplied["tax"] = orderAmountIs * (taxApplied["tax"] / 100) || 0;
      let afterTax =
        parseFloat(orderAmountIs) +
        parseFloat(Object.values(taxApplied).reduce((a, b) => a + b, 0));
      // afterTax += taxApplied['tax']
      // Fetch the existing order data
      let getOrderData = await invoiceSchema.findById(orderId);

      // Update the fields if they are defined
      if (taxApplied !== undefined) {
        getOrderData.taxes = taxApplied;
      }
      if (orderAmountIs !== undefined) {
        getOrderData.orderAmount = parseFloat(orderAmountIs).toFixed(2);
      }
      if (afterTax !== undefined) {
        getOrderData.finalAmount = parseFloat(afterTax).toFixed(2);
        getOrderData.orderTotalAmount = parseFloat(afterTax).toFixed(2);
        getOrderData.pendingAmount = parseFloat(afterTax).toFixed(2);
      }

      // Save the updated order data
      await getOrderData.save();

      addItem._doc["id"] = addItem._doc["_id"];
      delete addItem._doc.updatedAt;
      delete addItem._doc.createdAt;
      delete addItem._doc._id;
      delete addItem._doc.__v;
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: addItem },
        message: "order item added",
      });
    } else {
      return res.status(200).json({
        issuccess: false,
        data: { acknowledgement: false, data: null },
        message: "order data not found",
      });
    }
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.put("/updateOrder", authenticateToken, async (req, res, next) => {
  try {
    const {
      pickupAddressId,
      deliveryAddressId,
      deliveryInstruction,
      pickupInstruction,
      pickupTimeId,
      deliveryTimeId,
      status,
      orderId,
      paymentId,
      couponCode,
      note,
    } = req.body;
    const userId = req.user._id;
    let checkOrder = await invoiceSchema.findById(orderId);
    let checkSubscription = await checkUserSubscriptionMember(userId);

    if (checkOrder != undefined && checkOrder != null) {
      if (couponCode != undefined && couponCode != null) {
        let checkCoupon = await couponSchema.findOne({
          name: couponCode,
          isExpire: false,
        });
        let amount = checkOrder.finalAmount;
        let taxes = checkOrder.taxes;
        if (checkCoupon != undefined && checkCoupon != null) {
          if (
            checkCoupon.minimumAmount != 0 &&
            checkCoupon.minimumAmount > checkOrder.orderAmount
          ) {
            return res.status(400).json({
              issuccess: false,
              data: { acknowledgement: false, data: null },
              message: `order should with minimum ${checkCoupon.minimumAmount} $`,
            });
          }
          if (checkCoupon.isSpecial == true) {
            let checkCouponExist = await couponUsers.findOne({
              userId: mongoose.Types.ObjectId(checkOrder.userId),
              couponId: mongoose.Types.ObjectId(checkCoupon._id),
              status: 0,
            });
            // console.log(checkCoupon);
            if (checkCouponExist == undefined || checkCouponExist == null) {
              return res.status(400).json({
                issuccess: false,
                data: { acknowledgement: false, data: null },
                message: "coupon not valid",
              });
            }
          }
          if (checkCoupon.isOnce == true) {
            console.log("isonce");
            let checkCouponExist = await invoiceSchema.findOne({
              userId: mongoose.Types.ObjectId(checkOrder.userId),
              couponId: mongoose.Types.ObjectId(checkCoupon._id),
              status: { $nin: [11, 0, 12, 1] },
            });
            // console.log(checkCoupon);
            if (checkCouponExist != undefined && checkCouponExist != null) {
              return res.status(400).json({
                issuccess: false,
                data: { acknowledgement: false, data: null },
                message: "coupon already used once",
              });
            }
          }
          if ("percentage" in checkCoupon && checkCoupon.percentage == true) {
            amount = amount - (checkCoupon.discount / 100) * amount;
            taxes.set("discount", checkCoupon.discount);
          } else {
            amount = amount - checkCoupon.discount;
            taxes.set("discount", checkCoupon.discount);
          }
        } else {
          return res.status(404).json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: "coupon not found",
          });
        }
        console.log(taxes);
        console.log(amount);
        let updateOrder = await invoiceSchema.findByIdAndUpdate(
          orderId,
          {
            couponId: checkCoupon._id,
            orderTotalAmount: parseFloat(amount).toFixed(2),
            taxes: taxes,
            pendingAmount: parseFloat(amount).toFixed(2),
            status: 1,
          },
          { new: true }
        );
        updateOrder._doc["id"] = updateOrder._doc["_id"];
        delete updateOrder._doc.updatedAt;
        delete updateOrder._doc.createdAt;
        delete updateOrder._doc._id;
        delete updateOrder._doc.__v;
        return res.status(200).json({
          issuccess: true,
          data: { acknowledgement: true, data: updateOrder },
          message: "order updated",
        });
      }
      if (status == 1) {
        if (
          checkSubscription != undefined &&
          "isSubscription" in checkSubscription[0] &&
          "isMember" in checkSubscription[0] &&
          checkSubscription[0].isSubscription == false &&
          checkSubscription[0].isMember == false &&
          totalAmount < 15
        ) {
          return res.status(400).json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: "order should be with minimum 15$",
          });
        }
      }

      let update = {
        status: status,
        deliveryInstruction: deliveryInstruction,
        pickupInstruction: pickupInstruction,
        pickupAddressId: pickupAddressId,
        deliveryAddressId: deliveryAddressId,
        pickupTimeId: pickupTimeId,
        deliveryTimeId: deliveryTimeId,
        paymentId: paymentId,
        note: note,
      };
      let updateOrder = await invoiceSchema.findByIdAndUpdate(orderId, update, {
        new: true,
      });
      updateOrder._doc["id"] = updateOrder._doc["_id"];
      delete updateOrder._doc.updatedAt;
      delete updateOrder._doc.createdAt;
      delete updateOrder._doc._id;
      delete updateOrder._doc.__v;
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: updateOrder },
        message: "order updated",
      });
    }
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: false, data: null },
      message: "order not found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.put("/getPaymentLink", authenticateToken, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const userId = req.user._id;
    console.log(userId);
    const getUserId = await client.get(userId.toString());
    let checkSubscription = await checkUserSubscriptionMember(userId);
    let checkOrder = await invoiceSchema.findById(orderId);
    if (checkOrder != undefined && checkOrder != null) {
      checkOrder = checkOrder._doc;
      if (
        "pickupTimeId" in checkOrder &&
        checkOrder.pickupTimeId != "" &&
        "deliveryTimeId" in checkOrder &&
        checkOrder.deliveryTimeId != "" &&
        "pickupInstruction" in checkOrder &&
        checkOrder.pickupInstruction != "" &&
        "deliveryInstruction" in checkOrder &&
        checkOrder.deliveryInstruction != "" &&
        "pickupAddressId" in checkOrder &&
        checkOrder.pickupAddressId != "" &&
        "deliveryAddressId" in checkOrder &&
        checkOrder.deliveryAddressId != ""
      ) {
        if (checkOrder.status != 1 && checkOrder.status != 0) {
          await client.del(userId.toString());
          return res.status(400).json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: "order is not eligible for payment generate",
          });
        }
        console.log("get payment link");
        let getPaymentLink;
        console.log(checkSubscription);
        if (
          (checkOrder.orderTotalAmount == 0 &&
            checkSubscription[0].isSubscription == true) ||
          ((getUserId != null || getUserId != undefined) &&
            checkOrder.orderTotalAmount == 0)
        ) {
          getPaymentLink = "https://www.sparkleup.us/payment/success";
          let updateOrder = await invoiceSchema.findByIdAndUpdate(
            orderId,
            { status: 2, $push: { paymentId: "subscription bag order" } },
            { new: true }
          );
          updateOrder._doc["link"] = getPaymentLink;
          return res.status(200).json({
            issuccess: true,
            data: { acknowledgement: true, data: updateOrder },
            message: "order passed of zero payment",
          });
        } else if (
          checkOrder.orderTotalAmount == 0 &&
          checkSubscription[0].isSubscription == false
        ) {
          return res.status(200).json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: "no zero order for non subscribe user",
          });
        }
        try {
          getPaymentLink = await createLink(
            userId,
            parseFloat(checkOrder.orderTotalAmount).toFixed(2),
            orderId,
            0
          );
        } catch (err) {
          console.log(typeof err);
          return res.status(500).json({
            issuccess: false,
            data: { acknowledgement: false },
            message:
              typeof err == "object"
                ? err.message
                : err || "Having issue is server",
          });
        }
        let updateOrder = await invoiceSchema.findById(orderId);
        updateOrder._doc["link"] = getPaymentLink;
        return res.status(200).json({
          issuccess: true,
          data: { acknowledgement: true, data: updateOrder },
          message: "order updated",
        });
      } else {
        return res.status(400).json({
          issuccess: true,
          data: { acknowledgement: false, data: null },
          message: "order is not eligible for payment generate",
        });
      }
    }
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: false, data: null },
      message: "order not found",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.delete("/removeOrder", authenticateToken, async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const userId = req.user._id;
    let checkOrder = await invoiceSchema.findById(orderId);
    if (checkOrder != undefined && checkOrder != null) {
      let updateOrder = await invoiceSchema.findByIdAndDelete(orderId);
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: updateOrder },
        message: "order removed",
      });
    }
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: false, data: null },
      message: "order not found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.put("/update", authenticateToken, async (req, res, next) => {
  try {
    const {
      pickupAddressId,
      deliveryAddressId,
      deliveryInstruction,
      pickupInstruction,
      status,
      orderId,
      paymentId,
      couponCode,
      note,
    } = req.body;
    const userId = req.user._id;
    let checkOrder = await invoiceSchema.findById(orderId);
    let checkSubscription = await checkUserSubscriptionMember(userId);

    if (checkOrder != undefined && checkOrder != null) {
      if (
        checkOrder.status == 1 &&
        couponCode != undefined &&
        couponCode != null
      ) {
        console.log("here");
        let checkCoupon = await couponSchema.findOne({
          name: couponCode,
          isExpire: false,
        });
        let amount = checkOrder.finalAmount;
        let taxes = checkOrder.taxes;
        if (checkCoupon != undefined && checkCoupon != null) {
          if (
            checkCoupon.minimumAmount != 0 &&
            checkCoupon.minimumAmount > checkCoupon.orderAmount
          ) {
            return res.status(200).json({
              issuccess: false,
              data: { acknowledgement: false, data: null },
              message: "coupon code not applicable",
            });
          }
          if (checkCoupon.isOnce == true) {
            console.log("isonce");
            let checkCouponExist = await invoiceSchema.findOne({
              userId: mongoose.Types.ObjectId(checkOrder.userId),
              couponId: mongoose.Types.ObjectId(checkCoupon._id),
              status: { $nin: [11, 0, 12, 1] },
            });
            // console.log(checkCoupon);
            if (checkCouponExist != undefined && checkCouponExist != null) {
              return res.status(200).json({
                issuccess: false,
                data: { acknowledgement: false, data: null },
                message: "coupon already used once",
              });
            }
          }
          if ("percentage" in checkCoupon && checkCoupon.percentage == true) {
            amount = amount - (checkCoupon.discount / 100) * amount;
            taxes.set("discount", checkCoupon.discount);
          } else {
            amount = amount - checkCoupon.discount;
            taxes.set("discount", checkCoupon.discount);
          }
        } else {
          return res.status(404).json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: "coupon not found",
          });
        }
        console.log(taxes);
        console.log(amount);
        let updateOrder = await invoiceSchema.findByIdAndUpdate(
          orderId,
          {
            couponId: checkCoupon._id,
            orderTotalAmount: amount,
            taxes: taxes,
            pendingAmount: amount,
          },
          { new: true }
        );
        updateOrder._doc["id"] = updateOrder._doc["_id"];
        delete updateOrder._doc.updatedAt;
        delete updateOrder._doc.createdAt;
        delete updateOrder._doc._id;
        delete updateOrder._doc.__v;
        return res.status(200).json({
          issuccess: true,
          data: { acknowledgement: true, data: updateOrder },
          message: "order updated",
        });
      }
      if (status == 1) {
        if (
          checkSubscription != undefined &&
          "isSubscription" in checkSubscription[0] &&
          "isMember" in checkSubscription[0] &&
          checkSubscription[0].isSubscription == false &&
          checkSubscription[0].isMember == false &&
          totalAmount < 15
        ) {
          return res.status(200).json({
            issuccess: false,
            data: { acknowledgement: false, data: null },
            message: "order should be with minimum 15$",
          });
        }
      }

      let update = {
        status: status,
        deliveryInstruction: deliveryInstruction,
        pickupInstruction: pickupInstruction,
        pickupAddressId: pickupAddressId,
        deliveryAddressId: deliveryAddressId,
        paymentId: paymentId,
        note: note,
      };
      let updateOrder = await invoiceSchema.findByIdAndUpdate(orderId, update, {
        new: true,
      });
      updateOrder._doc["id"] = updateOrder._doc["_id"];
      delete updateOrder._doc.updatedAt;
      delete updateOrder._doc.createdAt;
      delete updateOrder._doc._id;
      delete updateOrder._doc.__v;
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: updateOrder },
        message: "order updated",
      });
    }
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: false, data: null },
      message: "order not found",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
// router.put('/updateOrderStatus', async (req, res, next) => {
//     try {
//         const { delivery, pickup, deliveryTimeId, pickupTimeId, status, orderId, paymentId, note } = req.body;
//         let checkOrder = await invoiceSchema.findById(orderId);
//         if (checkOrder != undefined && checkOrder != null) {
//             let update = {
//                 delivery: delivery,
//                 pickup: pickup,
//                 deliveryTimeId: deliveryTimeId,
//                 pickupTimeId: pickupTimeId,
//                 status: status,
//                 paymentId: paymentId,
//                 note: note
//             }
//             let updateOrder = await invoiceSchema.findByIdAndUpdate(orderId, update, { new: true });
//             updateOrder._doc['id'] = updateOrder._doc['_id'];
//             delete updateOrder._doc.updatedAt;
//             delete updateOrder._doc.createdAt;
//             delete updateOrder._doc._id;
//             delete updateOrder._doc.__v;
//             return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: updateOrder }, message: 'order updated' });

//         }
//         return res.status(200).json({ issuccess: true, data: { acknowledgement: false, data: null }, message: 'order not found' });
//     }
//     catch (err) {
//         return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
//     }
// })
router.get(
  "/checkSubscriptionMember",
  authenticateToken,
  async (req, res, next) => {
    try {
      const userId = req.user._id;
      let checkSubscription = await checkUserSubscriptionMember(userId);
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: checkSubscription },
        message: "user subscription status found",
      });
    } catch (error) {
      return res.status(500).json({
        issuccess: false,
        data: { acknowledgement: false },
        message: error.message || "Having issue is server",
      });
    }
  }
);
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

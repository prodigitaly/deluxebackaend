var express = require("express");
var router = express.Router();
const moment = require("moment");
const momentTz = require("moment-timezone");
require("dotenv").config();
const bcrypt = require("bcrypt");
const { default: mongoose, mongo } = require("mongoose");
const userSchema = require("../../models/userModel");
const {
  getCurrentDateTime24,
  makeid,
  createLink,
} = require("../../utility/dates");
const nodemailer = require("nodemailer");
const { check, body, oneOf } = require("express-validator");
const { main } = require("../../utility/mail");
const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const { sendSms } = require("../../utility/sendSms");
const admin = require("../../utility/setup/firebase-admin");
const {
  getPlaces,
  placeFilter,
  formatAddress,
  getLatLong,
  checkLatLong,
} = require("../../utility/mapbox");
const {
  generateAccessToken,
  authenticateToken,
  generateRefreshToken,
} = require("../../middleware/authMobile");
const addressSchema = require("../../models/addressSchema");
const { checkErr } = require("../../utility/error");
const userSubscription = require("../../models/userSubscription");
const subscriptionSchema = require("../../models/subscriptionSchema");
const bodySchema = require("../../models/bodySchema");
const {
  checkUserSubscriptionMember,
  checkExpireSubscription,
  nextDays,
  checkExpireMemberShip,
  nextDaysReplace,
  getUserMembershipSubscription,
  checkUserSubscriptionMemberWithCancel,
  sendMail,
} = require("../../utility/expiration");
const invoiceSchema = require("../../models/invoiceSchema");
const contactUsSchema = require("../../models/contactUsSchema");
const dayWiseSchema = require("../../models/dayWiseSchema");
const membershipDetails = require("../../models/membershipDetails");
const membershipSchema = require("../../models/membershipSchema");
const { getAuth, UserRecord } = require("firebase-admin/auth");
const userRefer = require("../../models/userRefer");
const referred = require("../../models/referred");
const couponSchema = require("../../models/couponSchema");
const couponUsers = require("../../models/couponUsers");
const fcmToken = require("../../models/fcmToken");
const redis = require("../../utility/setup/redis");
const userNotification = require("../../models/userNotification");
const client = require("../../utility/setup/redis");
const {
  handleUserPaymentRequest,
  getSavedPaymentMethod,
  cancelActiveSubscription,
  cancelActiveSubscriptionWithStripe,
} = require("../../utility/payment");
const userStripe = require("../../models/userStripe");
const userSubscriptionStripe = require("../../models/userSubscriptionStripe");
const deleteUser = require("../../models/deleteUser");
/* GET home page. */
router.get("/", async function (req, res, next) {
  console.log(validatePhoneNumber("9999999999"));
  console.log(validateEmail("abc@gmail.com"));
  res.render("index", { title: "Express" });
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
router.post(
  "/signUp",
  [
    body("email").isEmail().withMessage("please pass email id"),
    body("password")
      .not()
      .isEmpty()
      .isString()
      .withMessage("please pass password"),
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

      if (checkExist.length > 0) {
        return res.status(200).json({
          issuccess: false,
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
        email: email,
        password: password,
      });

      await userIs.save();
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
        Messsage: "user successfully signed up",
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
        return res.status(200).json({
          issuccess: false,
          data: { acknowledgement: false, data: checkExist },
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
router.post("/signUpWithGoogle", async (req, res, next) => {
  try {
    // console.log(req.body)
    const { uid } = req.body;
    // getAuth().getUser(uid).then((userRecord) => {
    //     console.log(userRecord);
    // }).catch((error) => {
    //     console.log('Error fetching user data:', error);
    // });
    console.log(uid);
    if (uid == undefined) {
      return res.status(401).json({
        issuccess: false,
        data: null,
        message: "please check id token in request",
      });
    }
    await new bodySchema({
      token: uid,
    }).save();

    let checkRevoked = true;
    getAuth()
      .getUser(uid)
      .then(async (payload) => {
        console.log(payload.providerData[0].email);
        console.log(typeof payload.providerData);
        console.log("token is valid in payload");
        // Token is valid.
        const { email } = payload.providerData[0];
        const name = payload.providerData[0].displayName;
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
            issuccess: true,
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
          issuccess: true,
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
            issuccess: false,
            data: null,
            message: "user revoked app permissions",
          });
          // Token has been revoked   . Inform the user to reauthenticate or signOut() the user.
        } else {
          console.log("token is invalid");
          return res
            .status(401)
            .json({ issuccess: false, data: null, message: "invalid token" });
          // Token is invalid.
        }
      });

    // return res.status(200).json({ issuccess: true, data: null, message: "done" });
    // let checkRevoked = true;
    // getAuth()
    //     .verifyIdToken(idToken, checkRevoked)
    //     .then(async (payload) => {
    //         // console.log(payload)
    //         console.log("token is valid in payload")
    //         // Token is valid.
    //         const { name, email, password, mobileNo, role } = payload;
    //         // console.log(email.toString())
    //         let checkExist = await userSchema.aggregate([
    //             {
    //                 $match: {
    //                     email: email
    //                 }
    //             }
    //         ]);
    //         // console.log(checkExist);
    //         if (checkExist.length > 0) {
    //             let user = {
    //                 _id: checkExist[0]._id,
    //                 timestamp: Date.now()
    //             }

    //             const { generatedToken, refreshToken } = await generateAccessToken(user);
    //             return res.status(200).json({ isSuccess: true, data: { user: { email: checkExist[0].email, name: checkExist[0].name, id: checkExist[0]._id, role: checkExist[0].role }, token: generatedToken, refreshToken: refreshToken }, message: "user successully found" });
    //         }

    //         // const userLoginIs = new userLogin({
    //         //   userName: userName,
    //         //   password: password
    //         // });

    //         // await userLoginIs.save();

    //         const userIs = new userSchema({
    //             name: name,
    //             email: email,
    //             mobileNo: mobileNo,
    //             role: "user",
    //             password: password
    //         });

    //         await userIs.save();
    //         // console.log(userIs)
    //         let user = {
    //             _id: userIs._id,
    //             role: "user",
    //             timestamp: Date.now()
    //         }
    //         const { generatedToken, refreshToken } = await generateAccessToken(user);
    //         return res.status(200).json({
    //             isSuccess: true, data: {
    //                 user: {
    //                     email: userIs.email, name: userIs.name, id: userIs._id, role: userIs.role
    //                 }, token: generatedToken, refreshToken: refreshToken
    //             }, message: "user successfully signed up"
    //         });
    //     })
    //     .catch((error) => {
    //         console.log(error.message)
    //         if (error.code == 'auth/id-token-revoked') {
    //             console.log("token is revoked")
    //             return res.status(200).json({ isSuccess: false, data: null, message: "user revoked app permissions" });
    //             // Token has been revoked   . Inform the user to reauthenticate or signOut() the user.
    //         } else {
    //             console.log("token is invalid")
    //             return res.status(200).json({ isSuccess: false, data: null, message: "invalid token" });
    //             // Token is invalid.
    //         }
    //     });
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
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { mobileNo, countryCode } = req.body;
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

        // console.log(otp);
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

      // console.log(otp);
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
        return res.status(200).json({
          issuccess: false,
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

      if (checkExist.length > 0) {
        if (!("password" in checkExist[0])) {
          return res.status(200).json({
            issuccess: false,
            data: { acknowledgement: false, data: null, status: 4 },
            message: "sign in with google instead",
          });
        }
        if (!(await bcrypt.compare(password, checkExist[0].password))) {
          return res.status(200).json({
            issuccess: false,
            data: { acknowledgement: false, data: null, status: 1 },
            message: "Incorrect Password",
          });
        }
        checkExist[0]["id"] = checkExist[0]["_id"];
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
        delete checkExist[0].__v;
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
      return res.status(200).json({
        issuccess: false,
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
//pending for mobile no and email verification issue
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
        return res.status(200).json({
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
          return res.status(200).json({
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
        const getOtp = await client.get(checkCategory._id.toString());
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
            return res.status(200).json({
              issuccess: false,
              data: { acknowledgement: false, status: 2 },
              message: `incorrect otp`,
            });
          }
          console.log("valid");
        } else {
          //otp expired
          return res.status(200).json({
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
      delete getUser._doc.generatedTime;
      delete getUser._doc.otp;
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
  "/addDeluxMembership",
  authenticateToken,
  async (req, res, next) => {
    try {
      const { detailId, duration, paymentId } = req.body;
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
      let checkMembership = await membershipSchema.aggregate([
        {
          $match: {
            $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }],
          },
        },
        {
          $addFields: {
            isRenew: {
              $cond: {
                if: { $lte: ["$pendingDays", 3] },
                then: true,
                else: false,
              },
            },
          },
        },
      ]);
      if (checkMembership.length > 0 && checkMembership[0].isRenew == false) {
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
        price:
          duration == 0
            ? checkCategory.month
            : duration == 1
            ? checkCategory.quarterly
            : checkCategory.year,
        startDate: moment(),
        endDate: moment().add(pendingDays, "days"),
        orderId: orderId,
        duration: duration,
        paymentId: paymentId,
        status: status,
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
    await userSubscriptionStripe
      .updateOne(
        { subscriptionId: mongoose.Types.ObjectId(subscriptionId) },
        { isCancelled: true }
      )
      .session(session);
    await session.commitTransaction();

    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: cancelSubscription },
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
router.post("/addReferral", authenticateToken, async (req, res, next) => {
  try {
    const { referralCode } = req.body;
    const userId = req.user._id;
    let referral = makeid(6);
    await new userRefer({ referral: referral, userId: userId }).save();

    let getReferral = await userRefer.findOne({ referral: referralCode });
    if (getReferral == undefined || getReferral == null) {
      return res.status(200).json({
        issuccess: false,
        data: { acknowledgement: false, data: {} },
        message: "not valid referral code",
      });
    }
    // console.log(getReferral)
    let getUserRef = await referred.aggregate([
      {
        $match: {
          $and: [
            { referredBy: mongoose.Types.ObjectId(getReferral.userId) },
            { referredTo: mongoose.Types.ObjectId(userId) },
          ],
        },
      },
    ]);
    if (getUserRef.length > 0) {
      return res.status(200).json({
        issuccess: false,
        data: { acknowledgement: false, data: {} },
        message: "already referral added",
      });
    }
    // console.log(getUserRef.length)
    // console.log("saved")
    let referredIs = await new referred({
      referredBy: getReferral.userId,
      referredTo: userId,
    }).save();
    // console.log(referredIs)
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
        userId: userId,
      }).save();
    }

    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: {} },
      message: "user referral added",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});

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
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: createAddress },
      message: "user fcm details added",
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.put(
  "/updateDeluxMembership",
  authenticateToken,
  async (req, res, next) => {
    try {
      const { membershipId, status, paymentId, note } = req.body;
      const userId = req.user._id;
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
                { status: 0 },
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
            getAddress[0]._id,
            { $inc: { pickup: 1, delivery: 1 } },
            { new: true }
          );
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
router.get("/getNotifications", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;

    let currentDate = momentTz().tz("America/Panama").format();
    // await checkExpireMemberShip();
    // let getAddress = await membershipSchema.aggregate([
    //     {
    //         $match: {
    //             $and: [
    //                 { userId: mongoose.Types.ObjectId(userId) },
    //                 { status: { $nin: [2, 3] } }
    //             ]
    //         }
    //     },
    //     {
    //         $addFields: {
    //             "id": "$_id"
    //         }
    //     },
    //     {
    //         $lookup: {
    //             from: "membershipdetails",
    //             let: { id: "$membershipId" },
    //             pipeline: [{
    //                 $match: {
    //                     $expr: {
    //                         $eq: ["$_id", "$$id"]
    //                     }
    //                 }
    //             },
    //             {
    //                 $addFields: {
    //                     "id": "$_id"
    //                 }
    //             },
    //             {
    //                 $project: {
    //                     _id: 0,
    //                     __v: 0,
    //                     isVisible: 0,
    //                     createdAt: 0,
    //                     updatedAt: 0
    //                 }
    //             }],
    //             as: "membershipDetails"
    //         }
    //     },
    //     {
    //         $addFields: {
    //             membershipDetails: { $first: "$membershipDetails" }
    //         }
    //     },
    //     {
    //         $project: {
    //             _id: 0,
    //             __v: 0,
    //             createdAt: 0,
    //             updatedAt: 0
    //         }
    //     }
    // ]);

    let getAddress = [
      {
        id: "638ba7353a10402074216990",
        image:
          "https://delux-cleaner.s3.ap-south-1.amazonaws.com/icons/1670298132352zOeefXosOy.png",
        title: "title",
        description: "description",
        notificationType: 0,
        createdAt: "2022-11-09T05:24:26.838Z",
      },
      {
        id: "638ba7353a10402074216990",
        image:
          "https://delux-cleaner.s3.ap-south-1.amazonaws.com/icons/1670298132352zOeefXosOy.png",
        title: "title",
        description: "description",
        notificationType: 1,
        createdAt: "2022-11-09T05:24:26.838Z",
      },
      {
        id: "638ba7353a10402074216990",
        image:
          "https://delux-cleaner.s3.ap-south-1.amazonaws.com/icons/1670298132352zOeefXosOy.png",
        title: "title",
        description: "description",
        notificationType: 0,
        createdAt: "2022-11-09T05:24:26.838Z",
      },
      {
        id: "638ba7353a10402074216990",
        image:
          "https://delux-cleaner.s3.ap-south-1.amazonaws.com/icons/1670298132352zOeefXosOy.png",
        title: "title",
        description: "description",
        notificationType: 1,
        createdAt: "2022-11-09T05:24:26.838Z",
      },
      {
        id: "638ba7353a10402074216990",
        image:
          "https://delux-cleaner.s3.ap-south-1.amazonaws.com/icons/1670298132352zOeefXosOy.png",
        title: "title",
        description: "description",
        notificationType: 0,
        createdAt: "2022-11-09T05:24:26.838Z",
      },
    ];
    const getNotification = await userNotification.aggregate([
      {
        $match: { userId: mongoose.Types.ObjectId(userId) },
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
                    $and: [{ $gte: ["$hours", 1] }, { $gte: ["$minutes", 60] }],
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
                  then: { $concat: [{ $toString: "$minutes" }, " minute ago"] },
                },
              ],
              default: { $concat: [{ $toString: "$seconds" }, " seconds ago"] },
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
    let updateNotification = await userNotification.updateMany(
      { userId: mongoose.Types.ObjectId(userId) },
      { isSeen: true },
      { new: true }
    );
    if (getNotification.length > 0) {
      return res.status(200).json({
        issuccess: true,
        data: { acknowledgement: true, data: getNotification },
        message: "notification found",
      });
    }
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: getNotification },
      message: "notification not found",
    });
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
router.get("/getDeluxMembership", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;
    let andIs = [];
    if (status) {
      andIs = [
        { userId: mongoose.Types.ObjectId(userId) },
        { status: { $nin: [2, 3] } },
        { status: parseInt(status) },
      ];
    } else {
      andIs = [
        { userId: mongoose.Types.ObjectId(userId) },
        { status: { $nin: [2, 3] } },
      ];
    }
    // await checkExpireMemberShip();
    let getAddress = await membershipSchema.aggregate([
      {
        $match: {
          $and: andIs,
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
        $addFields: {
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
        $addFields: {
          id: "$_id",
        },
      },
      {
        $project: {
          generatedTime: 0,
          createdAt: 0,
          updatedAt: 0,
          __v: 0,
          _id: 0,
          otp: 0,
          password: 0,
        },
      },
    ]);
    if (checkUser.length == 0) {
      return res.status(200).json({
        issuccess: false,
        data: { acknowledgement: false, data: null },
        message: "no user details found",
      });
    }
    let isSubscriptionRenew = false;
    let isMembershipRenew = false;
    let checkActiveSubscription = await userSubscription.aggregate([
      {
        $match: {
          $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }],
        },
      },
      {
        $addFields: {
          isRenew: {
            $cond: {
              if: { $lte: ["$pendingDays", 3] },
              then: true,
              else: false,
            },
          },
        },
      },
    ]);
    let checkMembership = await membershipSchema.aggregate([
      {
        $match: {
          $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }],
        },
      },
      {
        $addFields: {
          isRenew: {
            $cond: {
              if: { $lte: ["$pendingDays", 3] },
              then: true,
              else: false,
            },
          },
        },
      },
    ]);
    if (checkActiveSubscription.length > 0) {
      isSubscriptionRenew = checkActiveSubscription[0].isRenew;
    }
    if (checkMembership.length > 0) {
      isMembershipRenew = checkMembership[0].isRenew;
    }
    let getPendingOrder = await invoiceSchema.aggregate([
      {
        $match: {
          $and: [
            { userId: mongoose.Types.ObjectId(userId) },
            { status: { $in: [2, 3, 4] } },
          ],
        },
      },
    ]);
    let getCompletedOrder = await invoiceSchema.aggregate([
      {
        $match: {
          $and: [
            { userId: mongoose.Types.ObjectId(userId) },
            { status: { $in: [5, 6, 7, 8, 9] } },
          ],
        },
      },
    ]);
    let getSubscriptionDetail = await checkUserSubscriptionMember(userId);
    let getAddress = await userSubscription.aggregate([
      {
        $match: {
          $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }],
        },
      },
      {
        $addFields: {
          id: "$_id",
          validity: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$duration", 0] },
                  then: "1 month validity",
                },
                { case: { $eq: ["$duration", 1] }, then: "6 month validity" },
                { case: { $eq: ["$duration", 2] }, then: "1 year validity" },
              ],
              default: "no any plan",
            },
          },
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
        $addFields: {
          planDetails: { $first: "$planDetails" },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
    ]);
    let validityPlan = "no any plan";
    let totalPickup = "no any pickup you have";
    let leftPickup = "no any pickup left";
    let pickupPercentage = 0;
    let deliveryPercentage = 0;
    let dayPercentage = 0;
    let pendingDays = 0;
    if (getAddress.length > 0) {
      let multiply =
        getAddress[0].duration == 0 ? 1 : getAddress[0].duration == 1 ? 6 : 12;
      leftPickup = getAddress[0].pickup;
      let delivery = getAddress[0].delivery;
      totalPickup = getAddress[0].planDetails.pickup * multiply;
      let useddelivery = getAddress[0].planDetails.delivery * multiply;
      pickupPercentage = (leftPickup * 100) / totalPickup;
      deliveryPercentage = (delivery * 100) / useddelivery;
      pendingDays = getAddress[0].pendingDays;
      validityPlan = getAddress[0].validity;
      let totalDays =
        getAddress[0].duration == 0
          ? 28
          : getAddress[0].duration == 1
          ? 28 * 6
          : 365;
      dayPercentage = (pendingDays * 100) / totalDays;
      leftPickup +=
        getAddress[0].duration == 0
          ? " pickup left"
          : getAddress[0].duration == 1
          ? " pickup left"
          : " pickup left";
      totalPickup +=
        getAddress[0].duration == 0
          ? " pickups monthly"
          : getAddress[0].duration == 1
          ? " pickups quartly"
          : " pickups yearly";
    }
    if (pickupPercentage > 100) {
      pickupPercentage = 100;
    }
    if (deliveryPercentage > 100) {
      deliveryPercentage = 100;
    }
    if (dayPercentage > 100) {
      dayPercentage = 100;
    }
    pickupPercentage = Math.round(pickupPercentage * 100) / 100;
    deliveryPercentage = Math.round(deliveryPercentage * 100) / 100;
    dayPercentage = Math.round(dayPercentage * 100) / 100;
    let getPendingNotification = await userNotification.aggregate([
      {
        $match: {
          $and: [
            { isSeen: false },
            { userId: mongoose.Types.ObjectId(userId) },
          ],
        },
      },
    ]);
    return res.status(200).json({
      issuccess: true,
      data: {
        acknowledgement: true,
        data: Object.assign(
          {
            pendingPickups: getPendingOrder.length,
            pendingDelivery: getCompletedOrder.length,
          },
          checkUser[0],
          {
            validityPlan: validityPlan,
            totalPickup: totalPickup,
            leftPickup: leftPickup,
            pickupPercentage: pickupPercentage,
            deliveryPercentage: deliveryPercentage,
            dayPercentage: dayPercentage,
            pendingDays: pendingDays,
            notificationCount: getPendingNotification.length,
            isSubscriptionRenew: isSubscriptionRenew,
            isMembershipRenew: isMembershipRenew,
          },
          {
            isSubscription: getSubscriptionDetail[0].isSubscription,
            isMember: getSubscriptionDetail[0].isMember,
          }
        ),
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
router.get("/getProfile_v1", authenticateToken, async (req, res, next) => {
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
        $addFields: {
          id: "$_id",
        },
      },
      {
        $project: {
          generatedTime: 0,
          createdAt: 0,
          updatedAt: 0,
          __v: 0,
          _id: 0,
          otp: 0,
          password: 0,
        },
      },
    ]);
    if (checkUser.length == 0) {
      return res.status(200).json({
        issuccess: false,
        data: { acknowledgement: false, data: null },
        message: "no user details found",
      });
    }
    let isSubscriptionRenew = true;
    let isMembershipRenew = true;
    await userSubscription.updateMany(
      { pickup: 0 },
      { status: 5 },
      { new: true }
    );
    let checkActiveSubscription = await userSubscription.aggregate([
      {
        $match: {
          $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }],
        },
      },
      {
        $addFields: {
          isRenew: {
            $cond: { if: { $eq: ["$pickup", 0] }, then: true, else: false },
          },
        },
      },
    ]);
    let checkMembership = await membershipSchema.aggregate([
      {
        $match: {
          $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }],
        },
      },
      {
        $addFields: {
          isRenew: false,
        },
      },
    ]);
    if (checkActiveSubscription.length > 0) {
      isSubscriptionRenew = checkActiveSubscription[0].isRenew;
    }
    if (checkMembership.length > 0) {
      isMembershipRenew = checkMembership[0].isRenew;
    }
    let getPendingOrder = await invoiceSchema.aggregate([
      {
        $match: {
          $and: [
            { userId: mongoose.Types.ObjectId(userId) },
            { status: { $in: [2, 3, 4] } },
          ],
        },
      },
    ]);
    let getCompletedOrder = await invoiceSchema.aggregate([
      {
        $match: {
          $and: [
            { userId: mongoose.Types.ObjectId(userId) },
            { status: { $in: [5, 6, 7, 8, 9] } },
          ],
        },
      },
    ]);
    let getSubscriptionDetail = await checkUserSubscriptionMemberWithCancel(
      userId
    );
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
          validity: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$duration", 0] },
                  then: "1 month validity",
                },
                { case: { $eq: ["$duration", 1] }, then: "6 month validity" },
                { case: { $eq: ["$duration", 2] }, then: "1 year validity" },
              ],
              default: "no any plan",
            },
          },
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
        $addFields: {
          planDetails: { $first: "$planDetails" },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
    ]);
    let validityPlan = "no any plan";
    let totalPickup = "no any pickup you have";
    let leftPickup = "no any pickup left";
    let pickupPercentage = 0;
    let deliveryPercentage = 0;
    let dayPercentage = 0;
    let pendingDays = 0;
    if (getAddress.length > 0) {
      let multiply =
        getAddress?.[0]?.duration == 0
          ? 1
          : getAddress?.[0]?.duration == 1
          ? 6
          : 12;
      leftPickup = getAddress?.[0]?.pickup;
      let delivery = getAddress?.[0]?.delivery;
      totalPickup = getAddress?.[0]?.stripe?.[0]?.pendingBag || 1;
      let useddelivery = getAddress?.[0]?.stripe?.[0]?.pendingBagDel || 1;

      pickupPercentage = (leftPickup * 100) / totalPickup;
      deliveryPercentage = (delivery * 100) / useddelivery;
      pendingDays = getAddress[0].pendingDays;
      validityPlan = getAddress[0].validity;
      let totalDays =
        getAddress[0].duration == 0
          ? 28
          : getAddress[0].duration == 1
          ? 28 * 6
          : 365;
      dayPercentage = (pendingDays * 100) / totalDays;
      leftPickup +=
        getAddress[0].duration == 0
          ? " pickup left"
          : getAddress[0].duration == 1
          ? " pickup left"
          : " pickup left";
      totalPickup +=
        getAddress[0].duration == 0
          ? " pickup monthly"
          : getAddress[0].duration == 1
          ? " pickup quartly"
          : " pickup yearly";
    }
    if (pickupPercentage > 100) {
      pickupPercentage = 100;
    }
    if (deliveryPercentage > 100) {
      deliveryPercentage = 100;
    }
    if (dayPercentage > 100) {
      dayPercentage = 100;
    }
    pickupPercentage = Math.round(pickupPercentage * 100) / 100;
    deliveryPercentage = Math.round(deliveryPercentage * 100) / 100;
    dayPercentage = Math.round(dayPercentage * 100) / 100;
    let getPendingNotification = await userNotification.aggregate([
      {
        $match: {
          $and: [
            { isSeen: false },
            { userId: mongoose.Types.ObjectId(userId) },
          ],
        },
      },
    ]);
    console.log(getSubscriptionDetail);
    return res.status(200).json({
      issuccess: true,
      data: {
        acknowledgement: true,
        data: Object.assign(
          {
            pendingPickups: getPendingOrder.length,
            pendingDelivery: getCompletedOrder.length,
          },
          checkUser[0],
          {
            validityPlan: validityPlan,
            totalPickup: totalPickup,
            leftPickup: leftPickup,
            pickupPercentage: pickupPercentage,
            deliveryPercentage: deliveryPercentage,
            dayPercentage: dayPercentage,
            pendingDays: pendingDays,
            notificationCount: getPendingNotification.length,
            isSubscriptionRenew: isSubscriptionRenew,
            isMembershipRenew: isMembershipRenew,
          },
          {
            isSubscription: getSubscriptionDetail[0].isSubscription,
            isMember: getSubscriptionDetail[0].isMember,
            isSubscriptionCancel: getSubscriptionDetail[0].isSubscriptionCancel,
            isMembershipCancel: getSubscriptionDetail[0].isMembershipCancel,
          }
        ),
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
      // console.log(id);
      let checkOtp = await userSchema.aggregate([
        {
          $match: {
            $and: [{ $or: [{ email: id }, { mobileNo: id }] }],
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
        await main(checkOtp[0].email, message);
      } else if (validatePhoneNumber(id)) {
        await sendSms(
          checkOtp[0].countryCode + id,
          `Dear customer, </br> ${otp} is your one time password(OTP).Please do not share the OTP with others. Regards,Team Sparkle Up`
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
        return res.status(200).json({
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
          return res.status(200).json({
            issuccess: false,
            data: { acknowledgement: false, status: 2 },
            message: `incorrect otp`,
          });
        }
        console.log("valid");
      } else {
        //otp expired
        return res.status(200).json({
          issuccess: false,
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
        return res.status(200).json({
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
          return res.status(200).json({
            issuccess: false,
            data: { acknowledgement: false, status: 2 },
            message: `incorrect otp`,
          });
        }
        console.log("valid");
      } else {
        //otp expired
        return res.status(200).json({
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
        return res.status(200).json({
          issuccess: false,
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
      // console.log(startIs)
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
          return res.status(200).json({
            issuccess: false,
            data: { acknowledgement: false, status: 2 },
            message: `incorrect otp`,
          });
        }
        console.log("valid");
      } else {
        //otp expired
        return res.status(200).json({
          issuccess: false,
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
router.get("/getUsers", async (req, res) => {
  let getUsers = await userSchema.aggregate([
    {
      $match: {},
    },
  ]);
  return res.status(getUsers.length > 0 ? 200 : 200).json({
    issuccess: true,
    data: { acknowledgement: true, data: getUsers },
    message: getUsers.length > 0 ? `users found` : "no user found",
  });
});

router.get("/refresh", generateRefreshToken);

router.get("/getSuggestions", async (req, res, next) => {
  try {
    // const userId = req.user._id
    const { text } = req.query;
    // console.log(req.user._id);
    let places = await getPlaces(text, 10);
    let filterPlace = await placeFilter(places);
    return res.status(filterPlace.length > 0 ? 200 : 200).json({
      issuccess: filterPlace.length > 0 ? true : false,
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
router.get("/getPlace", async (req, res, next) => {
  try {
    // const userId = req.user._id
    const { lat, long } = req.query;
    // console.log(req.user._id);
    let places = await getLatLong(`${long},${lat}`, 10);
    // return res.json(places)
    let filterPlace = await formatAddress(places);
    return res.status(Object.keys(filterPlace).length > 0 ? 200 : 200).json({
      issuccess: Object.keys(filterPlace).length > 0 ? true : false,
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
      return res.status(200).json({
        issuccess: false,
        data: { acknowledgement: true, data: null },
        message: "Only North Carolina address is allowed",
      });
    }
    console.log(isDefault);
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
      return res.status(200).json({
        issuccess: false,
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
      return res.status(200).json({
        issuccess: false,
        data: { acknowledgement: true, data: null },
        message: "Only North Carolina address is allowed",
      });
    }
    if (isDefault != undefined && isDefault == true) {
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

    return res.status(getAddress.length > 0 ? 200 : 200).json({
      issuccess: getAddress.length > 0 ? true : false,
      data: {
        acknowledgement: getAddress.length > 0 ? true : false,
        data: getAddress,
      },
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
router.get("/getDefaultAddress", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    console.log(userId);
    let getAddress = await addressSchema.aggregate([
      {
        $match: {
          $and: [
            { userId: mongoose.Types.ObjectId(userId) },
            { isActive: true },
            {
              isDefault: true,
            },
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

    return res.status(getAddress.length > 0 ? 200 : 200).json({
      issuccess: getAddress.length > 0 ? true : false,
      data: {
        acknowledgement: getAddress.length > 0 ? true : false,
        data: getAddress.length > 0 ? getAddress[0] : {},
      },
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
      return res.status(getAddress.length > 0 ? 200 : 200).json({
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
    return res.status(getAddress.length > 0 ? 200 : 200).json({
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
router.post("/addSubscription", authenticateToken, async (req, res, next) => {
  try {
    const { planId, duration, paymentId } = req.body;
    const userId = req.user._id;
    let checkCategory = await subscriptionSchema.findById(
      mongoose.Types.ObjectId(planId)
    );
    // console.log(checkCategory);
    if (checkCategory == undefined || checkCategory == null) {
      return res.status(200).json({
        issuccess: false,
        data: { acknowledgement: false, data: null },
        message: `subscription plan not found`,
      });
    }

    let checkActiveSubscription = await userSubscription.aggregate([
      {
        $match: {
          $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }],
        },
      },
      {
        $addFields: {
          isRenew: {
            $cond: {
              if: { $lte: ["$pendingDays", 3] },
              then: true,
              else: false,
            },
          },
        },
      },
    ]);

    if (
      checkActiveSubscription != undefined &&
      checkActiveSubscription != null &&
      checkActiveSubscription.length > 0 &&
      checkActiveSubscription[0].isRenew == false
    ) {
      return res.status(200).json({
        issuccess: false,
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
      paymentId: paymentId,
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
      pendingDays: pendingDays,
      usedDays: 0,
      status: 0,
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

  try {
    const checkCategory = await subscriptionSchema.findById(planId);

    if (!checkCategory) {
      return res.status(200).json({
        issuccess: false,
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
router.get("/getPickUpDays", authenticateToken, async (req, res) => {
  try {
    // console.log(moment()
    //     .tz('America/Panama')
    //     .format("DD/MM/YYYY"));
    // console.log(moment()
    //     .tz('America/Panama')
    //     .format("H:mm:ss"));

    const userId = req.user._id;
    let currentDate = moment().tz("America/Panama");
    let checkSubscription = await checkUserSubscriptionMember(userId);
    // console.log("subscription");
    // console.log(checkSubscription);
    if (
      checkSubscription.length > 0 &&
      "isSubscription" in checkSubscription[0] &&
      "isMember" in checkSubscription[0] &&
      checkSubscription[0].isSubscription == true &&
      checkSubscription[0].isMember == true
    ) {
    } else {
      console.log("else  ");
      currentDate = currentDate.add(1, "day");
    }
    // console.log(currentDate);
    let getNextDays = await nextDaysReplace(currentDate);
    console.log(getNextDays);
    let getDays = await dayWiseSchema.aggregate([
      {
        $match: {
          date: { $in: getNextDays },
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
          _id: 0,
        },
      },
      {
        $group: {
          _id: { date: "$date" },
          timeSlots: { $push: "$$ROOT" },
        },
      },
      {
        $addFields: {
          date: "$_id.date",
          dateType: {
            $dateFromString: {
              dateString: "$_id.date",
              format: "%m/%d/%Y",
              timezone: "-04:00",
            },
          },
        },
      },
      {
        $addFields: {
          dayNo: { $dayOfWeek: "$dateType" },
          monthNo: { $month: "$dateType" },
          dateOnly: {
            $dayOfMonth: "$dateType",
          },
        },
      },
      {
        $addFields: {
          month: {
            $let: {
              vars: {
                monthsInString: [
                  ,
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "July",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ],
              },
              in: {
                $arrayElemAt: ["$$monthsInString", "$monthNo"],
              },
            },
          },
          day: {
            $let: {
              vars: {
                dayInString: [
                  ,
                  "Sun",
                  "Mon",
                  "Tue",
                  "Wed",
                  "Thu",
                  "Fri",
                  "Sat",
                ],
              },
              in: {
                $arrayElemAt: ["$$dayInString", "$dayNo"],
              },
            },
          },
        },
      },
      {
        $sort: {
          dateType: 1,
        },
      },
      {
        $project: {
          _id: 0,
          dateType: 0,
        },
      },
    ]);
    console.log(getDays);
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: getDays },
      message: `data found for next 7 days`,
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.get("/getDeliveryDays", authenticateToken, async (req, res) => {
  try {
    // console.log(moment()
    //     .tz('America/Panama')
    //     .format("DD/MM/YYYY"));
    // console.log(moment()
    //     .tz('America/Panama')
    //     .format("H:mm:ss"));

    const userId = req.user._id;
    const { dateTimeId } = req.query;
    let getdateTimeData = await dayWiseSchema.findById(dateTimeId);
    if (getdateTimeData == null || getdateTimeData == undefined) {
      return res.status(200).json({
        issuccess: false,
        data: { acknowledgement: false, data: null },
        message: `datetime details not found`,
      });
    }
    let dateIs = getdateTimeData.date.split("/");
    // console.log(dateIs[0]);
    let currentDate = moment(
      Date.parse(`${dateIs[2]}-${dateIs[0]}-${dateIs[1]}T16:00:00Z`)
    ).tz("America/Panama");
    let timeDateIs = moment().tz("America/Panama");
    // console.log(currentDate);
    // console.log(currentDate.format("DD/MM/YYYY,h:mm:ss a"));
    // console.log(timeDateIs.format("DD/MM/YYYY,h:mm:ss a"));
    let checkSubscription = await checkUserSubscriptionMember(userId);
    // checkSubscription[0].isMember = true
    // console.log(checkSubscription);
    // console.log("subscription");
    // console.log("here ");
    // console.log(checkSubscription);
    if (
      checkSubscription.length > 0 &&
      "isSubscription" in checkSubscription[0] &&
      "isMember" in checkSubscription[0] &&
      checkSubscription[0].isMember == true
    ) {
      currentDate = currentDate.add(1, "day");
    } else {
      currentDate = currentDate.add(3, "day");
    }
    // console.log(currentDate);
    let getNextDays = await nextDaysReplace(currentDate);
    // console.log(getNextDays);
    let getDays = await dayWiseSchema.aggregate([
      {
        $match: {
          date: { $in: getNextDays },
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
          _id: 0,
        },
      },
      {
        $group: {
          _id: { date: "$date" },
          timeSlots: { $push: "$$ROOT" },
        },
      },
      {
        $addFields: {
          date: "$_id.date",
          dateType: {
            $dateFromString: {
              dateString: "$_id.date",
              format: "%m/%d/%Y",
              timezone: "-04:00",
            },
          },
        },
      },
      {
        $addFields: {
          dayNo: { $dayOfWeek: "$dateType" },
          monthNo: { $month: "$dateType" },
          dateOnly: {
            $dayOfMonth: "$dateType",
          },
        },
      },
      {
        $addFields: {
          month: {
            $let: {
              vars: {
                monthsInString: [
                  ,
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "July",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ],
              },
              in: {
                $arrayElemAt: ["$$monthsInString", "$monthNo"],
              },
            },
          },
          day: {
            $let: {
              vars: {
                dayInString: [
                  ,
                  "Sun",
                  "Mon",
                  "Tue",
                  "Wed",
                  "Thu",
                  "Fri",
                  "Sat",
                ],
              },
              in: {
                $arrayElemAt: ["$$dayInString", "$dayNo"],
              },
            },
          },
        },
      },
      {
        $sort: {
          dateType: 1,
        },
      },
      {
        $project: {
          _id: 0,
          dateType: 0,
        },
      },
    ]);
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: getDays },
      message: `data found for next 7 days`,
    });
  } catch (error) {
    return res.status(500).json({
      issuccess: false,
      data: { acknowledgement: false },
      message: error.message || "Having issue is server",
    });
  }
});
router.put(
  "/updateSubscription",
  authenticateToken,
  [
    check("subscriptionId", "please pass valid subscription id").custom(
      (value) => mongoose.Types.ObjectId.isValid(value)
    ),
    check("status", "please pass valid status field")
      .isNumeric()
      .isIn([0, 1, 3]),
    check("paymentId", "please pass payment id").custom().isString().notEmpty(),
    check("status", "please pass status").custom().isString().notEmpty(),
  ],
  checkErr,
  async (req, res, next) => {
    try {
      const { subscriptionId, status, paymentId, note } = req.body;
      const userId = req.user._id;
      let checkCategory = await userSubscription.findById(
        mongoose.Types.ObjectId(subscriptionId)
      );
      // console.log(checkCategory);
      if (checkCategory == undefined || checkCategory == null) {
        return res.status(200).json({
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
  }
);
router.get("/getSubscription", authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user._id;
    // console.log(userId);
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
        $addFields: {
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
        $sort: { createdAt: -1 },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
    ]);
    // let getPickups = await userSubscription.aggregate([
    //     {
    //         $match: {
    //             $and: [
    //                 { userId: mongoose.Types.ObjectId(userId) },
    //                 { status: 0 }
    //             ]
    //         }
    //     },
    //     {
    //         $addFields: {
    //             "id": "$_id"
    //         }
    //     },
    //     {
    //         $group:
    //         {
    //             _id: {},
    //             pickup: { $sum: "$pickup" },
    //             delivery: { $sum: "$delivery" }
    //         }
    //     },
    // ])
    // console.log(getPickups);
    return res.status(200).json({
      issuccess: true,
      data: {
        acknowledgement: true,
        data: getAddress.length > 0 ? getAddress[0] : {},
      },
      message:
        getAddress.length > 0
          ? "subscription found"
          : "no any active subscription",
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
router.get("/checkExpiration", authenticateToken, async (req, res, next) => {
  try {
    await checkExpireMemberShip();
    await checkExpireSubscription();
    return res.status(200).json({
      issuccess: true,
      data: { acknowledgement: true, data: null },
      message: "expiry set",
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

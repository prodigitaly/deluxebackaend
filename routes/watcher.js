var express = require("express");
const { default: mongoose } = require("mongoose");
const path = require("path");
var router = express.Router();
const { check } = require("express-validator");
const invoiceSchema = require("../models/invoiceSchema");
const orderState = require("../models/orderState");
const { validateEmail, makeid } = require("../utility/dates");
const { main } = require("../utility/mail");
const fcmToken = require("../models/fcmToken");
const { sendNotification } = require("../utility/notification");
const {
  checkExpireSubscription,
  getStatus,
  getRiderStatus,
  getBagItemIds,
  getItems,
} = require("../utility/expiration");
const { checkUserRole } = require("../middleware/authMobile");
const userModel = require("../models/userModel");
const userSubscription = require("../models/userSubscription");
const membershipSchema = require("../models/membershipSchema");
const pickupDeliverySchema = require("../models/pickupDeliverySchema");
const riderNotification = require("../models/riderNotification");
const userNotification = require("../models/userNotification");
const userRefer = require("../models/userRefer");
const refundRequest = require("../models/refundRequest");
const itemSchema = require("../models/itemSchema");

invoiceSchema
  .watch([], { fullDocumentBeforeChange: "whenAvailable" })
  .on("change", async (data) => {
    try {
      console.log(data);
      if (data != undefined || data != null) {
        if (data != undefined && data.operationType == "update") {
          console.log("update request");
          let getLastState = await orderState.aggregate([
            {
              $match: {
                orderId: mongoose.Types.ObjectId(data.documentKey._id),
              },
            },
          ]);
          if (getLastState.length > 0) {
            console.log("update request");
            let getOrder = await invoiceSchema.findById(data.documentKey._id);
            if (getLastState[getLastState.length - 1].to != getOrder.status) {
              let addState = new orderState({
                from: getLastState[getLastState.length - 1].to,
                to: getOrder.status,
                orderId: data.documentKey._id,
              });
              await addState.save();
              console.log("update here");
              console.log(getOrder.status);
            }
          }
          let getOrderData = await invoiceSchema.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(data.documentKey._id),
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
                        {
                          $match: { $expr: { $eq: ["$_id", "$$categoryId"] } },
                        },
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
                        $and: [
                          { $eq: ["$orderId", "$$id"] },
                          { $eq: ["$to", 2] },
                        ],
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
            {
              $lookup: {
                from: "daywises",
                localField: "pickupTimeId",
                foreignField: "_id",
                as: "pickupSlot",
              },
            },
            {
              $lookup: {
                from: "daywises",
                localField: "deliveryTimeId",
                foreignField: "_id",
                as: "deliverySlot",
              },
            },
          ]);
          if (getOrderData.length > 0) {
            let items = [];
            for (i = 0; i < getOrderData[0].orderItems.length; i++) {
              console.log(getOrderData[0].orderItems[i].itemData);
              items.push({
                name: getOrderData[0].orderItems[i].itemData.name,
                qty: getOrderData[0].orderItems[i].qty,
                amount: getOrderData[0].orderItems[i].amount,
              });
            }
            if ("status" in data.updateDescription.updatedFields) {
              console.log("here");
              let getUserToken = await fcmToken.aggregate([
                {
                  $match: {
                    userId: mongoose.Types.ObjectId(getOrderData[0].userId),
                  },
                },
              ]);
              console.log(getUserToken.length);
              if (getUserToken.length > 0) {
                let tokens = getUserToken.map((e) => {
                  return e.fcm;
                });
                // console.log(tokens)
                if (data.updateDescription.updatedFields.status == 14) {
                  let addNotification = await new userNotification({
                    userId: getOrderData[0].userId,
                    title: `your payment ${getOrderData[0].orderTotalAmount}$ for order id ${getOrderData[0].orderId}`,
                    description: `track your order by going through Your order section in Sparkle Up app`,
                    targetId: data.documentKey._id,
                    notificationType: 0,
                  }).save();
                  await sendNotification(
                    tokens,
                    `your payment ${getOrderData[0].orderTotalAmount}$ for order id ${getOrderData[0].orderId} failed`,
                    `track your order by going through Your order section in Sparkle Up app`,
                    ""
                  );
                } else if (data.updateDescription.updatedFields.status == 2) {
                  let amountUpdate = await invoiceSchema.findByIdAndUpdate(
                    data.documentKey._id,
                    {
                      amountPaid: getOrderData[0].pendingAmount,
                      pendingAmount: 0,
                    }
                  );
                  const regex = /\/payment\/success|Subscription/;
                  if (getOrderData[0].paymentId.length > 0) {
                  }
                  console.log(
                    "notification code here=================================="
                  );
                  let addNotification = await new userNotification({
                    userId: getOrderData[0].userId,
                    title: `Your recent order is changed to ${await getStatus(
                      data.updateDescription.updatedFields.status
                    )}`,
                    description: `track your order by going through Your order section in Sparkle Up app`,
                    targetId: data.documentKey._id,
                    notificationType: 0,
                  }).save();
                  console.log(
                    "notification code here=================================="
                  );
                  console.log(tokens);
                  await sendNotification(
                    tokens,
                    `Your recent order placed successfully`,
                    `track your order by going through Your order section in Sparkle Up app`,
                    ""
                  );
                } else if (
                  [11, 12].includes(data.updateDescription.updatedFields.status)
                ) {
                  let getPaymentId = getOrderData[0].paymentId[0];
                  const regex = /\/payment\/success|Subscription/;
                  if (regex.test(getPaymentId)) {
                    let checkSubscription = await userSubscription.aggregate([
                      {
                        $match: {
                          $and: [
                            {
                              userId: mongoose.Types.ObjectId(
                                getOrderData[0].userId
                              ),
                            },
                            { status: 1 },
                          ],
                        },
                      },
                    ]);
                    if (checkSubscription.length > 0) {
                      // let addBag = await userSubscription.findByIdAndUpdate(checkSubscription[0]._id, { $inc: { pickup: 1, delivery: 1 } }, { new: true })
                    }
                  } else {
                    let addRefund = new refundRequest({
                      orderId: getOrderData[0]._id,
                      userId: getOrderData[0].userId,
                      cancellationTime: new Date(),
                      paymentId: getPaymentId,
                    });
                    await addRefund.save();
                  }
                  let addNotification = await new userNotification({
                    userId: getOrderData[0].userId,
                    title: `Your recent order is changed to ${await getStatus(
                      data.updateDescription.updatedFields.status
                    )}`,
                    description: `track your order by going through Your order section in Sparkle Up app`,
                    targetId: data.documentKey._id,
                    notificationType: 0,
                  }).save();
                  await sendNotification(
                    tokens,
                    `Your recent order with orderId ${
                      getOrderData[0].orderId
                    } is changed to ${await getStatus(
                      data.updateDescription.updatedFields.status
                    )}`,
                    `track your order by going through Your order section in Sparkle Up app`,
                    ""
                  );
                } else if (data.updateDescription.updatedFields.status == 13) {
                  let addNotification = await new userNotification({
                    userId: getOrderData[0].userId,
                    title: `Amount of ${getOrderData[0].orderTotalAmount} for order Id ${getOrderData[0].orderId} is refunded successfully`,
                    description: `if it is not credited then please contact customer care to raise request`,
                    targetId: data.documentKey._id,
                    notificationType: 0,
                  }).save();
                  await sendNotification(
                    tokens,
                    `Amount of ${getOrderData[0].orderTotalAmount} for order Id ${getOrderData[0].orderId} is refunded successfully`,
                    `if it is not credited then please contact customer care to raise request`,
                    ""
                  );
                } else {
                  let addNotification = await new userNotification({
                    userId: getOrderData[0].userId,
                    title: `Your recent order is changed to ${await getStatus(
                      data.updateDescription.updatedFields.status
                    )}`,
                    description: `track your order by going through Your order section in Sparkle Up app`,
                    targetId: data.documentKey._id,
                    notificationType: 0,
                  }).save();
                  await sendNotification(
                    tokens,
                    `Your recent order with orderId ${
                      getOrderData[0].orderId
                    } is changed to ${await getStatus(
                      data.updateDescription.updatedFields.status
                    )}`,
                    `track your order by going through Your order section in Sparkle Up app`,
                    ""
                  );
                }
              }
            }
            if (data.updateDescription.updatedFields.status == 2) {
              let amountUpdate = await invoiceSchema.findByIdAndUpdate(
                data.documentKey._id,
                { amountPaid: getOrderData[0].pendingAmount, pendingAmount: 0 }
              );
              const regex = /\/payment\/success|Subscription/;
              if (getOrderData[0].paymentId.length > 0) {
                let isBag = false;
                let getBagItems = await getBagItemIds();
                const getInvoiceItems = await getItems(data.documentKey._id);

                for (u = 0; u < getInvoiceItems.length; u++) {
                  if (getBagItems.includes(getInvoiceItems[u])) {
                    isBag = true;
                    break;
                  }
                }
                console.log(isBag);
                if (isBag) {
                  let checkSubscription = await userSubscription.aggregate([
                    {
                      $match: {
                        $and: [
                          {
                            userId: mongoose.Types.ObjectId(
                              getOrderData[0].userId
                            ),
                          },
                          { status: 1 },
                        ],
                      },
                    },
                  ]);
                  if (checkSubscription.length > 0) {
                    let addBag = await userSubscription.findByIdAndUpdate(
                      checkSubscription[0]._id,
                      { $inc: { pickup: -1, delivery: -1 } },
                      { new: true }
                    );
                  }
                }
                (ejs = require("ejs")),
                  (fs = require("fs")),
                  (file = fs.readFileSync(
                    path.join(
                      __dirname,
                      "..",
                      "/",
                      "views",
                      "./",
                      "order-notification.ejs"
                    ),
                    "ascii"
                  )),
                  (rendered = ejs.render(file, {
                    orderTotalAmount: getOrderData[0].orderTotalAmount,
                    taxes: getOrderData[0].taxes,
                    items: items,
                    invoice_id: getOrderData[0].invoiceId,
                    date: getOrderData[0].orderDate[0].createdAtDate,
                    total: getOrderData[0].orderAmount,
                    cname: getOrderData[0].users[0].name,
                    pickupTime: getOrderData[0].pickupSlot[0],
                    deliveryTime: getOrderData[0].deliverySlot[0],
                    purchase_date: getOrderData[0].orderDate[0].createdAtDate,
                  }));

                await main(
                  "Sparkleup360@gmail.com",
                  rendered,
                  "New order receipt",
                  `this is order summary for new received order ${getOrderData[0].invoiceId}`
                );

                await main(
                  "viktorizeiyamu@gmail.com",
                  rendered,
                  "New order receipt",
                  `this is order summary for new received order ${getOrderData[0].invoiceId}`
                );
              }
            } else if (
              [11, 12].includes(data.updateDescription.updatedFields.status)
            ) {
              let getPaymentId = getOrderData[0].paymentId[0];
              const regex = /\/payment\/success|Subscription/;
              if (regex.test(getPaymentId)) {
                let checkSubscription = await userSubscription.aggregate([
                  {
                    $match: {
                      $and: [
                        {
                          userId: mongoose.Types.ObjectId(
                            getOrderData[0].userId
                          ),
                        },
                        { status: 1 },
                      ],
                    },
                  },
                ]);
                if (checkSubscription.length > 0) {
                  // let addBag = await userSubscription.findByIdAndUpdate(checkSubscription[0]._id, { $inc: { pickup: 1, delivery: 1 } }, { new: true })
                }
              } else {
                let addRefund = new refundRequest({
                  orderId: getOrderData[0]._id,
                  userId: getOrderData[0].userId,
                  cancellationTime: new Date(),
                  paymentId: getPaymentId,
                });
                await addRefund.save();
              }
            } else if (data.updateDescription.updatedFields.status == 10) {
              (ejs = require("ejs")),
                (fs = require("fs")),
                (file = fs.readFileSync(
                  path.join(__dirname, "..", "/", "views", "./", "invoice.ejs"),
                  "ascii"
                )),
                (rendered = ejs.render(file, {
                  orderTotalAmount: getOrderData[0].orderTotalAmount,
                  taxes: getOrderData[0].taxes,
                  items: items,
                  invoice_id: getOrderData[0].invoiceId,
                  date: getOrderData[0].orderDate[0].createdAtDate,
                  total: getOrderData[0].orderAmount,
                  cname: getOrderData[0].users[0].name,
                  purchase_date: getOrderData[0].orderDate[0].createdAtDate,
                }));
              if (
                "email" in getOrderData[0].users[0] &&
                getOrderData[0].users[0].email != ""
              ) {
                await main(
                  getOrderData[0].users[0].email,
                  rendered,
                  "Invoice From Sparkle Up",
                  `this is invoice from Sparkle Up about your last order ${getOrderData[0].invoiceId}`
                );
              }
            }
          }
        } else if (data != undefined && data.operationType == "insert") {
          let addState = new orderState({
            from: data.fullDocument.status,
            to: data.fullDocument.status,
            orderId: data.documentKey._id,
          });
          await addState.save();
        }
      }
    } catch (err) {
      console.log(err.message || "having issue on friend");
    }
  });

userModel
  .watch([], { fullDocumentBeforeChange: "whenAvailable" })
  .on("change", async (data) => {
    try {
      if (data != undefined || data != null) {
        if (data != undefined && data.operationType == "update") {
          let getUser = await userRefer.aggregate([
            {
              $match: { userId: mongoose.Types.ObjectId(data.documentKey._id) },
            },
          ]);
          console.log(getUser.length);
          if (getUser.length == 0) {
            let referral = makeid(6);
            let newRefer = await new userRefer({
              referral: referral,
              userId: data.documentKey._id,
            }).save();
            console.log("new refferal");
            console.log(newRefer);
          }
        } else if (data != undefined && data.operationType == "insert") {
          let getUser = await userRefer.aggregate([
            {
              $match: { userId: mongoose.Types.ObjectId(data.documentKey._id) },
            },
          ]);
          console.log(getUser.length);
          if (getUser.length == 0) {
            let referral = makeid(6);
            let newRefer = await new userRefer({
              referral: referral,
              userId: data.documentKey._id,
            }).save();
            console.log("new refferal");
            console.log(newRefer);
          }
          console.log("sending mail");
          let getUserData = await userModel.aggregate([
            { $match: { _id: mongoose.Types.ObjectId(data.documentKey._id) } },
          ]);
          if ("email" in getUserData[0]) {
            console.log("sending mail");
            let message = `<body style="
    margin: 0px; padding: 0px;
">
<table style="max-width: 960px; background-color: #deefff; padding: 0px; margin: 0 auto;">
    <tr style="border-radius: 4px; background-color: #1662d2;">
        <td style="display: flex; justify-content: space-around; padding: 16px;">
            <img style="width: 120px;" src="https://sourav-user.vercel.app/images/app-logo.png" alt="">
        </td>
    </tr>
    <tr>
        <td style="padding: 16px; color: #2D3748;">
            <h1 style="margin-top: 20px; font-size: 2rem; font-weight: 600; color: #2D3748;">Welcome!</h1>
            <p style="margin-top: -8px;font-size: 1.2rem;font-weight: 600;">Dear Valued Customer,</p>
            <p style="margin-top: 8px;">We would like to take this opportunity to welcome you to Sparkle Up. Our family-run business has been serving the Triangle area since 1981, providing top-quality dry cleaning and laundry services to our customers. Our team of considerate and informative staffs aims to make every laundry experience a personalized one for you.</p>
            <p style="margin-top: 24px;">At Sparkle Up, we pride ourselves on providing a unique experience for our customers. Here are just a few reasons why we stand out:</p>
            <p style="margin-top: 24px;"><span style="font-weight: 600; color: #1A202C;">Quality:</span> You can be sure that your laundry is in good hands, as we use quality products and state-of-the-art machines for a thorough and professional clean.</p>
            <p style="margin-top: 24px;"><span style="font-weight: 600; color: #1A202C;">Convenience:</span> We understand that your time is valuable, which is why we offer both door-to-door delivery service and 8 convenient locations across the Triangle, ensuring the highest level of convenience for our customers.</p>
            <p style="margin-top: 24px;"><span style="font-weight: 600; color: #1A202C;">Express Delivery:</span> We understand that your time is valuable, which is why we offer both door-to-door delivery service and 8 convenient locations across the Triangle, ensuring the highest level of convenience for our customers.</p>
            <p style="margin-top: 24px;"><span style="font-weight: 600; color: #1A202C;">Affordable Price:</span> Our prices are designed to suit your pocket, and we offer two types of pricing - pay as you go or subscribe to Sparkle Up Renew.</p>
            <p style="margin-top: 24px;"><span style="font-weight: 600; color: #1A202C;">Instant Order Update:</span> We believe in keeping our customers informed. You'll receive regular updates on your order, helping you to keep track of your laundry and plan accordingly.</p>
            <p style="margin-top: 24px;">Our operation is executed in a central plant, where we use fully automatic state-of-the-art washing and dry cleaning systems with automatic dosing units. We take great care in treating your fragile and expensive fibers, using mild chemicals and best spotting agents in the industry for best treatment.</p>
            <p style="margin-top: 24px;">We're also committed to environmental sustainability, and we use reusable laundry bags for our pickup and delivery service to help save the environment.</p>
            <p style="margin-top: 24px;">Thank you for choosing Sparkle Up for all your laundry needs. We're committed to providing you with the best service possible, and we look forward to serving you.</p>
            <h4 style="margin-top: 24px; font-weight: 700;">Best regards,</h4>
            <p style="
            margin-top: -12px;
            ">Admin</p>
            <p style="
    margin-top: -12px;
">Sparkle Up</p>
        </td>
    </tr>
</table>
</body>`;
            console.log("notification clicked");
            await main(
              getUserData[0].email,
              message,
              "Welcome From Sparkle Up",
              `Dear ${getUserData[0].email} , Welcome to Sparkle up system , now you don't need to care about your daily laundry because we will like take care of that on your behalf`
            );
          }

          console.log("sending mail");
        }
      }
    } catch (err) {
      console.log(err.message || "having issue on friend");
    }
  });

userSubscription
  .watch([], { fullDocumentBeforeChange: "whenAvailable" })
  .on("change", async (data) => {
    try {
      if (data != undefined || data != null) {
        console.log(data);
        if (data != undefined && data.operationType == "update") {
          console.log("update");
          let getLastState = await userSubscription.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(data.documentKey._id),
              },
            },
            {
              $lookup: {
                from: "subscriptions",
                localField: "planId",
                foreignField: "_id",
                as: "planDetails",
              },
            },
          ]);
          if (getLastState.length > 0) {
            if ("status" in data.updateDescription.updatedFields) {
              let planName =
                getLastState[0].planDetails.length > 0
                  ? getLastState[0].planDetails[0].name
                  : "";
              let getUserToken = await fcmToken.aggregate([
                {
                  $match: {
                    userId: mongoose.Types.ObjectId(getLastState[0].userId),
                  },
                },
              ]);
              let tokens = getUserToken.map((e) => {
                return e.fcm;
              });
              console.log(tokens);
              if (getUserToken.length > 0) {
                if (data.updateDescription.updatedFields.status == 1) {
                  let addNotification = await new userNotification({
                    userId: getLastState[0].userId,
                    title: `Your ${planName} from Sparkle Up service will activated as we have received payment for plan purchase`,
                    description: `You can access your active plan in your account subscription on our Sparkle Up app`,
                    targetId: data.documentKey._id,
                    notificationType: 1,
                  }).save();
                  await sendNotification(
                    tokens,
                    `Your ${planName} from Sparkle Up service will activated as we have received payment for plan purchase`,
                    `You can access your active plan in your account subscription on our Sparkle Up app`,
                    ""
                  );
                } else if (data.updateDescription.updatedFields.status == 2) {
                  let addNotification = await new userNotification({
                    userId: getLastState[0].userId,
                    title: `your payment ${getLastState[0].price}$ for subscription name ${planName} failed`,
                    description: `if any amount debited then it will be refund to your account in working days`,
                    targetId: data.documentKey._id,
                    notificationType: 1,
                  }).save();
                  await sendNotification(
                    tokens,
                    `your payment ${getLastState[0].price}$ for subscription name ${planName} failed`,
                    `if any amount debited then it will be refund to your account in working days`,
                    ""
                  );
                }
              }
            }
          }
        } else if (data != undefined && data.operationType == "insert") {
          console.log("insert");
          let getLastState = await userSubscription.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(data.documentKey._id),
              },
            },
            {
              $lookup: {
                from: "subscriptions",
                localField: "planId",
                foreignField: "_id",
                as: "planDetails",
              },
            },
          ]);
          if (getLastState.length > 0) {
            if ("status" in getLastState[0] && getLastState[0].status == 1) {
              let planName =
                getLastState[0].planDetails.length > 0
                  ? getLastState[0].planDetails[0].name
                  : "";

              let getUserToken = await fcmToken.aggregate([
                {
                  $match: {
                    userId: mongoose.Types.ObjectId(getLastState[0].userId),
                  },
                },
              ]);
              console.log("here user reached");
              if (getUserToken.length > 0) {
                let tokens = getUserToken.map((e) => {
                  return e.fcm;
                });
                console.log(tokens);
                let addNotification = await new userNotification({
                  userId: getLastState[0].userId,
                  title: `Your ${planName} from Sparkle Up service will activated as we have received payment for plan purchase`,
                  description: `You can access your active plan in your account subscription on our Sparkle Up app`,
                  targetId: data.documentKey._id,
                  notificationType: 1,
                }).save();
                await sendNotification(
                  tokens,
                  `Your ${planName} from Sparkle Up service will activated as we have received payment for plan purchase`,
                  `You can access your active plan in your account subscription on our Sparkle Up app`,
                  ""
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.log(err.message || "having issue on friend");
    }
  });
membershipSchema
  .watch([], { fullDocumentBeforeChange: "whenAvailable" })
  .on("change", async (data) => {
    try {
      if (data != undefined || data != null) {
        if (data != undefined && data.operationType == "update") {
          let getLastState = await membershipSchema.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(data.documentKey._id),
              },
            },
            {
              $lookup: {
                from: "membershipdetails",
                localField: "membershipId",
                foreignField: "_id",
                as: "membershipDetails",
              },
            },
          ]);
          if (getLastState.length > 0) {
            if ("status" in data.updateDescription.updatedFields) {
              let planName =
                getLastState[0].membershipDetails.length > 0
                  ? getLastState[0].membershipDetails[0].name
                  : "";
              let getUserToken = await fcmToken.aggregate([
                {
                  $match: {
                    userId: mongoose.Types.ObjectId(getLastState[0].userId),
                  },
                },
              ]);
              if (getUserToken.length > 0) {
                let tokens = getUserToken.map((e) => {
                  return e.fcm;
                });
                console.log(tokens);
                if (data.updateDescription.updatedFields.status == 1) {
                  let checkSubscription = await userSubscription.aggregate([
                    {
                      $match: {
                        $and: [
                          {
                            userId: mongoose.Types.ObjectId(
                              getLastState[0].userId
                            ),
                          },
                          { status: 1 },
                        ],
                      },
                    },
                  ]);
                  if (checkSubscription.length > 0) {
                    let addBag = await userSubscription.findByIdAndUpdate(
                      checkSubscription[0]._id,
                      { $inc: { pickup: 1, delivery: 1 } },
                      { new: true }
                    );
                  }
                  let addNotification = await new userNotification({
                    userId: getLastState[0].userId,
                    title: `Your membership request of ${planName} from Sparkle Up service will activated as we have received payment for plan purchase`,
                    description: `You can access your active membership in your account membership section on our Sparkle Up app`,
                    targetId: data.documentKey._id,
                    notificationType: 2,
                  }).save();
                  await sendNotification(
                    tokens,
                    `Your membership request of ${planName} from Sparkle Up service will activated as we have received payment for plan purchase`,
                    `You can access your active membership in your account membership section on our Sparkle Up app`,
                    ""
                  );
                }
              } else if (data.updateDescription.updatedFields.status == 2) {
                let addNotification = await new userNotification({
                  userId: getLastState[0].userId,
                  title: `your payment ${getLastState[0].price}$ for subscription name ${planName} failed`,
                  description: `if any amount debited then it will be refund to your account in working days`,
                  targetId: data.documentKey._id,
                  notificationType: 2,
                }).save();
                await sendNotification(
                  tokens,
                  `your payment ${getLastState[0].price}$ for membership name ${planName} failed`,
                  `if any amount debited then it will be refund to your account in working days`,
                  ""
                );
              }
            }
          }
        } else if (data != undefined && data.operationType == "insert") {
          let getLastState = await membershipSchema.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(data.documentKey._id),
              },
            },
            {
              $lookup: {
                from: "membershipdetails",
                localField: "membershipId",
                foreignField: "_id",
                as: "membershipDetails",
              },
            },
          ]);
          if (getLastState.length > 0) {
            if ("status" in getLastState[0] && getLastState[0].status == 1) {
              let planName =
                getLastState[0].membershipDetails.length > 0
                  ? getLastState[0].membershipDetails[0].name
                  : "";
              let getUserToken = await fcmToken.aggregate([
                {
                  $match: {
                    userId: mongoose.Types.ObjectId(getLastState[0].userId),
                  },
                },
              ]);
              if (getUserToken.length > 0) {
                let tokens = getUserToken.map((e) => {
                  return e.fcm;
                });
                console.log(tokens);
                let addNotification = await new userNotification({
                  userId: getLastState[0].userId,
                  title: `Your membership request of ${planName} from Sparkle Up service will activated as we have received payment for plan purchase`,
                  description: `You can access your active membership in your account membership section on our Sparkle Up app`,
                  targetId: data.documentKey._id,
                  notificationType: 2,
                }).save();
                await sendNotification(
                  tokens,
                  `Your membership request of ${planName} from Sparkle Up service will activated as we have received payment for plan purchase`,
                  `You can access your active membership in your account membership section on our Sparkle Up app`,
                  ""
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.log(err.message || "having issue on friend");
    }
  });
pickupDeliverySchema
  .watch([], { fullDocumentBeforeChange: "whenAvailable" })
  .on("change", async (data) => {
    try {
      if (data != undefined || data != null) {
        if (data != undefined && data.operationType == "update") {
          let getLastState = await pickupDeliverySchema.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(data.documentKey._id),
              },
            },
            {
              $lookup: {
                from: "invoices",
                localField: "orderId",
                foreignField: "_id",
                as: "membershipDetails",
              },
            },
          ]);
          if (getLastState.length > 0) {
            if ("status" in data.updateDescription.updatedFields) {
              let planName =
                getLastState[0].membershipDetails.length > 0
                  ? getLastState[0].membershipDetails[0].orderId
                  : "";
              let getUserToken = await fcmToken.aggregate([
                {
                  $match: {
                    userId: mongoose.Types.ObjectId(getLastState[0].riderId),
                  },
                },
              ]);
              if (getUserToken.length > 0) {
                let tokens = getUserToken.map((e) => {
                  return e.fcm;
                });
                console.log(tokens);
                await new riderNotification({
                  title: `Your ride status changed for ride id ${
                    getLastState[0].rideId
                  } to ${getRiderStatus(getLastState[0].status)}`,
                  description: `One of your ride assigned to you which has rideId ${
                    getLastState[0].rideId
                  } changed to ${getRiderStatus(
                    data.updateDescription.updatedFields.status
                  )}`,
                  rideId: getLastState[0]._id,
                  riderId: getLastState[0].riderId,
                }).save();
                await sendNotification(
                  tokens,
                  `Your ride status changed for ride id ${
                    getLastState[0].rideId
                  } to ${getRiderStatus(getLastState[0].status)}`,
                  `One of your ride assigned to you which has rideId ${
                    getLastState[0].rideId
                  } changed to ${getRiderStatus(
                    data.updateDescription.updatedFields.status
                  )} `,
                  ""
                );
              }
            }
          }
        } else if (data != undefined && data.operationType == "insert") {
          let getLastState = await pickupDeliverySchema.aggregate([
            {
              $match: {
                _id: mongoose.Types.ObjectId(data.documentKey._id),
              },
            },
            {
              $lookup: {
                from: "invoices",
                localField: "orderId",
                foreignField: "_id",
                as: "membershipDetails",
              },
            },
          ]);
          if (getLastState.length > 0) {
            if ("status" in getLastState[0]) {
              let planName =
                getLastState[0].membershipDetails.length > 0
                  ? getLastState[0].membershipDetails[0].orderId
                  : "";
              let getUserToken = await fcmToken.aggregate([
                {
                  $match: {
                    userId: mongoose.Types.ObjectId(getLastState[0].riderId),
                  },
                },
              ]);
              if (getUserToken.length > 0) {
                let tokens = getUserToken.map((e) => {
                  return e.fcm;
                });
                await new riderNotification({
                  title: `One new ride assign to you which has ride id ${getLastState[0].rideId} `,
                  description: `you will get new ride with riderId ${getLastState[0].rideId} `,
                  rideId: getLastState[0]._id,
                  riderId: getLastState[0].riderId,
                }).save();
                await sendNotification(
                  tokens,
                  `One new ride assign to you which has ride id ${getLastState[0].rideId} `,
                  `you will get new ride with riderId ${getLastState[0].rideId} `,
                  ""
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.log(err.message || "having issue on friend");
    }
  });
module.exports = router;

const membershipSchema = require("../models/membershipSchema");
const userModel = require("../models/userModel");
const userSubscription = require("../models/userSubscription");
const mongoose = require('mongoose');
const dayWiseSchema = require("../models/dayWiseSchema");
const timeSchema = require("../models/timeSchema");
const holidaySchema = require("../models/holidaySchema");

const moment = require('moment');
const momentTz = require('moment-timezone');
const pickupDeliverySchema = require("../models/pickupDeliverySchema");
const invoiceSchema = require("../models/invoiceSchema");
const couponSchema = require("../models/couponSchema");
const ejs = require('ejs')
const fs = require('fs')
const path = require('path')
const userSubscriptionStripe = require("../models/userSubscriptionStripe");
const { main } = require("./mail");
const orderItems = require("../models/orderItems");
const itemSchema = require("../models/itemSchema");
exports.sendMail = async (failedPayment) => {

    file = fs.readFileSync(path.join(__dirname, '..', '/', 'views', './', 'payment-failed.ejs'), 'ascii'),
        rendered = ejs.render(file, {
            name: 'name',
            amount: 200,
            plan_name: 'DE-LITE',
            date_time: '02/02/2023 11:50 PM'
        });
    await main('jaynikpatel119977.jp@gmail.com', rendered, "Payment in sparkleup service", `payment failed for ${'DE-LITE'} in sparkle up`);
}

exports.checkExpireSubscription = async () => {
    await userSubscription.updateMany({ pickup: 0 }, { status: 5 }, { new: true });
    let checkExpire = await userSubscription.aggregate([
        {
            $match: {
                $and: [
                    { status: 1 },
                    { endDate: { $lte: new Date() } }
                ]
            }
        }
    ]);
    if (checkExpire.length > 0) {
        console.log(checkExpire);
        let checkExpiredIds = checkExpire.map(e => { return mongoose.Types.ObjectId(e._id) });
        let getCancelled = await userSubscriptionStripe.aggregate([{
            $match: { $and: [{ subscriptionId: { $in: checkExpiredIds } }, { isCancelled: false }] }

        }, {
            $group: {
                _id: null,
                ids: { $push: "$subscriptionId" }
            }
        }]);
        // console.log(getCancelled);
        // console.log(checkExpiredIds)
        getCancelled = getCancelled.length > 0 ? getCancelled[0].ids : []
        for (i = 0; i < checkExpire.length > 0; i++) {
            if (getCancelled.includes(checkExpire[i]._id) == false) {
                await userSubscription.findByIdAndUpdate(checkExpire[i]._id, { status: 2 }, { new: true })
            }
        }
    }
    let getAddressIs = await userSubscription.aggregate([
        {
            $match: {
                status: 1
            }
        },
        {
            $addFields: {
                usedDays:
                {
                    $dateDiff:
                    {
                        startDate: "$startDate",
                        endDate: new Date(),
                        unit: "day"
                    }
                },
                pendingDays:
                {
                    $dateDiff:
                    {
                        startDate: new Date(),
                        endDate: "$endDate",
                        unit: "day"
                    }
                }
            }
        }
    ])
    if (getAddressIs.length > 0) {
        for (i = 0; i < getAddressIs.length > 0; i++) {
            let update = await userSubscription.findByIdAndUpdate(getAddressIs[i]._id, { pendingDays: getAddressIs[i].pendingDays, usedDays: getAddressIs[i].usedDays }, { new: true });
            // console.log(update);
        }
    }
}
exports.checkExpireCoupon = async () => {
    // Create a new Date object
    const date = new Date();

    // Get the current date and time in the 'America/Panama' time zone
    const options = { timeZone: 'America/Panama' };
    const panamaDateString = date.toLocaleString('en-US', options);
    const panamaDate = new Date(panamaDateString);
    let checkExpire = await couponSchema.aggregate([
        {
            $match: {
                end: { $lte: panamaDate }
            }
        }
    ]);
    if (checkExpire.length > 0) {
        for (i = 0; i < checkExpire.length > 0; i++) {
            await couponSchema.findByIdAndUpdate(checkExpire[i]._id, {
                isVisible: false, isExpired: true
            }, { new: true })
        }
    }
}
exports.getBagItemIds = async () => {
    const items = await itemSchema.find({ isBag: true });
    const itemIds = items.map(item => item._id.toString());
    return itemIds;
};
exports.getItems = async (invoiceId) => {
    const items = await orderItems.find({ orderId: mongoose.Types.ObjectId(invoiceId) });
    const itemIds = items.map(item => item.itemId.toString());
    return itemIds;
};
exports.changeRideStatus = async () => {
    try {
        let today = new Date();
        let previousDay = new Date(today);
        previousDay.setDate(previousDay.getDate() - 1);

        let options = {
            timeZone: 'America/Panama',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric'
        };

        previousDay = new Intl.DateTimeFormat('en-US', options).format(previousDay);
        previousDay = new Date(previousDay);
        previousDay.setHours(23, 59, 59);
        console.log(typeof previousDay)
        let currentDate = momentTz().tz("America/Panama").format('MM/DD/YYYY')
        const checkUser = await pickupDeliverySchema.aggregate([
            {
                $match: {
                    status: { $in: [0, 1, 4] }
                }
            },
            {
                $lookup: {
                    from: "daywises",
                    let: { orderId: "$pickupTimeId", rideType: "$rideType" },
                    pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] } } }, {
                        $addFields: {
                            id: "$_id"
                        }
                    }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }],
                    as: "pickupTimeData"
                }
            },
            {
                $lookup: {
                    from: "daywises",
                    let: { orderId: "$deliveryTimeId" },
                    pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] } } }, {
                        $addFields: {
                            id: "$_id"
                        }
                    }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }],
                    as: "deliveryTimeData"
                }
            },
            {
                $addFields: {
                    isSameDay: { $cond: [{ $eq: [{ $first: "$pickupTimeData.date" }, { $first: "$deliveryTimeData.date" }] }, true, false] },
                    timeData: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$rideType", 0] }, then: { $first: "$pickupTimeData" } },
                                { case: { $eq: ["$rideType", 1] }, then: { $first: "$deliveryTimeData" } },
                                { case: { $eq: ["$rideType", 2] }, then: "Return" }
                            ],
                            default: "Did not match"
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "invoices",
                    let: { orderId: "$orderId" },
                    pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] } } },
                    {
                        $lookup: {
                            from: "addresses",
                            let: { orderId: "$pickupAddressId" },
                            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] } } }, {
                                $addFields: {
                                    id: "$_id"
                                }
                            }, {
                                $project: {
                                    _id: 0,
                                    __v: 0
                                }
                            }],
                            as: "pickupAddressData"
                        }
                    },
                    {
                        $lookup: {
                            from: "addresses",
                            let: {
                                orderId: "$deliveryAddressId"
                            },
                            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$_id", "$$orderId"] }] } } }, {
                                $addFields: {
                                    id: "$_id"
                                }
                            }, {
                                $project: {
                                    _id: 0,
                                    __v: 0
                                }
                            }],
                            as: "deliveryAddressData"
                        }
                    }, {
                        $addFields: {
                            id: "$_id",
                            pickupAddress: { $first: "$pickupAddressData" },
                            deliveryAddress: { $first: "$deliveryAddressData" }
                        }
                    }, {
                        $project: {
                            _id: 0,
                            __v: 0
                        }
                    }
                    ],
                    as: "orderData"
                }
            },
            {
                $addFields: {
                    "id": "$_id",
                    rideTypeValue: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$rideType", 0] }, then: "Pickup" },
                                { case: { $eq: ["$rideType", 1] }, then: "Delivery" },
                                { case: { $eq: ["$rideType", 2] }, then: "Return" }
                            ],
                            default: "Did not match"
                        }
                    },
                    addressData: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$rideType", 0] }, then: { $first: "$orderData.pickupAddress" } },
                                { case: { $eq: ["$rideType", 1] }, then: { $first: "$orderData.deliveryAddress" } },
                                { case: { $eq: ["$rideType", 2] }, then: "Return" }
                            ],
                            default: "Did not match"
                        }
                    },
                    idString: { $toString: "$rideId" },
                    date: "$timeData.date"
                }
            },
            {
                $sort: { updatedAt: -1 }
            },
            {
                $addFields: {
                    dateType: {
                        $dateFromString: {
                            dateString: "$date",
                            format: "%m/%d/%Y",
                            timezone: "America/Panama"
                        }
                    }
                }
            },
            {
                $match: {
                    dateType: { $lte: previousDay }
                }
            },
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
                    "createdAt": 0,
                    "updatedAt": 0,
                    "_id": 0,
                    "__v": 0,
                    "otp": 0
                }
            }
        ]);
        console.log(checkUser)
        for (i = 0; i < checkUser.length; i++) {
            let getDateTimeSlot = await dayWiseSchema.aggregate([{
                $match: { $and: [{ timeSlot: checkUser[i].timeData.timeSlot }, { date: currentDate }] }
            }])
            if (getDateTimeSlot.length > 0) {
                let update = { status: checkUser[i].rideType == 0 ? 4 : 9 }
                if (checkUser[i].rideType == 0) {
                    update = {
                        status: checkUser[i].rideType == 0 ? 4 : 9,
                        pickupTimeId: getDateTimeSlot[0]._id
                    }
                }
                else {
                    update = {
                        deliveryTimeId: getDateTimeSlot[0]._id
                    }
                }
                let updateStatus = await pickupDeliverySchema.findByIdAndUpdate(checkUser[i].id, Object.assign({ status: 0 }, update), { new: true })
                let updateOrder = await invoiceSchema.findByIdAndUpdate(checkUser[i].orderId, Object.assign({
                    status: checkUser[i].rideType == 0 ? 3 : 8
                }, update), { new: true })
            }
            else {
                let updateStatus = await pickupDeliverySchema.findByIdAndUpdate(checkUser[i].id, { status: 0 }, { new: true })
                let updateOrder = await invoiceSchema.findByIdAndUpdate(checkUser[i].orderId, { status: checkUser[i].rideType == 0 ? 3 : 8 }, { new: true })
            }
        }
    }
    catch (err) {
        console.log(err.message)
    }
}
exports.checkExpireMemberShip = async () => {
    let checkExpire = await membershipSchema.aggregate([
        {
            $match: {
                endDate: { $lte: new Date() }
            }
        }
    ]);
    if (checkExpire.length > 0) {
        for (i = 0; i < checkExpire.length > 0; i++) {
            await membershipSchema.findByIdAndUpdate(checkExpire[i]._id, { status: 2 }, { new: true })
        }
    }
    let getAddressIs = await membershipSchema.aggregate([
        {
            $addFields: {
                usedDays:
                {
                    $dateDiff:
                    {
                        startDate: "$startDate",
                        endDate: new Date(),
                        unit: "day"
                    }
                },
                pendingDays:
                {
                    $dateDiff:
                    {
                        startDate: new Date(),
                        endDate: "$endDate",
                        unit: "day"
                    }
                }
            }
        }
    ])
    // console.log(getAddressIs)
    if (getAddressIs.length > 0) {
        for (i = 0; i < getAddressIs.length > 0; i++) {
            let update = await membershipSchema.findByIdAndUpdate(getAddressIs[i]._id, { pendingDays: getAddressIs[i].pendingDays, usedDays: getAddressIs[i].usedDays }, { new: true });
            console.log(update);
        }
    }
}
exports.getDateArray = (start, end) => {
    var arr = new Array();
    var dt = new Date(start);
    while (dt <= end) {
        arr.push(`${new Date(dt).getDate()}/${new Date(dt).getMonth() + 1}/${new Date(dt).getFullYear()}`);
        if (new Date(dt).getDate().toString().length == 1) {
            arr.push(`0${new Date(dt).getDate()}/${new Date(dt).getMonth() + 1}/${new Date(dt).getFullYear()}`);
        }
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
}
exports.getNextDays = (start) => {
    var arr = new Array();
    var dt = new Date(start);
    for (i = 0; i < 7; i++) {
        arr.push(`${new Date(dt).getMonth() + 1}/${new Date(dt).getDate() / new Date(dt).getFullYear()} `);
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
}
exports.nextDaysReplace = async (start) => {
    let next = start;
    let array = []
    for (let i = 0; i < 8; i++) {
        if (i != 0) {
            next = moment(next)
                .tz('America/Panama').add(1, 'days')
        }
        let nextDate = next.format("MM/DD/YYYY");
        array.push(nextDate)
    }
    return array;
}
exports.nextDays = async (start) => {
    try {
        let currentDate = moment()
            .tz('America/Panama')
            .format("MM/DD/YYYY");
        let next = start;
        let array = []
        console.log(new Date())
        for (let i = 0; i < 9; i++) {
            if (i != 0) {
                next = moment(next)
                    .tz('America/Panama').add(1, 'days')
            }
            let nextDate = next.format("MM/DD/YYYY");
            array.push(nextDate)
            let getHoliday = await holidaySchema.findOne({ date: nextDate });
            if (getHoliday != null && getHoliday != undefined) {
                let checkExist = await dayWiseSchema.aggregate([{ $match: { date: nextDate } }]);
                if (checkExist.length > 0) {
                    console.log("found")
                    // return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: checkExist[0] }, message: `${ date } status found` });
                }
                else {
                    console.log("not found")
                    for (j = 0; j < getHoliday.timeSlots.length; j++) {
                        if (getHoliday.timeSlots[j].isActive == true) {
                            await new dayWiseSchema({ date: nextDate, timeSlotId: getHoliday.timeSlots[j].timerangeId, timeSlot: getHoliday.timeSlots[j].time, isActive: getHoliday.timeSlots[j].isActive, isHalfHoliday: getHoliday.isHalfHoliday, isFullHoliday: getHoliday.isFullHoliday }).save();
                        }
                    }
                }
                // return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: addDay }, message: `${ date } status found` });
            }
            let checkExist = await dayWiseSchema.aggregate([{ $match: { date: nextDate } }]);
            if (checkExist.length > 0) {
                // return res.status(200).json({ issuccess: true, data: { acknowledgement: true, data: checkExist[0] }, message: `${ date } status found` });
            }
            else {
                let getTimeRange = await timeSchema.aggregate([{ $addFields: { isActive: true, time: { $concat: ["$start", " - ", "$end"] } } }, { $sort: { priority: 1 } }]);
                // console.log(getTimeRange)
                for (j = 0; j < getTimeRange.length; j++) {
                    await new dayWiseSchema({ date: nextDate, timeSlotId: getTimeRange[j]._id, timeSlot: getTimeRange[j].time, isActive: getTimeRange[j].isActive, isHalfHoliday: false, isFullHoliday: false }).save();
                }
            }
        }
        console.log(new Date())
        return array;
    } catch (err) {
        console.log(err.message)
    }
}
exports.getNextNextDays = (start) => {
    var arr = new Array();
    var dt = new Date(start);
    for (i = 0; i < 7; i++) {
        arr.push(`${new Date(dt).getDate()} /${new Date(dt).getMonth() + 1}/${new Date(dt).getFullYear()} `);
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
}
exports.getStatus = (status) => {
    switch (status) {
        case 0:
            return "Item Selection"
            // code block
            break;
        case 1:
            return "Pending Payment"
            // code block
            break;
        case 2:
            return "Order Confirmed"
            break;
        case 3:
            return "Order Pickup Initiated"
            break;
        case 4:
            return "Order Pickup Failed"
            break;
        case 5:
            return "Order Pickup Completed"
            break;
        case 6:
            return "Order Processing Your Clothes"
            break;
        case 7:
            return "Order Cleaning Completed"
            break;
        case 8:
            return "Order Delivery Initiated"
            break;
        case 9:
            return "Order Delivery Failed"
            break;
        case 10:
            return "Order Delivery Completed"
            break;
        case 11:
            return "Order Cancelled"
            break;
        case 12:
            return "Order Cancelled And Refund Pending"
            break;
        case 13:
            return "Order Refund Processed"
            break;
        case 14:
            return "Order Payment Failed"
            break;
        default:
            return "No any order status found"
        // code block
    }
}
exports.getRiderStatus = (status) => {
    switch (status) {
        case 0:
            return "assigned"
            // code block
            break;
        case 1:
            return "Running"
            // code block
            break;
        case 2:
            return "completed ride"
            break;
        case 3:
            return "failed to pickup"
            break;
        case 4:
            return "cancelled"
            break;
        default:
            return "No any order status found"
        // code block
    }
}
exports.checkUserSubscriptionMember = async (userId) => {
    let checkUser = await userModel.aggregate([{ $match: { _id: mongoose.Types.ObjectId(userId) } }, {
        $lookup: {
            from: "memberships",
            let: { userId: "$_id" },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", 1] }] } } }],
            as: "membershipDetail"
        }
    },
    {
        $lookup: {
            from: "usersubsciptions",
            let: { userId: "$_id" },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", 1] }] } } }],
            as: "subscriptionDetail"
        }
    },
    {
        $project: {
            isSubscription: {
                $cond: { if: { $gte: [{ $size: "$subscriptionDetail" }, 1] }, then: true, else: false }
            },
            isMember: {
                $cond: { if: { $gte: [{ $size: "$membershipDetail" }, 1] }, then: true, else: false }
            }
        }
    }])
    if (checkUser.length > 0) {
        // checkUser[0]['isSubscription'] = false
        return checkUser;
    }
    console.log(new Date())
    return [{ isSubscription: false, isMember: false }]
}
exports.checkUserSubscriptionMemberWithCancel = async (userId) => {
    let checkUser = await userModel.aggregate([{ $match: { _id: mongoose.Types.ObjectId(userId) } }, {
        $lookup: {
            from: "memberships",
            let: { userId: "$_id" },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", 1] }] } } }],
            as: "membershipDetail"
        }
    },
    {
        $lookup: {
            from: "usersubsciptions",
            let: { userId: "$_id" },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $in: ['$status', [1, 5]] }] } } }],
            as: "subscriptionDetail"
        }
    }])
    let isSubscriptionCancel = false, isMembershipCancel = false;

    if (checkUser.length > 0) {
        // checkUser[0]['isSubscription'] = false
        const isMember = checkUser[0].membershipDetail.length > 0 ? true : false
        const isSubscription = checkUser[0].subscriptionDetail.length > 0 ? true : false
        if (isSubscription) {
            console.log(checkUser[0].subscriptionDetail[checkUser[0].subscriptionDetail.length - 1]._id)
            const getSubscriptionCancel = await userSubscriptionStripe.find({
                subscriptionId: mongoose.Types.ObjectId(checkUser[0].subscriptionDetail[checkUser[0].subscriptionDetail.length - 1]._id)
            })
            console.log(getSubscriptionCancel)
            isSubscriptionCancel = getSubscriptionCancel != undefined && getSubscriptionCancel.length > 0 ? getSubscriptionCancel[getSubscriptionCancel.length - 1].isCancelled : false;
        }
        if (isMember) {
            const getMembershipCancel = await userSubscriptionStripe.find({
                subscriptionId: mongoose.Types.ObjectId(checkUser[0].membershipDetail[checkUser[0].membershipDetail.length - 1]._id)
            })
            console.log(getMembershipCancel)
            isMembershipCancel = getMembershipCancel != undefined && getMembershipCancel.length > 0 ? getMembershipCancel[getMembershipCancel.length - 1].isCancelled : false;

        }


        return [{ isSubscription, isMember, isSubscriptionCancel, isMembershipCancel }];
    }
    console.log(new Date())
    return [{ isSubscription: false, isMember: false, isSubscriptionCancel, isMembershipCancel }]
}
exports.getUserMembershipSubscription = async (userId) => {
    let checkUser = await userModel.aggregate([{ $match: { _id: mongoose.Types.ObjectId(userId) } }, {
        $lookup: {
            from: "memberships",
            let: { userId: "$_id" },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", 1] }] } } },
            {
                $lookup: {
                    from: "membershipdetails",
                    localField: "membershipId",
                    foreignField: "_id",
                    as: "membershipData"
                }
            },
            {
                $addFields: {
                    usedDays:
                    {
                        $dateDiff:
                        {
                            startDate: "$startDate",
                            endDate: new Date(),
                            unit: "day"
                        }
                    },
                    pendingDays:
                    {
                        $dateDiff:
                        {
                            startDate: new Date(),
                            endDate: "$endDate",
                            unit: "day"
                        }
                    }
                }
            },
            {
                $addFields: {
                    isRenew: {
                        $cond: { if: { $lte: ["$pendingDays", 3] }, then: true, else: false }
                    }
                }
            },
            {
                $project: {
                    usedDays: 0,
                    pendingDays: 0
                }
            }],
            as: "membershipDetail"
        }
    },
    {
        $lookup: {
            from: "usersubsciptions",
            let: { userId: "$_id" },
            pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$userId", "$$userId"] }, { $eq: ["$status", 1] }] } } }, {
                $lookup: {
                    from: "subscriptions",
                    localField: "planId",
                    foreignField: "_id",
                    as: "subscriptionData"
                }
            },
            {
                $addFields: {
                    usedDays:
                    {
                        $dateDiff:
                        {
                            startDate: "$startDate",
                            endDate: new Date(),
                            unit: "day"
                        }
                    },
                    pendingDays:
                    {
                        $dateDiff:
                        {
                            startDate: new Date(),
                            endDate: "$endDate",
                            unit: "day"
                        }
                    }
                }
            },
            {
                $addFields: {
                    isRenew: {
                        $cond: { if: { $eq: ["$pickup", 0] }, then: true, else: false }
                    }
                }
            },
            {
                $project: {
                    usedDays: 0,
                    pendingDays: 0
                }
            }
            ],
            as: "subscriptionDetail"
        }
    }])
    if (checkUser.length > 0) {
        return checkUser[0];
    }
    return { membershipDetail: [], subscriptionDetail: [] }
}
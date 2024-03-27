var express = require('express');
const invoiceSchema = require('../models/invoiceSchema');
const userModel = require('../models/userModel');
var router = express.Router();
const moment = require('moment');
const momentTz = require('moment-timezone')
const bodyParser = require('body-parser');
const checkoutSession = require('../models/checkoutSession');
const { default: mongoose } = require('mongoose');
const userSubscription = require('../models/userSubscription');
const membershipSchema = require('../models/membershipSchema');
const stripe = require('../utility/setup/stripe');
const https = require('https');
const { main } = require('../utility/mail');
const userSubscriptionStripe = require('../models/userSubscriptionStripe');
const client = require('../utility/setup/redis');

// const stripe = require('stripe')('sk_test_51MGvznGi7bwABort1GkoMw0gP2OhxTaDTPgl0H49MNOxE2MSGB4PaQPbxhMBO7haNC3CfVnIEQlr1VxxXTNCl64f000JIV2KNx');
// let endpointSecret = 'sk_test_51MGvznGi7bwABort1GkoMw0gP2OhxTaDTPgl0H49MNOxE2MSGB4PaQPbxhMBO7haNC3CfVnIEQlr1VxxXTNCl64f000JIV2KNx'
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), async function (request, response) {
    // const payload = request.body;
    // const sig = request.headers['stripe-signature'];

    // let event;

    // try {
    //     event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    //     console.log(event);
    // } catch (err) {
    //     console.log(err);
    //     return response.status(400).send(`Webhook Error: ${err.message}`);
    // }

    let event;
    try {
        event = request.body;
        console.log(event.type)
        switch (event.type) {
            case 'invoice.payment_failed':
                const invoicePaymentFailed = event.data.object;
                getUser(event.data.object.subscription, event.data.object.charge, false);
                // getDataUser = await getUser(event.data.object.subscription);
                // if (getDataUser.length > 0 && getDataUser[0].user.length > 0) {
                //     getCharge = await stripe.charges.retrieve(
                //         event.data.object.charge)
                //     //
                //     getContent = await getData(getCharge.receipt_url)
                //     if (getDataUser[0].user[0].email != null && getDataUser[0].user[0].email != undefined && getDataUser[0].user[0].email != "") {
                //         await main(getDataUser[0].user[0].email, getContent, 'Payment Received Receipt Sparkle Up', 'We received your payment toward sparkleup service successfully')
                //     }
                // }
                return response.sendStatus(200);
                // Then define and call a function to handle the event invoice.payment_failed
                break;
            case 'invoice.payment_succeeded':
                const invoicePaymentSucceeded = event.data.object;
                console.log(event.data.object.subscription)
                // getDataUser = await getUser(event.data.object.subscription, event.data.object.charge);
                getUser(event.data.object.subscription, event.data.object.charge, true);
                return response.sendStatus(200);
                // Then define and call a function to handle the event invoice.payment_succeeded
                break;
            case 'checkout.session.completed':
                paymentId = event.data.object.id;
                console.log(paymentId)
                updateStatus = await checkoutSession.findOneAndUpdate({ paymentId: paymentId }, { status: 1 })
                console.log(updateStatus)
                if (updateStatus != undefined && updateStatus != null) {
                    console.log("checkout session" + updateStatus.orderType)
                    if (updateStatus.orderType == 1) {
                        let getUserId = await userSubscription.aggregate([
                            {
                                $match: {
                                    _id: mongoose.Types.ObjectId(updateStatus.orderId)
                                }
                            }
                        ])
                        console.log(getUserId.length)
                        if (getUserId.length > 0) {
                            let userId = getUserId[0].userId
                            let checkMembership = await userSubscription.aggregate([{ $match: { $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }] } }])
                            console.log(checkMembership.length)
                            if (checkMembership.length > 0) {
                                let pendingDays = getUserId[0].duration == 0 ? 28 : (getUserId[0].duration == 1 ? (28 * 6) : 365);
                                pendingDays = pendingDays + checkMembership[0].pendingDays
                                updateSubscription = await userSubscription.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), {
                                    startDate: moment(),
                                    endDate: moment().add(pendingDays, 'days'), pendingDays: pendingDays, status: 1
                                }, { new: true });
                                console.log(updateSubscription)
                                let updateSubscriptionExpired = await userSubscription.updateMany({ _id: { $nin: [mongoose.Types.ObjectId(updateStatus.orderId)] } }, { status: 4 }, { new: true })
                            }
                            else {
                                updateMember = await userSubscription.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 1 }, { new: true });
                            }
                        }
                    }
                    else if (updateStatus.orderType == 2) {
                        let getUserId = await membershipSchema.aggregate([
                            {
                                $match: {
                                    _id: mongoose.Types.ObjectId(updateStatus.orderId)
                                }
                            }
                        ])
                        console.log(getUserId.length)
                        if (getUserId.length > 0) {
                            let userId = getUserId[0].userId
                            let checkMembership = await membershipSchema.aggregate([{ $match: { $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }] } }])
                            console.log(checkMembership)
                            if (checkMembership.length > 0) {
                                let pendingDays = getUserId[0].duration == 0 ? 28 : (getUserId[0].duration == 1 ? (28 * 6) : 365);
                                pendingDays = pendingDays + checkMembership[0].pendingDays
                                console.log(pendingDays)
                                updateSubscription = await membershipSchema.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), {
                                    startDate: moment(),
                                    endDate: moment().add(pendingDays, 'days'), pendingDays: pendingDays, status: 1
                                }, { new: true });
                                let updateSubscriptionExpired = await membershipSchema.updateMany({ _id: { $nin: [mongoose.Types.ObjectId(updateStatus.orderId)] } }, { status: 4 }, { new: true })
                            }
                            else {
                                updateMember = await membershipSchema.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 1 }, { new: true });
                            }
                        }

                        // let checkMembership = await membershipSchema.aggregate([{ $match: { $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }] } }])
                        // updateMember = await membershipSchema.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 1 }, { new: true });
                    }
                    else {
                        updateOrder = await invoiceSchema.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 2, $push: { paymentId: updateStatus.paymentId } }, { new: true })
                    }

                }
                return response.sendStatus(200);
                // Payment was successful  
                // Update the database and send a confirmation email to the customer
                break;
            case 'checkout.session.expired':

                paymentId = event.data.object.id;
                console.log(paymentId)
                getCheckout = await checkoutSession.findOne({ paymentId: paymentId, status: 2 })
                if (getCheckout != undefined) {

                    updateStatus = await checkoutSession.findOneAndUpdate({ paymentId: paymentId }, { status: 2 })

                    if (updateStatus != undefined && updateStatus != null) {
                        console.log("checkout session" + updateStatus.orderType)
                        if (updateStatus.orderType == 1) {
                            let getSubscription = await userSubscription.findByIdAndUpdate(updateStatus.orderId, { status: 3 });
                        }
                        else if (updateStatus.orderType == 2) {
                            let getSubscription = await membershipSchema.findByIdAndUpdate(updateStatus.orderId, { status: 3 });
                        }
                        else {
                            let getSubscription = await invoiceSchema.findByIdAndUpdate(updateStatus.orderId, { status: 14 });
                        }
                    }
                }
                return response.sendStatus(200);
                // paymentId = event.data.object.id;
                // console.log(paymentId)
                // updateStatus = await checkoutSession.findOneAndUpdate({ paymentId: paymentId }, { status: 2 })
                // return res.sendStatus(200);
                // Payment failed
                // Update the database and send an email to the customer
                break;
            case 'checkout.session.async_payment_succeeded':
                paymentId = event.data.object.id;
                console.log(paymentId)
                updateStatus = await checkoutSession.findOneAndUpdate({ paymentId: paymentId }, { status: 1 })
                console.log(updateStatus)
                if (updateStatus != undefined && updateStatus != null) {
                    console.log("checkout session" + updateStatus.orderType)
                    if (updateStatus.orderType == 1) {
                        let getUserId = await userSubscription.aggregate([
                            {
                                $match: {
                                    _id: mongoose.Types.ObjectId(updateStatus.orderId)
                                }
                            }
                        ])
                        console.log(getUserId.length)
                        if (getUserId.length > 0) {
                            let userId = getUserId[0].userId
                            let checkMembership = await userSubscription.aggregate([{ $match: { $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }] } }])
                            console.log(checkMembership.length)
                            if (checkMembership.length > 0) {
                                let pendingDays = getUserId[0].duration == 0 ? 28 : (getUserId[0].duration == 1 ? (28 * 6) : 365);
                                pendingDays = pendingDays + checkMembership[0].pendingDays
                                updateSubscription = await userSubscription.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), {
                                    startDate: moment(),
                                    endDate: moment().add(pendingDays, 'days'), pendingDays: pendingDays, status: 1
                                }, { new: true });
                                console.log(updateSubscription)
                                let updateSubscriptionExpired = await userSubscription.updateMany({ _id: { $nin: [mongoose.Types.ObjectId(updateStatus.orderId)] } }, { status: 4 }, { new: true })
                            }
                            else {
                                updateMember = await userSubscription.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 1 }, { new: true });
                            }
                        }
                    }
                    else if (updateStatus.orderType == 2) {
                        let getUserId = await membershipSchema.aggregate([
                            {
                                $match: {
                                    _id: mongoose.Types.ObjectId(updateStatus.orderId)
                                }
                            }
                        ])
                        console.log(getUserId.length)
                        if (getUserId.length > 0) {
                            let userId = getUserId[0].userId
                            let checkMembership = await membershipSchema.aggregate([{ $match: { $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }] } }])
                            console.log(checkMembership)
                            if (checkMembership.length > 0) {
                                let pendingDays = getUserId[0].duration == 0 ? 28 : (getUserId[0].duration == 1 ? (28 * 6) : 365);
                                pendingDays = pendingDays + checkMembership[0].pendingDays
                                console.log(pendingDays)
                                updateSubscription = await membershipSchema.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), {
                                    startDate: moment(),
                                    endDate: moment().add(pendingDays, 'days'), pendingDays: pendingDays, status: 1
                                }, { new: true });
                                let updateSubscriptionExpired = await membershipSchema.updateMany({ _id: { $nin: [mongoose.Types.ObjectId(updateStatus.orderId)] } }, { status: 4 }, { new: true })
                            }
                            else {
                                updateMember = await membershipSchema.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 1 }, { new: true });
                            }
                        }

                        // let checkMembership = await membershipSchema.aggregate([{ $match: { $and: [{ userId: mongoose.Types.ObjectId(userId) }, { status: 1 }] } }])
                        // updateMember = await membershipSchema.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 1 }, { new: true });
                    }
                    else {
                        updateOrder = await invoiceSchema.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 2, $push: { paymentId: updateStatus.paymentId } }, { new: true })
                    }

                }
                return response.sendStatus(200);
                // paymentId = event.data.object.id;
                // updateStatus = await checkoutSession.findOneAndUpdate({ paymentId: paymentId }, { status: 1 })
                // if (updateStatus != undefined && updateStatus != null) {
                //     if (updateStatus.orderType == 5) {
                //         updateSubscription = await userSubscription.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 6 }, { new: true });
                //         updateMember = await membershipSchema.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 6 }, { new: true });
                //     }
                //     else {
                //         updateOrder = await invoiceSchema.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 2, $push: { paymentId: updateStatus.paymentId } }, { new: true })
                //         updateSubscription = await userSubscription.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 1 }, { new: true });
                //         updateMember = await membershipSchema.findByIdAndUpdate(mongoose.Types.ObjectId(updateStatus.orderId), { status: 1 }, { new: true });

                //     }
                // }
                // return response.sendStatus(200);
                // Payment was refunded
                // Update the database and send a refund email to the customer
                break;
            case 'payment_intent.failed':
                paymentId = event.data.object.id;
                console.log(paymentId)
                getCheckout = await checkoutSession.findOne({ paymentId: paymentId, status: 2 })
                if (getCheckout != undefined) {
                    updateStatus = await checkoutSession.findOneAndUpdate({ paymentId: paymentId }, { status: 2 })
                    if (updateStatus != undefined && updateStatus != null) {
                        console.log("checkout session" + updateStatus.orderType)
                        if (updateStatus.orderType == 1) {
                            let getSubscription = await userSubscription.findByIdAndUpdate(updateStatus.orderId, { status: 3 });
                        }
                        else if (updateStatus.orderType == 2) {
                            let getSubscription = await membershipSchema.findByIdAndUpdate(updateStatus.orderId, { status: 3 });
                        }
                        else {
                            let getSubscription = await invoiceSchema.findByIdAndUpdate(updateStatus.orderId, { status: 14 });
                        }
                    }
                }
                return response.sendStatus(200);
                break;
            case 'charge.failed':
                paymentId = event.data.object.id;
                // console.log(paymentId)
                getCheckout = await checkoutSession.findOne({ paymentId: paymentId, status: 2 })
                if (getCheckout != undefined) {
                    updateStatus = await checkoutSession.findOneAndUpdate({ paymentId: paymentId }, { status: 2 })
                    if (updateStatus != undefined && updateStatus != null) {
                        console.log("checkout session" + updateStatus.orderType)
                        if (updateStatus.orderType == 1) {
                            let getSubscription = await userSubscription.findByIdAndUpdate(updateStatus.orderId, { status: 3 });
                        }
                        else if (updateStatus.orderType == 2) {
                            let getSubscription = await membershipSchema.findByIdAndUpdate(updateStatus.orderId, { status: 3 });
                        }
                        else {
                            let getSubscription = await invoiceSchema.findByIdAndUpdate(updateStatus.orderId, { status: 14 });
                        }
                    }
                }
                return response.sendStatus(200);
                break;

            case 'checkout.session.expired':
                paymentId = event.data.object.id;
                console.log(paymentId)
                getCheckout = await checkoutSession.findOne({ paymentId: paymentId, status: 2 })
                if (getCheckout != undefined) {
                    updateStatus = await checkoutSession.findOneAndUpdate({ paymentId: paymentId }, { status: 2 })
                    if (updateStatus != undefined && updateStatus != null) {
                        console.log("checkout session" + updateStatus.orderType)
                        if (updateStatus.orderType == 1) {
                            let getSubscription = await userSubscription.findByIdAndUpdate(updateStatus.orderId, { status: 3 });
                        }
                        else if (updateStatus.orderType == 2) {
                            let getSubscription = await membershipSchema.findByIdAndUpdate(updateStatus.orderId, { status: 3 });
                        }
                        else {
                            let getSubscription = await invoiceSchema.findByIdAndUpdate(updateStatus.orderId, { status: 14 });
                        }
                    }
                }
                return response.sendStatus(200);
                break;
            default:
                // Unexpected event type
                console.log(event.type)
                return response.status(400).end();
        }
    } catch (err) {
        response.status(400).send(`Webhook Error: ${err.message}`);
    }

})
const getData = (url) => {
    return new Promise((resolve, reject) => {
        let content = "";

        https.get(url, (response) => {
            response.on('data', (chunk) => {
                content += chunk;
            });

            response.on('end', () => {
                resolve(content);
            });
        }).on("error", (error) => {
            reject(error);
        });
    });
};
async function getUser(subscription, chargeId, isSuccess) {
    try {
        console.log(subscription + "  " + chargeId + " " + isSuccess)
        const responseUserId = await client.get(subscription);
        if (responseUserId != undefined && responseUserId != null) {
            let getUser = await userModel.aggregate([
                {
                    $match: {
                        _id: mongoose.Types.ObjectId(responseUserId)
                    }
                }
            ])
            if (getUser.length > 0) {
                getCharge = await stripe.charges.retrieve(chargeId)
                getContent = await getData(getCharge.receipt_url)
                if (getUser[0].email != null && getUser[0].email != undefined && getUser[0].email != "") {
                    if (isSuccess) {
                        await main(getUser[0].email, getContent, 'Payment Received Receipt Sparkle Up', 'We received your payment toward sparkleup service successfully')
                    }
                    else {
                        await main(getUser[0].email, getContent, 'Payment Failed for Sparkle Up', 'We find something issue on your payment please check')
                    }
                }
            }
        }

    }
    catch (err) {
        console.log(err)
    }
}


module.exports = router;

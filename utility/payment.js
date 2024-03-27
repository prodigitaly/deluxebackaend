const { default: mongoose } = require("mongoose");
const subscriptionStripe = require("../models/subscriptionStripe");
const userModel = require("../models/userModel");
const userStripe = require("../models/userStripe");
const userSubscription = require("../models/userSubscription");
const userSubscriptionStripe = require("../models/userSubscriptionStripe");
const stripe = require('./setup/stripe')
// Import moment.js
var moment = require('moment');
const membershipSchema = require("../models/membershipSchema");
const client = require("./setup/redis");

exports.createCustomer = async (userId) => {
    console.log(userId)
    let getUser = await userModel.findById(userId);
    if (getUser != null || getUser != undefined) {
        const customer = await stripe.customers.create({
            metadata: {
                userId: userId
            }
        });
        return customer.id;
    }

}
exports.createPaymenMethod = async (userId, customer_id, card_number, card_cvv, card_expiry) => {
    const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
            number: card_number,
            exp_month: parseInt(card_expiry.split('/')[0]),
            exp_year: parseInt(card_expiry.split('/')[1]),
            cvc: card_cvv,
        },
        metadata: {
            userId: userId
        }
    });
    const paymentMethodAttach = await stripe.paymentMethods.attach(
        paymentMethod.id,
        { customer: customer_id }
    );
    console.log(paymentMethodAttach)
    return paymentMethod.id
}
// Assume stripe is a Stripe object and userId, customer_id, card_number, card_cvv, card_expiry are strings
exports.createPaymentMethodNew = async (userId, customer_id, card_number, card_cvv, card_expiry) => {
    try {

        // Create payment method
        const paymentMethod = await stripe.paymentMethods.create({
            type: 'card',
            card: {
                number: card_number,
                exp_month: parseInt(card_expiry.split('/')[0]),
                exp_year: parseInt(card_expiry.split('/')[1]),
                cvc: card_cvv,
            },
            metadata: {
                userId: userId
            }
        });
        console.log("======1")
        // Get the fingerprint of the new card
        const fingerprint = paymentMethod.card.fingerprint;
        console.log("======2")
        // List all the cards for the customer
        const cards = await stripe.paymentMethods.list({
            customer: customer_id,
            type: 'card'
        });
        console.log("======3")
        // Find a card with the same fingerprint
        const existingCard = cards.data.find(function (c) {
            console.log(c.card.fingerprint)
            console.log(fingerprint)
            return c.card.fingerprint === fingerprint;
        });
        console.log("======4")
        // Attach payment method to customer if it does not exist
        let paymentMethodAttach;
        if (existingCard) {
            // Use the existing card id
            paymentMethodAttach = existingCard;

            // // Delete the newly created payment method
            // await stripe.paymentMethods.detach(paymentMethod.id);
            // console.log("======5")

        } else {
            // Attach the new payment method
            paymentMethodAttach = await stripe.paymentMethods.attach(
                paymentMethod.id,
                { customer: customer_id }
            );
            console.log(paymentMethodAttach);
            console.log("======6")
        }

        // Return payment method id
        return paymentMethodAttach.id;
    } catch (err) {
        // Handle errors
        console.error(err);
        return null;
    }
}

exports.removePaymentMethod = async (userId, paymentMethodId) => {
    const removePaymentMethod = await stripe.paymentMethods.detach(
        paymentMethodId
    );
    return removePaymentMethod.id
}
exports.handleUserPaymentRequest = async (userId, type, subscriptionId, card_number, card_cvv, card_expiry, userSubscriptionId, isSubscription = true, paymentMethodIdPassed, pickup, delivery) => {
    try {
        const getStripe = await userStripe.findOne({ userId: mongoose.Types.ObjectId(userId) });
        const getSubscription = await subscriptionStripe.findOne({ subscriptionId: mongoose.Types.ObjectId(subscriptionId), type: type });
        console.log(getSubscription)
        let customerId;
        console.log(getStripe)
        if (getStripe == null || getStripe == undefined) {
            customerId = await this.createCustomer(userId);
            console.log(customerId)
        }
        else {
            customerId = getStripe.customerId
            console.log(customerId)
        }
        console.log(customerId)
        const paymentMethods = getStripe == null || getStripe == undefined ? [] : getStripe.paymentMethodId
        let createPaymet;
        // console.log(getStripe)
        // console.log(getStripe.paymentMethodId[getStripe.paymentMethodId.length - 1])
        if (paymentMethodIdPassed && paymentMethodIdPassed != "") { createPaymet = paymentMethodIdPassed }
        else {
            createPaymet = await this.createPaymentMethodNew(userId, customerId, card_number, card_cvv, card_expiry);
            console.log(createPaymet)
            if (!paymentMethods.includes(createPaymet) && createPaymet != null) {
                console.log('here')
                paymentMethods.push(createPaymet)
            }
        }
        console.log(paymentMethods)
        // if () {
        //     await this.removePaymentMethod(userId, getStripe.paymentMethodId);
        // }

        if ((getStripe == null || getStripe == undefined) && (customerId != "" && customerId != undefined) && (paymentMethods != "" && paymentMethods != undefined && paymentMethods.length > 0)) {
            await new userStripe({ userId: userId, customerId: customerId, paymentMethodId: paymentMethods }).save();
        }
        else {
            await userStripe.findByIdAndUpdate(getStripe._id, { customerId: customerId, paymentMethodId: paymentMethods });
        }
        if (getSubscription != null && getSubscription != undefined) {

            await this.createSubscription(userId, customerId, createPaymet, getSubscription.planId, subscriptionId, userSubscriptionId, isSubscription, type, pickup, delivery)
        }
    } catch (err) {
        throw new Error(err.message || 'having issue on payment method');
    }
}
exports.getSavedPaymentMethod = async (payment_method_ids) => {
    // Initialize an empty array to store the masked card numbers
    const masked_card_numbers = [];

    // Loop over the payment method ids
    for (let id of payment_method_ids) {
        // Get the payment method object
        const paymentMethod = await stripe.paymentMethods.retrieve(id);

        // Get the card object from the payment method
        const card = paymentMethod.card;

        // Get the last four digits and the brand of the card
        const last4 = card.last4;
        const brand = card.brand;

        // Create a masked card number with asterisks
        let maskedCardNumber;
        if (brand === "American Express") {
            // American Express cards have 15 digits
            maskedCardNumber = "**** ****** " + last4;
        } else {
            // Other cards have 16 digits
            maskedCardNumber = "**** **** **** " + last4;
        }

        // Push the masked card number to the array
        masked_card_numbers.push({ id: id, card: maskedCardNumber });
    }
    return masked_card_numbers;
}
exports.getSubscription = async () => {
    const subscription = await stripe.subscriptions.retrieve(
        "sub_1N1Zb6Gi7bwABortpnyWq6fc"
    );
    console.log(subscription)
}
exports.createSubscription = async (userId, customerId, paymentMethodId, planId, subscriptionIdPlan, subscriptionId, isSubscription, type, pickup, delivery) => {
    try {
        console.log(userId + "  " + customerId + "  " + paymentMethodId + "  " + planId + "  " + subscriptionId + "  " + isSubscription + "  " + type)
        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customerId,
            default_payment_method: paymentMethodId,
            items: [{ plan: planId }],
            collection_method: 'charge_automatically',
            metadata: {
                subscriptionId: subscriptionId
            }
            // Optionally, you can add other parameters, such as trial period or tax rates
            // trial_period_days: 30,
            // default_tax_rates: ['txr_...'],
        });
        client.set(subscription.id.toString(), userId.toString(), 'EX', 300)

        // Define schema/model to be updated based on `isSubscription`
        const subscriptionSchema = isSubscription ? userSubscription : membershipSchema;
        console.log(type)
        console.log(type == 'quarter')
        // Update schema/model
        // console.log(latest_invoice)
        let updateSubscriptionUpdate;
        const subscriptionStartDate = moment(subscription.current_period_start * 1000);
        const subscriptionEndDate = moment(subscription.current_period_end * 1000).toDate();
        const pendingDays = moment(subscriptionEndDate).diff(moment(), 'days');
        // console.log(subscriptionStartDate + "  " + subscriptionEndDate)
        // const days = pendingDays / (type == "quarter" ? 6 : type == "year" ? 12 : 1)
        // const durationIs = moment.duration(days, 'days'); // create a duration object with the number as days
        // const milliseconds = durationIs.asMilliseconds();
        // let nextRenew; pendingBag = 0;
        // if (isSubscription) {
        //     nextRenew = (subscriptionStartDate.add(milliseconds, 'milliseconds').toDate());
        //     pendingBag = (type == "quarter" ? (pickup * 5) : type == "year" ? (pickup * 11) : 0);
        // }
        // Save subscription data to database

        if (isSubscription) {
            await this.cancelActiveSubscription(userId, subscriptionId)
            const newSubscriptionStripe = await new userSubscriptionStripe({
                planSubscriptionId: subscriptionIdPlan, userId, paymentMethodId, subscriptionId: subscriptionId, subscription: subscription.id, planId, isSubscription, pendingBag: pickup, pendingBagDel: delivery
            }).save();
            await subscriptionSchema.updateMany({ userId: mongoose.Types.ObjectId(userId) }, { status: 4 });

            updateSubscriptionUpdate = await subscriptionSchema.findByIdAndUpdate(mongoose.Types.ObjectId(subscriptionId), {
                startDate: subscriptionStartDate.toDate(),
                endDate: subscriptionEndDate,
                pendingDays,
                status: 1
            }, { new: true });

        } else {
            const newSubscriptionStripe = await new userSubscriptionStripe({
                planSubscriptionId: subscriptionIdPlan, userId, paymentMethodId, subscriptionId: subscriptionId, subscription: subscription.id, planId, isSubscription, pendingBag: pickup, pendingBagDel: delivery
            }).save();
            updateMembership = await membershipSchema.findByIdAndUpdate(mongoose.Types.ObjectId(subscriptionId), {
                startDate: subscriptionStartDate.toDate(),
                endDate: subscriptionEndDate,
                pendingDays,
                status: 1
            }, { new: true });

        }

    } catch (error) {
        console.error(error);
        throw error;
    }
};
exports.cancelActiveSubscription = async (userId) => {

    const subscriptions = await userSubscriptionStripe.find({ isSubscription: true, isCancelled: false, userId: mongoose.Types.ObjectId(userId) });

    for (const subscription of subscriptions) {
        await stripe.subscriptions.update(subscription.subscription, {
            cancel_at_period_end: true,
        });
        await userSubscriptionStripe.findByIdAndUpdate(subscription._id, {
            isCancelled: true,
        });
    }
}
exports.cancelActiveSubscriptionWithStripe = async (subscription_id) => {       // Assume stripe is a Stripe object and subscription_id is a string
    const subscription = await stripe.subscriptions.update(
        subscription_id,
        { 'cancel_at_period_end': true }
    );
    return subscription;
}

// // Update a subscription with a new plan and prorate the difference
// stripe.subscriptions.update('sub_123', {
//     items: [{ plan: 'plan_456' }],
//     proration_behavior: 'create_prorations'
// })
//     .then(subscription => {
//         // Do something with the updated subscription
//         console.log(subscription);
//     })
//     .catch(error => {
//         // Handle any errors
//         console.error(error);
//     });
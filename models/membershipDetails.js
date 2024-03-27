const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');

const stripe = require('../utility/setup/stripe');
const subscriptionStripe = require('./subscriptionStripe');
const userSubscriptionStripe = require('./userSubscriptionStripe');
const membershipDetail = mongoose.Schema({
    name: {
        type: String,
        default: ""
    },
    icon: {
        type: String,
        default: ""
    },
    month: {
        type: Number,
        default: 0
    },
    quarterly: {
        type: Number,
        default: 0
    },
    year: {
        type: Number,
        default: 0
    },
    isVisible: {
        type: Boolean,
        default: false
    },
    benefits: {
        type: String,
        default: ""
    }
}, { timestamps: true });
// Post hook for save and findOneAndUpdate operations
membershipDetail.post(['save'], async function (doc, next) {
    try {
        const subscription = doc;
        console.log(subscription)
        let checkSubscription = await subscriptionStripe.updateMany({ subscriptionId: mongoose.Types.ObjectId(subscription._id) }, { isChanged: true });
        const planId = `${subscription.name.toLowerCase().replace(/\s+/g, '-')}_${subscription._id.toString()}`;
        // Create or update the plan on Stripe
        let plan;

        let plans = []
        planMonth = await stripe.plans.create({
            amount: (subscription.month * 100).toFixed(0),
            interval: 'month',
            currency: 'usd',
            product: {
                name: subscription.name
            },
            metadata: {
                id: subscription._id,
                tag: subscription.tag
            },
            id: `${planId}-month`
        });
        plans.push({ planId: planMonth.id, type: 'month', price: (subscription.month * 100).toFixed(0), subscriptionId: subscription._id })
        planQuarter = await stripe.plans.create({
            amount: (subscription.quarterly * 100).toFixed(0),
            interval: 'month',
            interval_count: 6,
            currency: 'usd',
            product: {
                name: subscription.name
            },
            metadata: {
                id: subscription._id,
                tag: subscription.tag
            },
            id: `${planId}-quarter`
        });
        plans.push({ planId: planQuarter.id, type: 'quarter', price: (subscription.quarterly * 100).toFixed(0), subscriptionId: subscription._id })
        planYear = await stripe.plans.create({
            amount: (subscription.year * 100).toFixed(0),
            interval: 'year',
            currency: 'usd',
            product: {
                name: subscription.name
            },
            metadata: {
                id: subscription._id,
                tag: subscription.tag
            },
            id: `${planId}-year`
        });

        plans.push({ planId: planYear.id, type: 'year', price: (subscription.year * 100).toFixed(0), subscriptionId: subscription._id })
        await subscriptionStripe.insertMany(plans);

    } catch (error) {
        next(error);
    }
});
membershipDetail.post(['findOneAndUpdate'], async function (doc, next) {
    try {
        const subscription = doc;
        const getSubscription = await subscriptionStripe.find({ subscriptionId: mongoose.Types.ObjectId(subscription._id), isChanged: false });
        let priceChange = false;
        let getMonth = getSubscription.filter((e) => { if (e.type == 'month') return e });
        let getQuarter = getSubscription.filter((e) => { if (e.type == 'quarter') return e });
        let getYear = getSubscription.filter((e) => { if (e.type == 'year') return e });

        if (getMonth.length > 0 && ((subscription.month * 100).toFixed(0) != getMonth[0].price)) {
            console.log("month")
            priceChange = true;
        }
        if (getQuarter.length > 0 && ((subscription.quarterly * 100).toFixed(0) != getQuarter[0].price)) {
            console.log("quarter")
            priceChange = true;
        }
        if (getYear.length > 0 && ((subscription.year * 100).toFixed(0) != getYear[0].price)) {
            console.log("year")
            priceChange = true;
        }
        if (priceChange) {
            for (i = 0; i < getSubscription.length; i++) {
                await removeExistingPlan(getSubscription[i].planId, subscription._id)
            }
            // let checkSubscription = await subscriptionStripe.updateMany({}, { isChanged: true });

            const planId = `${subscription.name.toLowerCase().replace(/\s+/g, '-')}_${subscription._id.toString()}`;
            // Create or update the plan on Stripe
            let plan;

            let plans = []
            planMonth = await stripe.plans.create({
                amount: (subscription.month * 100).toFixed(0),
                interval: 'month',
                currency: 'usd',
                product: {
                    name: subscription.name
                },
                metadata: {
                    id: subscription._id,
                    tag: subscription.tag
                },
                id: `${planId}-month`
            });
            plans.push({ planId: planMonth.id, type: 'month', price: (subscription.month * 100).toFixed(0), subscriptionId: subscription._id })
            planQuarter = await stripe.plans.create({
                amount: (subscription.quarterly * 100).toFixed(0),
                interval: 'month',
                interval_count: 6,
                currency: 'usd',
                product: {
                    name: subscription.name
                },
                metadata: {
                    id: subscription._id,
                    tag: subscription.tag
                },
                id: `${planId}-quarter`
            });
            plans.push({ planId: planQuarter.id, type: 'quarter', price: (subscription.quarterly * 100).toFixed(0), subscriptionId: subscription._id })
            planYear = await stripe.plans.create({
                amount: (subscription.year * 100).toFixed(0),
                interval: 'year',
                currency: 'usd',
                product: {
                    name: subscription.name
                },
                metadata: {
                    id: subscription._id,
                    tag: subscription.tag
                },
                id: `${planId}-year`
            });

            plans.push({ planId: planYear.id, type: 'year', price: (subscription.year * 100), subscriptionId: subscription._id })
            await subscriptionStripe.insertMany(plans);
        }
    } catch (error) {
        next(error);
    }
});
// Remove an existing plan when the price in Stripe changes.
async function removeExistingPlan(planId, subscriptionId) {
    try {
        await endActiveSubscription(planId)
        await stripe.plans.del(planId);
        await subscriptionStripe.updateMany({ subscriptionId: mongoose.Types.ObjectId(subscriptionId) }, { isChanged: true })
    } catch (error) {
        console.log(error);
    }
}

// End the active subscription for a plan when the plan price changes.
async function endActiveSubscription(planId, subscriptionId) {
    try {
        const subscriptions = await userSubscriptionStripe.find({ planSubscriptionId: mongoose.Types.ObjectId(subscriptionId), isSubscription: true, isCancelled: false });

        for (const subscription of subscriptions) {
            await stripe.subscriptions.update(subscription.subscription, {
                cancel_at_period_end: true,
            });
            await userSubscriptionStripe.findByIdAndUpdate(subscription._id, {
                isCancelled: true,
            });
        }
    } catch (error) {
        console.log(error);
    }
}

module.exports = mongoose.model("membershipdetail", membershipDetail);
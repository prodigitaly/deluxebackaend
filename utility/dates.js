const moment = require('moment-timezone')
const momentIs = require('moment');
const userModel = require('../models/userModel');
const invoiceSchema = require('../models/invoiceSchema');
const checkoutSession = require('../models/checkoutSession');
const stripe = require('./setup/stripe');
const userStripe = require('../models/userStripe');
const { default: mongoose } = require('mongoose');
base_url = 'https://www.sparkleup.us/'
exports.setLink = (link) => {
    base_url = link
}
exports.formatNumber = (value) => {
    const suffixes = ['', 'k', 'm', 'b', 't'];

    let suffixIndex = 0;

    while (value >= 1000 && suffixIndex < suffixes.length - 1) {
        value /= 1000;
        suffixIndex++;
    }

    return value.toFixed(2) + suffixes[suffixIndex];
}

exports.createLink = async (userId, amount, orderId, orderType) => {
    const getUser = await userModel.findById(userId);
    const getStripe = await userStripe.findOne({ userId: mongoose.Types.ObjectId(userId) });

    if (!getUser) {
        return Promise.reject("no user found");
    }

    const paymentObj = {
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: 'USD',
                    unit_amount: Math.round(amount * 100),
                    product_data: {
                        name: 'Sparkle Up ',
                        description: 'Make Your Clothes Bright',
                        images: ['https://deluxe-cleaner.nyc3.cdn.digitaloceanspaces.com/logo_deluxe.png'],
                    },
                },
                quantity: 1,
            }],
        mode: 'payment',
        success_url: `${base_url}payment/success`,
        cancel_url: `${base_url}payment/failure`,
    };



    if (getStripe?.customerId && getStripe?.paymentMethodId) {
        paymentObj.customer = getStripe.customerId;
    }
    else if (getUser.email) {
        paymentObj.customer_email = getUser.email;
    }

    try {
        const session = await stripe.checkout.sessions.create(paymentObj);
        await new checkoutSession({
            orderId,
            paymentId: session.id,
            sessionData: session,
            status: 0,
            url: session.url,
            orderType,
        }).save();

        console.log(session.url);
        return Promise.resolve(session.url);
    } catch (err) {
        console.log(err);
        return Promise.reject(err);
    }
};

exports.validateEmail = (emailAdress) => {
    let regexEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return regexEmail.test(emailAdress.match(regexEmail))
}
exports.validatePhoneNumber = (input_str) => {
    var re = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{4})$/;
    return re.test(input_str);
}
exports.makeid = (length) => {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
exports.getCurrentDateTime = (timeZone) => {
    let date = moment()
        .tz(timeZone)
        .format("DD/MM/YYYY,h:mm:ss a")
        .split(",")[0];

    let time = moment()
        .tz(timeZone)
        .format("DD/MM/YYYY,h:mm:ss a")
        .split(",")[1];

    return [date, time];
}
exports.getCurrentDateTime24 = (timeZone) => {
    let date = moment()
        .tz(timeZone)
        .format("DD/MM/YYYY,H:mm:ss a")
        .split(",")[0];

    let time = moment()
        .tz(timeZone)
        .format("DD/MM/YYYY,H:mm:ss a")
        .split(",")[1];

    return [date, time];
}
exports.convertTime12to24 = (time12h) => {
    const [time, modifier] = time12h.split(" ");

    let [hours, minutes, second] = time.split(":");

    if (hours === "12") {
        hours = "00";
    }

    if (modifier === "PM") {
        hours = parseInt(hours, 10) + 12;
    }

    return `${hours}:${minutes}:${second}`;
}

exports.add15Minutes = (time) => {
    console.log("time is" + time)
    let [hours, minutes, second] = time.split(":");

    hours = parseInt(hours);
    minutes = parseInt(minutes);
    second = parseInt(second)
    for (i = 0; i < 15; i++) {
        if (minutes == 59) {
            minutes = 00;
            if (hours == 23) {
                hours = 00;
            }
            else {
                hours += 1;
            }
        }
        else {
            minutes += 1
        }
    }
    if (hours < 10) {
        hours = "0" + hours
    }
    if (minutes < 10) {
        minutes = "0" + minutes
    }
    if (second < 10) {
        second = "0" + second
    }
    return `${hours}:${minutes}:${second}`;
}
exports.sub15Minutes = (time) => {
    console.log("time is" + time)
    let [hours, minutes, second] = time.split(":");

    hours = parseInt(hours);
    minutes = parseInt(minutes);
    second = parseInt(second)
    for (i = 0; i < 15; i++) {
        if (minutes == 00) {
            minutes = 59;
            if (hours == 00) {
                hours = 23;
            }
            else {
                hours -= 1;
            }
        }
        else {
            minutes -= 1
        }
    }
    if (hours < 10) {
        hours = "0" + hours
    }
    if (minutes < 10) {
        minutes = "0" + minutes
    }
    if (second < 10) {
        second = "0" + second
    }
    return `${hours}:${minutes}:${second}`;
}
exports.convertDateFormat = (date) => {
    date = date.split("/");
    return `${date[2]}/${date[1]}/${date[0]}`;
}

exports.addTime = (dateMoment, modifyMoment) => {
    // console.log(dateMoment)
    // console.log(modifyMoment)
    timeIs = modifyMoment.split(":");
    // console.log(momentIs(dateMoment))
    let hourUpdated = momentIs(dateMoment).add(timeIs[0], 'hours');
    let minuteUpdated = momentIs(hourUpdated).add(timeIs[1], 'minutes')
    let secondUpdated = momentIs(minuteUpdated).add(timeIs[2], 'seconds');
    // console.log(hourUpdated);
    // console.log(minuteUpdated);
    // console.log(secondUpdated);

    return secondUpdated;
}
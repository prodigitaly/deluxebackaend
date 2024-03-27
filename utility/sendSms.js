var axios = require("axios");
require("dotenv").config();
exports.sendSms = (to, message) => {
  // var data = JSON.stringify({
  //     "messages": [
  //         {
  //             "body": message,
  //             "to": to,
  //             "from": "Laundary"
  //         }
  //     ]
  // });
  // console.log(data);
  // let buff = Buffer.from(process.env.SMSUSER + ":" + process.env.SMSPASS).toString('base64');
  // console.log(buff);
  // var config = {
  //     method: 'post',
  //     url: 'https://rest.clicksend.com/v3/sms/send',
  //     headers: {
  //         'Content-Type': 'application/json',
  //         Authorization: `Basic ${buff}`
  //     },
  //     data: data
  // };

  // axios(config)
  //     .then(function (response) {
  //         console.log(JSON.stringify(response.data));
  //     })
  //     .catch(function (error) {
  //         console.log(error);
  //     });
  // Download the helper library from https://www.twilio.com/docs/node/install
  // Find your Account SID and Auth Token at twilio.com/console
  // and set the environment variables. See http://twil.io/secure
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = require("twilio")(accountSid, authToken);

  client.messages
    .create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: to,
    })
    .then((message) => console.log(message.sid));
};

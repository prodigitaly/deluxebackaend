const cron = require("node-cron");
const moment = require("moment-timezone");
const {
  nextDays,
  checkExpireMemberShip,
  checkExpireSubscription,
  changeRideStatus,
  checkExpireCoupon,
} = require("./expiration");
cron.schedule(
  "0 0 0 * * *",
  async () => {
    // your task here
    console.log("Running a task every day at 12:00 am in the US");
    let currentDate = moment().tz("America/Panama");
    console.log("nexta  days calling");
    let days = await nextDays(currentDate);
    console.log(days);
    await checkExpireMemberShip();
    await checkExpireSubscription();
    await changeRideStatus();
    await checkExpireCoupon();
  },
  {
    scheduled: true,
    timezone: "America/Panama",
  }
);

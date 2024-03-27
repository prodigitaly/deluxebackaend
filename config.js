require("dotenv").config();
const mongoose = require("mongoose");
// console.log(process.env.HOST);
/*Database Connection*/
mongoose.connect(process.env.HOST, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

mongoose.connection
    .once("open", () => console.log("DB Connected"))
    .on("error", (error) => {
        console.log("Error While Connecting With DB");
    });

module.exports = { mongoose };
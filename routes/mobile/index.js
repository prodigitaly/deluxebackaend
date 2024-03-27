var express = require('express');
var router = express.Router();
const authRouter = require('./auth');
const service = require('./services')
const rider = require('./rider');
const order = require('./order')
router.use('/auth', authRouter);
router.use('/services', service);
router.use('/rider', rider)
router.use('/order', order)
module.exports = router;

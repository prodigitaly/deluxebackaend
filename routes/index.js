var express = require('express');
const { setLink } = require('../utility/dates');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});
router.post('/setBaseLink', async (req, res, next) => {
  try {
    const { link } = req.body;
    setLink(link);
    return res.status(200).json({ issuccess: true, Data: base_url, messsage: "link set successfully" });
  } catch (error) {
    return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: error.message || "Having issue is server" })
  }
})
module.exports = router;

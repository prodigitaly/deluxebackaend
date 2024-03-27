const { validationResult } = require('express-validator')
exports.checkErr = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ issuccess: false, data: { acknowledgement: false }, message: errors.array()[0].msg });
    }
    next();
}
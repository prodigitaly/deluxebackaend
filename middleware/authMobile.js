require('dotenv').config()
const jwt = require('jsonwebtoken');
const { default: mongoose } = require('mongoose');
const deleteUser = require('../models/deleteUser');
// const client = require('../services/redis')

//this function used for generate accesss token from refresh token
exports.generateRefreshToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const refreshToken = authHeader && authHeader.split(' ')[1]
        // console.log(refreshToken);
        if (refreshToken == null) return res.status(200).json({ issuccess: false, data: { acknowledgement: false }, message: "please send valid request" });

        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
            if (err) return res.status(200).json({ issuccess: false, data: { acknowledgement: false }, message: "Token Expired or Invalid Token" });
            // let getData = await client.get(user._id + "" + user.deviceId);
            // if (!getData) {
            //     return res.status(440).json({ issuccess: true, data: { acknowledgement: true }, message: "session expired" });
            // }
            // if (getData && getData == "0") {
            //     return res.status(440).json({ issuccess: true, data: { acknowledgement: true }, message: "session logged out" });
            // }
            const accessToken = await this.generateAccessTokenOnly({
                _id: user._id,
                role: user.role,
                // deviceId: user.deviceId,
                timestamp: Date.now()
            })
            // console.log(accessToken)
            return res.status(200).json({ issuccess: true, data: { acknowledgement: true, token: accessToken }, message: "Here is your token" });
            next();
        })
    }
    catch (err) {
        console.log(err)
        return res.status(500).json({ issuccess: false, data: { acknowledgement: false }, message: "having issue on server" || err.message })
    }

}
exports.checkUserRole = (roles) => {
    return async function (req, res, next) {
        if (req.user != undefined && req.user.role != undefined && !roles.includes(req.user.role)) {
            return res.status(200).json({ issuccess: false, data: { acknowledgement: false }, message: "you does not have permission to access this data" })
        }
        next();
    }
}
//authenticate access token
exports.authenticateToken = async (req, res, next) => {
    // console.log(req.headers)
    const authHeader = req.headers['authorization']
    // console.log(authHeader)
    const token = authHeader && authHeader.split(' ')[1] || req.signedCookies.access_token
    // console.log(token);

    if (!token) return res.status(200).json({ issuccess: false, data: { acknowledgement: false }, message: "please send valid request" });

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, user) => {
        if (err) return res.status(200).json({ issuccess: false, data: { acknowledgement: false }, message: "Token Expired or Invalid Token" });
        // console.log(user);
        req.user = {
            _id: user._id,
            role: user.role
            // deviceId: user.deviceId
        }
        checkDelete = await deleteUser.aggregate([
            {
                $match: {
                    userId: mongoose.Types.ObjectId(user._id)
                }
            }
        ])
        if (checkDelete.length > 0) {
            return res.status(200).json({ issuccess: false, data: { acknowledgement: false, data: null }, message: "user is removed, please contact admin" });
        }
        // let getData = await client.get(user._id + "" + user.deviceId);
        // if (!getData) {
        //     return res.status(440).json({ issuccess: true, data: { acknowledgement: true }, message: "session expired" });
        // }
        // if (getData && getData == "0") {
        //     return res.status(440).json({ issuccess: true, data: { acknowledgement: true }, message: "session logged out" });
        // }
        next()
    })
}
//authenticate access token
exports.authenticateTokenWithUserId = async (req, res, next) => {
    // console.log(req.headers)
    if ('userId' in req.body) {
        next();
        return;
    }
    const authHeader = req.headers['authorization']
    // console.log(authHeader)
    const token = authHeader && authHeader.split(' ')[1] || req.signedCookies.access_token
    // console.log(token);
    if (!token) return res.status(200).json({ issuccess: false, data: { acknowledgement: false }, message: "please send valid request" });

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(200).json({ issuccess: false, data: { acknowledgement: false }, message: "Token Expired or Invalid Token" });
        // console.log(user);
        req.user = {
            _id: user._id,
            role: user.role
        }
        next()
    })
}
exports.authenticateTokenWithUserIdForAdmin = async (req, res, next) => {
    // console.log(req.headers)
    if ('userId' in req.body) {
        next();
        return;
    }
    const authHeader = req.headers['authorization']
    // console.log(authHeader)
    const token = authHeader && authHeader.split(' ')[1] || req.signedCookies.access_token
    // console.log(token);
    if (!token) return res.status(200).json({ issuccess: false, data: { acknowledgement: false }, message: "please send valid request" });

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(200).json({ issuccess: false, data: { acknowledgement: false }, message: "Token Expired or Invalid Token" });
        // console.log(user);
        req.user = {
            _id: user._id,
            role: user.role
        }
        next()
    })
}
exports.parseJwt = (token) => {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
};

//generate access token and refesh token for user
exports.generateAccessToken = async (user) => {
    console.log("user token");
    console.log(user);
    const generatedToken = jwt.sign({ _id: user._id, role: user.role, time: Date.now() }, process.env.ACCESS_TOKEN_SECRET)
    const refreshToken = jwt.sign({ _id: user._id, role: user.role, time: Date.now() }, process.env.REFRESH_TOKEN_SECRET)
    // console.log(generatedToken);
    // await client.set(user._id + "" + user.deviceId, refreshToken);
    return {
        generatedToken: generatedToken, refreshToken: refreshToken
    }
}

//generate access token only using refreshtoken
exports.generateAccessTokenOnly = async (user) => {
    const generatedToken = jwt.sign({ _id: user._id, role: user.role, time: Date.now() }, process.env.ACCESS_TOKEN_SECRET)
    return generatedToken;
}



const { default: mongoose } = require("mongoose");
const pickupDeliverySchema = require("../models/pickupDeliverySchema");
const trackedLocations = require("../models/trackedLocations");
const jwt = require('jsonwebtoken');
module.exports = function (io) {
    // io.use((socket, next) => {
    //     const token = socket.handshake.auth.token;
    //     console.log(token);
    //     console.log("here");
    //     if (!token) {
    //         next(new Error("invalid"));
    //     }
    //     if (token == 'cf198546f1c8891b5e91c749b87387e5fef897f8bf8b2cfdfe05f429fe68cbac353b7535397049f39a6f372be972a679cf538492aa3321bc3960cdb56ff4fb63') {
    //         next();
    //     }

    // });

    const authMiddleware = (socket, next) => {
        // Perform authentication here
        if (authenticated) {
            return next();
        }
        return next(new Error('Authentication error'));
    };
    io.of('/connection').use((socket, next) => {
        const token = socket.handshake.auth.token;
        console.log(token);
        console.log("here");
        next()
        if (!token) {
            next(new Error("invalid"));
        }
        if (token == 'cf198546f1c8891b5e91c749b87387e5fef897f8bf8b2cfdfe05f429fe68cbac353b7535397049f39a6f372be972a679cf538492aa3321bc3960cdb56ff4fb63') {
            next();
        }

    }).on('connection', function (socket) {
        console.log('A user connected');
        console.log(socket.id);
        setInterval(function () {
            // do your thing
            socket.emit("requestLocation");
        }, 2000);
        socket.on('getLocation', async function (arg) {
            const { rideId }
                = arg;
            let getLatLong = await pickupDeliverySchema.aggregate([
                {
                    $match: {
                        _id: mongoose.Types.ObjectId(rideId)
                    }
                },
                {
                    $lookup: {
                        from: "tackedlocations",
                        let: { rideId: "$_id" },
                        pipeline: [{ $match: { $expr: { $eq: ["$rideId", "$$rideId"] } } }, {
                            $group: {
                                _id: "$rideId",
                                "locations": {
                                    "$push": "$location"
                                }
                            }
                        }],
                        as: "trackedLocations"
                    }
                },
                {
                    $addFields: {
                        trackedLocations: { $first: "$trackedLocations.locations" }
                    }
                },
                {
                    $project: {
                        startCordinates: 1,
                        endCordinates: 1,
                        trackedLocations: 1,
                        rideType: 1
                    }
                }
            ])
            if (getLatLong.length > 0) {
                callback({
                    "issuccess": true,
                    "data": {
                        "acknowledgement": true,
                        "data": {
                            "pickup": getLatLong[0].rideType == 0 ? getLatLong[0] : {},
                            "deliver": getLatLong[0].rideType == 1 ? getLatLong[0] : {},
                            "return": getLatLong[0].rideType == 2 ? getLatLong[0] : {}
                        }
                    },
                    "message": "data found"
                })
                return;
            }
            callback({
                "issuccess": false,
                "data": {
                    "acknowledgement": false,
                    "data": {
                        "pickup": {},
                        "deliver": {},
                        "return": {}
                    }
                },
                "message": "data not found"
            })
            return;
        });
        //Whenever someone disconnects this piece of code executed
        socket.on('disconnect', function () {
            console.log('A user disconnected');
        });
    });

    io.of('/riderSocket').use((socket, next) => {
        const token = socket.handshake.auth.token;
        console.log(token);
        console.log("here");
        next();
        // if (!token) {
        //     next(new Error("invalid"));
        // }
        // if (token == 'cf198546f1c8891b5e91c749b87387e5fef897f8bf8b2cfdfe05f429fe68cbac353b7535397049f39a6f372be972a679cf538492aa3321bc3960cdb56ff4fb63') {
        //     next();
        // }

    }).on('connection', function (socket) {
        console.log('A user connected');
        console.log(socket.id);
        setInterval(function () {
            // do your thing
            socket.emit("requestLocation");
        }, 2000);

        socket.on('getLocation', async function (arg, callback) {
            let { lat, long, authToken } = arg;
            let riderId;
            console.log(riderId + "  " + lat + "  " + long + " " + authToken)
            jwt.verify(authToken, process.env.ACCESS_TOKEN_SECRET, async (err, user) => {
                if (err) {
                    console.log(err)
                }
                riderId = user._id
            })
            let getPickup = await pickupDeliverySchema.find({ riderId: mongoose.Types.ObjectId(riderId), status: 1 });
            if (getPickup != undefined) {
                await new trackedLocations({
                    riderId: getPickup.riderId,
                    rideId: getPickup.rideId,
                    orderId: getPickup.orderId,
                    location: [lat, long]
                }).save()
            }

            callback({
                "issuccess": true,
                "data": {
                    "acknowledgement": true
                },
                "message": "data found"
            })
        });
        //Whenever someone disconnects this piece of code executed
        socket.on('disconnect', function () {
            console.log('A user disconnected');
        });
    });
}
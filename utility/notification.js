const admin = require('./setup/firebase-admin');

exports.sendNotification = async = (tokens, title, body, image) => {
    console.log(title + "  " + body + "  " + image)
    // Create a list containing up to 500 registration tokens.
    // These registration tokens come from the client FCM SDKs.
    // const registrationTokens = [
    //     'fU7E7yjMTISKjyUQypTN15:APA91bEu2Kzh30T3WlIQXSlUsGU0CNIuHvrX56K5B4SDlDF_y0FWaWYMkpTzWwkJoQ7SejboTBHSn1Wi1e3W5ytAG5Tl6Ng0bDkIBSy6mvYsQNFwzQv350BXtaTAWD34rWBXSIfb0hiF'
    // ];

    // const message = {
    //     data: { score: '850', time: '2:45' },
    //     tokens: registrationTokens,
    // };
    // let title = "Account Deposit"
    // let body = "A deposit to your savings account has just cleared."
    // let image = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/TEIDE.JPG/330px-TEIDE.JPG"
    message = {}
    if (image != "") {
        message = {
            tokens: tokens,
            notification: {
                title: title,
                body: body,
                image: image
            },
            data: {
                title: title,
                body: body,
                image: image
            },
            android: {
                notification: {
                    icon: "https://deluxe-cleaner.nyc3.cdn.digitaloceanspaces.com/logo_deluxe.png"
                }
            },
            apns: {
                payload: {
                    aps: {
                        'mutable-content': 1
                    }
                },
                fcm_options: {
                    image: image
                }
            },
            webpush: {
                headers: {
                    image: image
                }
            },
        };
    }
    else {
        var message = {
            tokens: tokens,
            notification: {
                title: title,
                body: body,
                image: "https://deluxe-cleaner.nyc3.cdn.digitaloceanspaces.com/logo_deluxe.png"
            },
            data: {
                title: title,
                body: body
            },
            android: {
                notification: {
                    icon: "https://deluxe-cleaner.nyc3.cdn.digitaloceanspaces.com/logo_deluxe.png"
                }
            },
            apns: {
                payload: {
                    aps: {
                        'mutable-content': 1
                    }
                },
                fcm_options: {
                    image: "https://deluxe-cleaner.nyc3.cdn.digitaloceanspaces.com/logo_deluxe.png"
                }
            },
            webpush: {
                headers: {
                    image: "https://deluxe-cleaner.nyc3.cdn.digitaloceanspaces.com/logo_deluxe.png"
                }
            },
        };
    }
    admin.messaging().sendMulticast(message)
        .then((response) => {
            console.log(response)
            console.log(response.successCount + ' messages were sent successfully');
        }).catch((err) => { console.log(err) })
    // admin .getMessaging());
}

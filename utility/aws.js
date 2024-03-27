const multer = require('multer');
const multerS3 = require('multer-s3');
require("dotenv").config();
const s3 = require('./setup/aws_setup')
const fs = require('fs')
const stream = require('stream')
const { DeleteObjectCommand } = require('@aws-sdk/client-s3')
exports.uploadProfileImageToS3 = (baseKey) => {
    try {
        // console.log(baseKey);
        // const s3 = new aws.S3();
        // console.log("here");
        let imageKey;
        // console.log("here");
        return multer({
            storage: multerS3({
                s3: s3,
                bucket: 'deluxe-cleaner',
                acl: 'public-read',
                contentType: multerS3.AUTO_CONTENT_TYPE,
                metadata: function (req, file, cb) {
                    cb(null, { fieldName: file.fieldname });
                },
                key: async function (req, file, cb) {
                    imageKey = baseKey + `/` + Date.now() + makeid(10) + file.originalname.substring(file.originalname.indexOf("."), file.originalname.length);
                    cb(null, imageKey);
                }
            }),
            fileFilter: function (req, file, callback) {
                const ext = file.mimetype;
                console.log(ext);
                if (ext !== 'image/jpeg' && ext !== 'image/jpg' && ext != 'image/png') {
                    const res = {
                        status: 'false',
                        message: 'Only images are allowed'
                    };
                    return callback(new Error(JSON.stringify(res)));
                }
                callback(null, true);
            }
        });
    }
    catch (err) {
        console.log("error");
        console.log(err)
    }
};
exports.removeObject = (key) => {
    try {
        return new Promise(async (resolve, reject) => {
            await s3.send(new DeleteObjectCommand({ Bucket: 'deluxe-cleaner', Key: key })).then((data) => {
                console.log("Success. Object deleted.", data);;
                resolve(data)
            }).catch((err) => {
                reject(err)
            })
        });
    }
    catch (err) {
        console.log("error");
        console.log(err)
    }
};
exports.uploadImage = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'deluxe-cleaner',
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function (req, file, cb) {
            cb(null, { fieldName: file.fieldname });
        },
        key: async function (req, file, cb) {
            imageKey = Date.now() + makeid(10) + file.originalname.substring(file.originalname.indexOf("."), file.originalname.length);
            cb(null, imageKey);
        }
    }),
    fileFilter: function (req, file, callback) {
        const ext = file.mimetype;

        console.log(ext);
        if (ext !== 'image/jpeg' && ext !== 'image/jpg') {
            const res = {
                status: 'false',
                message: 'Only images are allowed'
            };
            return callback(new Error(JSON.stringify(res)));
        }
        callback(null, true);
    }
});
function makeid(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

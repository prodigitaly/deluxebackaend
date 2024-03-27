require("dotenv").config();
const { S3Client } = require('@aws-sdk/client-s3')
console.log(process.env.ACCESS_KEY_S3);
console.log(process.env.SECRET_ACCESS_KEY_S3);
var s3 = new S3Client({
    region: 'nyc3',
    forcePathStyle: false,
    endpoint: 'https://nyc3.digitaloceanspaces.com',
    credentials: {
        accessKeyId: 'DO00LEFM6ZD79YN9EPJ8',
        secretAccessKey: 'bi1uDFot1X+JpqauFpfLoujnk3glpEnY0zrFlRYu9ag',
    }
})
module.exports = s3;
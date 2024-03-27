const redis = require('redis');
const client = redis.createClient({
    socket: {
        host: process.env.REDIS_IP || '127.0.0.1',
        port: 6379
    },
    password: process.env.REDIS_PASS
});
client.connect();
client.on('connect', function () {
    console.log('Connected to Redis');
});

client.on('error', (err) => console.log('Redis Client Error', err));

// client.set('name', 'name').then(data => console.log(data));
module.exports = client
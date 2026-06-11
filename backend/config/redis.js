require('dotenv').config();
const Redis = require('ioredis');

const redisOptions = {
    maxRetriesPerRequest: null, 
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    }
};

// connct to docker local Redis
const redisConnection = new Redis(process.env.REDIS_URL, redisOptions);

redisConnection.on('connect', () => console.log(' Redis: Connection Established (Docker Local)'));
redisConnection.on('error', (err) => console.error(' Redis: Connection Error -', err.message));

module.exports = redisConnection;
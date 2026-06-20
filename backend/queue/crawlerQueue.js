const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const crawlerQueue = new Queue('CrawlerQueue', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3, // Retry failed jobs up to 3 times
        backoff: {
            type: 'exponential',
            delay: 5000 // Wait 5s, then 25s, then 125s before retrying
        },
        removeOnComplete: true, // Keep RAM clean: delete successful jobs instantly
        removeOnFail: 100 // DLQ: Keep the last 100 permanently failed jobs in Redis for debugging
    }
});

module.exports = crawlerQueue;
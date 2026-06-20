const crawlerQueue = require('./crawlerQueue');
const redisConnection = require('../config/redis');
const { MAX_DEPTH } = require('../config/constants');  // The Firewall

/**
 * @typedef {Object} CrawlJob
 * @property {string} url - The target absolute URL to scrape
 * @property {number} depth - The current distance from the seed URL
 */

/**
 * Checks Redis for duplicates before injecting into the BullMQ queue.
 * @param {string} targetUrl 
 * @param {number} depth 
 * @returns {Promise<boolean>} True if added, False if duplicate or too deep
 */
async function addUrlToQueue(targetUrl, depth = 0) {
    try {
        // The Depth Firewall
        if (depth > MAX_DEPTH) {
            console.log(`🛑 Max Depth Reached [Depth: ${depth}]: ${targetUrl}`);
            return false;
        }

        // 1. Normalize the URL 
        const urlObj = new URL(targetUrl);
        urlObj.hash = '';   // Strips out #anchors
        urlObj.search = ''; // Strips out ?query=parameters
        const cleanUrl = urlObj.href.replace(/\/$/, ''); // Removes trailing slash

        // 2. The O(1) Gatekeeper
        const wasAdded = await redisConnection.sadd('visited_urls', cleanUrl);

        if (wasAdded === 0) {
            return false; // Duplicate
        }

        // 3. Strict Data Contract
        /** @type {CrawlJob} */
        const jobData = {
            url: cleanUrl,
            depth: depth
        };

        // 4. Inject into the distributed queue
        await crawlerQueue.add('scrape', jobData);
        
        console.log(`📥 Queued [Depth: ${depth}]: ${cleanUrl}`);
        return true;

    } catch (error) {
        console.error(` Failed to queue ${targetUrl}:`, error.message);
        return false;
    }
}

module.exports = { addUrlToQueue };